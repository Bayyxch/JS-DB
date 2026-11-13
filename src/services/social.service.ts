import { db } from '../db/database.js';

export interface PlayerProfile {
  id: string;
  username: string;
  bio: string;
  balance: number;
  created_at: number;
  friend_count: number;
  farm_plots: number;
  planted_plots: number;
}

function assertBio(bio: string): string {
  const normalized = bio.trim();
  if (normalized.length > 160) throw new Error('BIO_TOO_LONG');
  return normalized;
}

export function getPlayerProfile(userId: string): PlayerProfile | undefined {
  return db.prepare(`
    SELECT u.id, u.username, u.created_at,
      COALESCE(p.bio, '') AS bio,
      COALESCE(w.balance, 0) AS balance,
      (SELECT COUNT(*) FROM friendships f WHERE f.user_low = u.id OR f.user_high = u.id) AS friend_count,
      (SELECT COUNT(*) FROM farm_plots fp WHERE fp.user_id = u.id) AS farm_plots,
      (SELECT COUNT(*) FROM farm_plots fp WHERE fp.user_id = u.id AND fp.crop_id IS NOT NULL) AS planted_plots
    FROM users u
    LEFT JOIN player_profiles p ON p.user_id = u.id
    LEFT JOIN wallets w ON w.user_id = u.id
    WHERE u.id = ?
  `).get(userId) as PlayerProfile | undefined;
}

export function setPlayerBio(userId: string, bio: string): string {
  const normalized = assertBio(bio);
  db.prepare(`
    INSERT INTO player_profiles (user_id, bio, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET bio = excluded.bio, updated_at = excluded.updated_at
  `).run(userId, normalized, Date.now());
  return normalized;
}

export function sendFriendRequest(senderId: string, receiverId: string): void {
  if (senderId === receiverId) throw new Error('FRIEND_SELF');
  db.transaction(() => {
    const receiver = db.prepare('SELECT id FROM users WHERE id = ?').get(receiverId);
    if (!receiver) throw new Error('FRIEND_USER_NOT_FOUND');
    const [low, high] = [senderId, receiverId].sort();
    const exists = db.prepare('SELECT 1 FROM friendships WHERE user_low = ? AND user_high = ?').get(low, high);
    if (exists) throw new Error('ALREADY_FRIENDS');
    const reverse = db.prepare('SELECT 1 FROM friend_requests WHERE sender_id = ? AND receiver_id = ?').get(receiverId, senderId);
    if (reverse) throw new Error('FRIEND_REQUEST_RECEIVED');
    const pending = db.prepare('SELECT 1 FROM friend_requests WHERE sender_id = ? AND receiver_id = ?').get(senderId, receiverId);
    if (pending) throw new Error('FRIEND_REQUEST_PENDING');
    db.prepare('INSERT INTO friend_requests (sender_id, receiver_id, created_at) VALUES (?, ?, ?)').run(senderId, receiverId, Date.now());
  })();
}

export function acceptFriendRequest(receiverId: string, senderId: string): void {
  if (receiverId === senderId) throw new Error('FRIEND_SELF');
  db.transaction(() => {
    const request = db.prepare('SELECT 1 FROM friend_requests WHERE sender_id = ? AND receiver_id = ?').get(senderId, receiverId);
    if (!request) throw new Error('FRIEND_REQUEST_NOT_FOUND');
    const [low, high] = [senderId, receiverId].sort();
    db.prepare('INSERT OR IGNORE INTO friendships (user_low, user_high, created_at) VALUES (?, ?, ?)').run(low, high, Date.now());
    db.prepare('DELETE FROM friend_requests WHERE sender_id = ? AND receiver_id = ?').run(senderId, receiverId);
    db.prepare('DELETE FROM friend_requests WHERE sender_id = ? AND receiver_id = ?').run(receiverId, senderId);
  })();
}

export function declineFriendRequest(receiverId: string, senderId: string): void {
  const result = db.prepare('DELETE FROM friend_requests WHERE sender_id = ? AND receiver_id = ?').run(senderId, receiverId);
  if (result.changes === 0) throw new Error('FRIEND_REQUEST_NOT_FOUND');
}

export function removeFriend(userId: string, otherId: string): void {
  const [low, high] = [userId, otherId].sort();
  const result = db.prepare('DELETE FROM friendships WHERE user_low = ? AND user_high = ?').run(low, high);
  if (result.changes === 0) throw new Error('FRIEND_NOT_FOUND');
}

export function listFriends(userId: string): Array<{ id: string; username: string; created_at: number }> {
  return db.prepare(`
    SELECT u.id, u.username, f.created_at
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_low = ? THEN f.user_high ELSE f.user_low END
    WHERE f.user_low = ? OR f.user_high = ?
    ORDER BY f.created_at ASC
  `).all(userId, userId, userId) as Array<{ id: string; username: string; created_at: number }>;
}

export function listIncomingFriendRequests(userId: string): Array<{ id: string; username: string; created_at: number }> {
  return db.prepare(`
    SELECT u.id, u.username, r.created_at
    FROM friend_requests r JOIN users u ON u.id = r.sender_id
    WHERE r.receiver_id = ? ORDER BY r.created_at ASC LIMIT 10
  `).all(userId) as Array<{ id: string; username: string; created_at: number }>;
}


export interface MarriageStatus {
  partner_id: string;
  partner_username: string;
  married_at: number;
  bond_points: number;
  last_bond_claim_at: number | null;
}

export function getMarriage(userId: string): MarriageStatus | undefined {
  return db.prepare(`
    SELECT
      CASE WHEN m.user_low = ? THEN m.user_high ELSE m.user_low END AS partner_id,
      u.username AS partner_username,
      m.married_at, m.bond_points, m.last_bond_claim_at
    FROM marriages m
    JOIN users u ON u.id = CASE WHEN m.user_low = ? THEN m.user_high ELSE m.user_low END
    WHERE m.user_low = ? OR m.user_high = ?
  `).get(userId, userId, userId, userId) as MarriageStatus | undefined;
}

export function sendMarriageProposal(proposerId: string, targetId: string): void {
  if (proposerId === targetId) throw new Error('MARRIAGE_SELF');
  db.transaction(() => {
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(targetId)) {
      throw new Error('FRIEND_USER_NOT_FOUND');
    }
    if (getMarriage(proposerId) || getMarriage(targetId)) {
      throw new Error('MARRIAGE_ALREADY_MARRIED');
    }
    if (db.prepare('SELECT 1 FROM marriage_proposals WHERE proposer_id = ? AND target_id = ?').get(targetId, proposerId)) {
      throw new Error('MARRIAGE_PROPOSAL_RECEIVED');
    }
    if (db.prepare('SELECT 1 FROM marriage_proposals WHERE proposer_id = ? AND target_id = ?').get(proposerId, targetId)) {
      throw new Error('MARRIAGE_PROPOSAL_PENDING');
    }
    db.prepare('INSERT INTO marriage_proposals (proposer_id, target_id, created_at) VALUES (?, ?, ?)')
      .run(proposerId, targetId, Date.now());
  })();
}

export function acceptMarriageProposal(targetId: string, proposerId: string): void {
  db.transaction(() => {
    const proposal = db.prepare('SELECT 1 FROM marriage_proposals WHERE proposer_id = ? AND target_id = ?')
      .get(proposerId, targetId);
    if (!proposal) throw new Error('MARRIAGE_PROPOSAL_NOT_FOUND');
    if (getMarriage(targetId) || getMarriage(proposerId)) throw new Error('MARRIAGE_ALREADY_MARRIED');
    const [low, high] = [targetId, proposerId].sort();
    db.prepare('INSERT INTO marriages (user_low, user_high, married_at) VALUES (?, ?, ?)')
      .run(low, high, Date.now());
    db.prepare('DELETE FROM marriage_proposals WHERE proposer_id IN (?, ?) OR target_id IN (?, ?)')
      .run(proposerId, targetId, proposerId, targetId);
  })();
}

export function declineMarriageProposal(targetId: string, proposerId: string): void {
  const result = db.prepare('DELETE FROM marriage_proposals WHERE proposer_id = ? AND target_id = ?')
    .run(proposerId, targetId);
  if (result.changes === 0) throw new Error('MARRIAGE_PROPOSAL_NOT_FOUND');
}

export function divorce(userId: string): void {
  const [low, high] = getMarriage(userId)
    ? (() => {
        const row = db.prepare('SELECT user_low, user_high FROM marriages WHERE user_low = ? OR user_high = ?').get(userId, userId) as { user_low: string; user_high: string };
        return [row.user_low, row.user_high];
      })()
    : [null, null];
  if (!low || !high) throw new Error('MARRIAGE_NOT_FOUND');
  db.transaction(() => {
    db.prepare('DELETE FROM marriages WHERE user_low = ? AND user_high = ?').run(low, high);
    db.prepare('DELETE FROM marriage_proposals WHERE proposer_id IN (?, ?) OR target_id IN (?, ?)')
      .run(low, high, low, high);
  })();
}

export function claimBond(userId: string, timestamp = Date.now()): { points: number; level: number; nextAt: number } {
  const cooldownMs = 24 * 60 * 60 * 1000;
  return db.transaction(() => {
    const marriage = db.prepare('SELECT user_low, user_high, bond_points, last_bond_claim_at FROM marriages WHERE user_low = ? OR user_high = ?')
      .get(userId, userId) as { user_low: string; user_high: string; bond_points: number; last_bond_claim_at: number | null } | undefined;
    if (!marriage) throw new Error('MARRIAGE_NOT_FOUND');
    if (marriage.last_bond_claim_at !== null && marriage.last_bond_claim_at + cooldownMs > timestamp) {
      throw Object.assign(new Error('COOLDOWN'), { availableAt: marriage.last_bond_claim_at + cooldownMs });
    }
    const points = marriage.bond_points + 10;
    if (!Number.isSafeInteger(points)) throw new Error('BOND_LIMIT');
    db.prepare('UPDATE marriages SET bond_points = ?, last_bond_claim_at = ? WHERE user_low = ? AND user_high = ?')
      .run(points, timestamp, marriage.user_low, marriage.user_high);
    return { points, level: Math.floor(points / 100) + 1, nextAt: timestamp + cooldownMs };
  })();
}
