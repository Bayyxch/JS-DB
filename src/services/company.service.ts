import { db } from '../db/database.js';

export interface CompanyInfo {
  id: number;
  name: string;
  owner_id: string;
  owner_username: string;
  total_harvested: number;
  created_at: number;
  member_count: number;
  level: number;
}

export interface CompanyMember {
  id: string;
  username: string;
  role: string;
  joined_at: number;
}

function normalizeCompanyName(name: string): string {
  const value = name.trim().replace(/\s+/g, ' ');
  if (value.length < 3 || value.length > 24) throw new Error('COMPANY_NAME_INVALID');
  if (!/^[\p{L}\p{N} _-]+$/u.test(value)) throw new Error('COMPANY_NAME_INVALID');
  return value;
}

export function getUserCompany(userId: string): CompanyInfo | undefined {
  return db.prepare(`
    SELECT c.id, c.name, c.owner_id, owner.username AS owner_username,
      c.total_harvested, c.created_at,
      (SELECT COUNT(*) FROM company_members cm WHERE cm.company_id = c.id) AS member_count,
      CAST(c.total_harvested / 1000 AS INTEGER) + 1 AS level
    FROM company_members mine
    JOIN companies c ON c.id = mine.company_id
    JOIN users owner ON owner.id = c.owner_id
    WHERE mine.user_id = ?
  `).get(userId) as CompanyInfo | undefined;
}

export function createCompany(ownerId: string, name: string): CompanyInfo {
  const normalized = normalizeCompanyName(name);
  return db.transaction(() => {
    if (db.prepare('SELECT 1 FROM company_members WHERE user_id = ?').get(ownerId)) {
      throw new Error('COMPANY_ALREADY_MEMBER');
    }
    const result = db.prepare('INSERT INTO companies (name, owner_id, created_at) VALUES (?, ?, ?)')
      .run(normalized, ownerId, Date.now());
    const companyId = Number(result.lastInsertRowid);
    db.prepare('INSERT INTO company_members (user_id, company_id, role, joined_at) VALUES (?, ?, \'OWNER\', ?)')
      .run(ownerId, companyId, Date.now());
    return getUserCompany(ownerId)!;
  })();
}

export function inviteToCompany(ownerId: string, targetId: string): void {
  if (ownerId === targetId) throw new Error('COMPANY_INVITE_SELF');
  db.transaction(() => {
    const company = getUserCompany(ownerId);
    if (!company) throw new Error('COMPANY_NOT_FOUND');
    if (company.owner_id !== ownerId) throw new Error('COMPANY_OWNER_ONLY');
    if (company.member_count >= 20) throw new Error('COMPANY_FULL');
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(targetId)) throw new Error('FRIEND_USER_NOT_FOUND');
    if (db.prepare('SELECT 1 FROM company_members WHERE user_id = ?').get(targetId)) throw new Error('COMPANY_ALREADY_MEMBER');
    db.prepare('INSERT INTO company_invites (company_id, target_id, inviter_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(company_id, target_id) DO UPDATE SET inviter_id = excluded.inviter_id, created_at = excluded.created_at, expires_at = excluded.expires_at')
      .run(company.id, targetId, ownerId, Date.now(), Date.now() + 7 * 24 * 60 * 60 * 1000);
  })();
}

export function listCompanyInvites(userId: string): Array<{ company_id: number; company_name: string; inviter_id: string; expires_at: number }> {
  db.prepare('DELETE FROM company_invites WHERE expires_at <= ?').run(Date.now());
  return db.prepare(`
    SELECT i.company_id, c.name AS company_name, i.inviter_id, i.expires_at
    FROM company_invites i JOIN companies c ON c.id = i.company_id
    WHERE i.target_id = ? ORDER BY i.created_at ASC LIMIT 10
  `).all(userId) as Array<{ company_id: number; company_name: string; inviter_id: string; expires_at: number }>;
}

export function acceptCompanyInvite(userId: string, companyId: number): CompanyInfo {
  return db.transaction(() => {
    if (db.prepare('SELECT 1 FROM company_members WHERE user_id = ?').get(userId)) {
      throw new Error('COMPANY_ALREADY_MEMBER');
    }
    const invite = db.prepare('SELECT expires_at FROM company_invites WHERE company_id = ? AND target_id = ?')
      .get(companyId, userId) as { expires_at: number } | undefined;
    if (!invite || invite.expires_at <= Date.now()) throw new Error('COMPANY_INVITE_NOT_FOUND');
    const company = db.prepare('SELECT COUNT(*) AS count FROM company_members WHERE company_id = ?').get(companyId) as { count: number };
    if (company.count >= 20) throw new Error('COMPANY_FULL');
    db.prepare('INSERT INTO company_members (user_id, company_id, role, joined_at) VALUES (?, ?, \'MEMBER\', ?)')
      .run(userId, companyId, Date.now());
    db.prepare('DELETE FROM company_invites WHERE target_id = ?').run(userId);
    return getUserCompany(userId)!;
  })();
}

export function declineCompanyInvite(userId: string, companyId: number): void {
  const result = db.prepare('DELETE FROM company_invites WHERE company_id = ? AND target_id = ?').run(companyId, userId);
  if (result.changes === 0) throw new Error('COMPANY_INVITE_NOT_FOUND');
}

export function listCompanyMembers(companyId: number): CompanyMember[] {
  return db.prepare(`
    SELECT u.id, u.username, cm.role, cm.joined_at
    FROM company_members cm JOIN users u ON u.id = cm.user_id
    WHERE cm.company_id = ? ORDER BY CASE cm.role WHEN 'OWNER' THEN 0 ELSE 1 END, cm.joined_at ASC
  `).all(companyId) as CompanyMember[];
}

export function leaveCompany(userId: string): void {
  const company = getUserCompany(userId);
  if (!company) throw new Error('COMPANY_NOT_FOUND');
  if (company.owner_id === userId) throw new Error('COMPANY_OWNER_TRANSFER_REQUIRED');
  db.transaction(() => {
    db.prepare('DELETE FROM company_members WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM company_invites WHERE target_id = ?').run(userId);
  })();
}

export function kickCompanyMember(ownerId: string, targetId: string): void {
  const company = getUserCompany(ownerId);
  if (!company) throw new Error('COMPANY_NOT_FOUND');
  if (company.owner_id !== ownerId) throw new Error('COMPANY_OWNER_ONLY');
  if (targetId === ownerId) throw new Error('COMPANY_CANNOT_KICK_OWNER');
  const result = db.prepare('DELETE FROM company_members WHERE user_id = ? AND company_id = ?').run(targetId, company.id);
  if (result.changes === 0) throw new Error('COMPANY_MEMBER_NOT_FOUND');
}

export function transferCompanyOwnership(ownerId: string, targetId: string): void {
  const company = getUserCompany(ownerId);
  if (!company) throw new Error('COMPANY_NOT_FOUND');
  if (company.owner_id !== ownerId) throw new Error('COMPANY_OWNER_ONLY');
  if (targetId === ownerId) throw new Error('COMPANY_TRANSFER_SELF');
  db.transaction(() => {
    const target = db.prepare('SELECT 1 FROM company_members WHERE user_id = ? AND company_id = ?').get(targetId, company.id);
    if (!target) throw new Error('COMPANY_MEMBER_NOT_FOUND');
    db.prepare("UPDATE company_members SET role = 'MEMBER' WHERE user_id = ?").run(ownerId);
    db.prepare("UPDATE company_members SET role = 'OWNER' WHERE user_id = ?").run(targetId);
    db.prepare('UPDATE companies SET owner_id = ? WHERE id = ?').run(targetId, company.id);
  })();
}

export function disbandCompany(ownerId: string): void {
  const company = getUserCompany(ownerId);
  if (!company) throw new Error('COMPANY_NOT_FOUND');
  if (company.owner_id !== ownerId) throw new Error('COMPANY_OWNER_ONLY');
  db.prepare('DELETE FROM companies WHERE id = ?').run(company.id);
}

export function getCompanyLeaderboard(limit = 10): CompanyInfo[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new Error('INVALID_LIMIT');
  return db.prepare(`
    SELECT c.id, c.name, c.owner_id, u.username AS owner_username,
      c.total_harvested, c.created_at,
      (SELECT COUNT(*) FROM company_members cm WHERE cm.company_id = c.id) AS member_count,
      CAST(c.total_harvested / 1000 AS INTEGER) + 1 AS level
    FROM companies c JOIN users u ON u.id = c.owner_id
    ORDER BY c.total_harvested DESC, c.created_at ASC LIMIT ?
  `).all(limit) as CompanyInfo[];
}
