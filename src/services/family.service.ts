import { db } from '../db/database.js';

export interface FamilySummary {
  id: number;
  name: string;
  owner_id: string;
  points: number;
  created_at: number;
  member_count: number;
}

export interface FamilyMember {
  id: string;
  username: string;
  role: 'owner' | 'member';
  joined_at: number;
}

function getMembership(userId: string): { family_id: number; role: 'owner' | 'member' } | undefined {
  return db.prepare('SELECT family_id, role FROM family_members WHERE user_id = ?')
    .get(userId) as { family_id: number; role: 'owner' | 'member' } | undefined;
}

export function createFamily(ownerId: string, rawName: string): FamilySummary {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 24 || !/^[\p{L}\p{N} _-]+$/u.test(name)) {
    throw new Error('FAMILY_INVALID_NAME');
  }
  return db.transaction(() => {
    if (getMembership(ownerId)) throw new Error('FAMILY_ALREADY_MEMBER');
    const result = db.prepare('INSERT INTO family_groups (name, owner_id, created_at) VALUES (?, ?, ?)')
      .run(name, ownerId, Date.now());
    const familyId = Number(result.lastInsertRowid);
    db.prepare('INSERT INTO family_members (user_id, family_id, role, joined_at) VALUES (?, ?, ?, ?)')
      .run(ownerId, familyId, 'owner', Date.now());
    return getFamily(ownerId)!;
  })();
}

export function getFamily(userId: string): FamilySummary | undefined {
  return db.prepare(`
    SELECT f.id, f.name, f.owner_id, f.points, f.created_at,
      (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id) AS member_count
    FROM family_groups f
    JOIN family_members mine ON mine.family_id = f.id
    WHERE mine.user_id = ?
  `).get(userId) as FamilySummary | undefined;
}

export function getFamilyMembers(userId: string): FamilyMember[] {
  const family = getFamily(userId);
  if (!family) return [];
  return db.prepare(`
    SELECT u.id, u.username, m.role, m.joined_at
    FROM family_members m JOIN users u ON u.id = m.user_id
    WHERE m.family_id = ?
    ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, m.joined_at ASC
  `).all(family.id) as FamilyMember[];
}

export function inviteFamilyMember(ownerId: string, inviteeId: string): void {
  if (ownerId === inviteeId) throw new Error('FAMILY_SELF_INVITE');
  db.transaction(() => {
    const membership = getMembership(ownerId);
    if (!membership || membership.role !== 'owner') throw new Error('FAMILY_OWNER_ONLY');
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(inviteeId)) throw new Error('FRIEND_USER_NOT_FOUND');
    if (getMembership(inviteeId)) throw new Error('FAMILY_ALREADY_MEMBER');
    const count = db.prepare('SELECT COUNT(*) AS count FROM family_members WHERE family_id = ?')
      .get(membership.family_id) as { count: number };
    if (count.count >= 8) throw new Error('FAMILY_FULL');
    if (db.prepare('SELECT 1 FROM family_invites WHERE family_id = ? AND invitee_id = ?').get(membership.family_id, inviteeId)) {
      throw new Error('FAMILY_INVITE_PENDING');
    }
    db.prepare('INSERT INTO family_invites (family_id, inviter_id, invitee_id, created_at) VALUES (?, ?, ?, ?)')
      .run(membership.family_id, ownerId, inviteeId, Date.now());
  })();
}

export function acceptFamilyInvite(userId: string, familyId: number): void {
  db.transaction(() => {
    if (getMembership(userId)) throw new Error('FAMILY_ALREADY_MEMBER');
    const invite = db.prepare('SELECT family_id FROM family_invites WHERE family_id = ? AND invitee_id = ?')
      .get(familyId, userId);
    if (!invite) throw new Error('FAMILY_INVITE_NOT_FOUND');
    const count = db.prepare('SELECT COUNT(*) AS count FROM family_members WHERE family_id = ?')
      .get(familyId) as { count: number };
    if (count.count >= 8) throw new Error('FAMILY_FULL');
    db.prepare('INSERT INTO family_members (user_id, family_id, role, joined_at) VALUES (?, ?, ?, ?)')
      .run(userId, familyId, 'member', Date.now());
    db.prepare('DELETE FROM family_invites WHERE invitee_id = ?').run(userId);
  })();
}

export function listFamilyInvites(userId: string): Array<{ family_id: number; family_name: string; inviter_id: string; created_at: number }> {
  return db.prepare(`
    SELECT i.family_id, f.name AS family_name, i.inviter_id, i.created_at
    FROM family_invites i JOIN family_groups f ON f.id = i.family_id
    WHERE i.invitee_id = ? ORDER BY i.created_at ASC LIMIT 10
  `).all(userId) as Array<{ family_id: number; family_name: string; inviter_id: string; created_at: number }>;
}

export function transferFamilyOwnership(ownerId: string, targetId: string): void {
  db.transaction(() => {
    const membership = getMembership(ownerId);
    if (!membership || membership.role !== 'owner') throw new Error('FAMILY_OWNER_ONLY');
    const target = getMembership(targetId);
    if (!target || target.family_id !== membership.family_id || target.role !== 'member') {
      throw new Error('FAMILY_TARGET_NOT_MEMBER');
    }
    db.prepare('UPDATE family_groups SET owner_id = ? WHERE id = ?').run(targetId, membership.family_id);
    db.prepare("UPDATE family_members SET role = 'member' WHERE user_id = ?").run(ownerId);
    db.prepare("UPDATE family_members SET role = 'owner' WHERE user_id = ?").run(targetId);
  })();
}

export function kickFamilyMember(ownerId: string, targetId: string): void {
  if (ownerId === targetId) throw new Error('FAMILY_CANNOT_KICK_SELF');
  db.transaction(() => {
    const membership = getMembership(ownerId);
    if (!membership || membership.role !== 'owner') throw new Error('FAMILY_OWNER_ONLY');
    const target = getMembership(targetId);
    if (!target || target.family_id !== membership.family_id || target.role !== 'member') {
      throw new Error('FAMILY_TARGET_NOT_MEMBER');
    }
    db.prepare('DELETE FROM family_members WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM family_invites WHERE invitee_id = ? AND family_id = ?').run(targetId, membership.family_id);
  })();
}

export function leaveFamily(userId: string): void {
  db.transaction(() => {
    const membership = getMembership(userId);
    if (!membership) throw new Error('FAMILY_NOT_FOUND');
    if (membership.role === 'owner') {
      const count = db.prepare('SELECT COUNT(*) AS count FROM family_members WHERE family_id = ?')
        .get(membership.family_id) as { count: number };
      if (count.count > 1) throw new Error('FAMILY_TRANSFER_FIRST');
      db.prepare('DELETE FROM family_groups WHERE id = ?').run(membership.family_id);
      return;
    }
    db.prepare('DELETE FROM family_members WHERE user_id = ?').run(userId);
  })();
}
