import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userA = '11111111111111111';
const userB = '22222222222222222';
const userC = '33333333333333333';
const userD = '44444444444444444';
let databasePath = '';
let db!: { close: () => void };
let ensureUser!: (id: string, username: string) => void;
let social!: typeof import('../src/services/social.service.js');

beforeAll(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-social-'));
  databasePath = path.join(directory, 'test.sqlite');
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', databasePath);

  const database = await import('../src/db/database.js');
  db = database.db;
  database.runMigrations();
  ({ ensureUser } = await import('../src/services/economy.service.js'));
  social = await import('../src/services/social.service.js');

  ensureUser(userA, 'PlayerA');
  ensureUser(userB, 'PlayerB');
  ensureUser(userC, 'PlayerC');
  ensureUser(userD, 'PlayerD');
});

afterAll(() => {
  db?.close();
  vi.unstubAllEnvs();
  if (databasePath) {
    fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
  }
});

describe('global player profiles and friendships', () => {
  it('creates a profile view for an existing global player', () => {
    const profile = social.getPlayerProfile(userA);
    expect(profile?.username).toBe('PlayerA');
    expect(profile?.bio).toBe('');
    expect(profile?.friend_count).toBe(0);
  });

  it('stores and enforces the 160 character bio limit', () => {
    expect(social.setPlayerBio(userA, 'Petani sawit')).toBe('Petani sawit');
    expect(social.getPlayerProfile(userA)?.bio).toBe('Petani sawit');
    expect(() => social.setPlayerBio(userA, 'x'.repeat(161))).toThrow('BIO_TOO_LONG');
  });

  it('requires an accepted request before adding a friendship', () => {
    social.sendFriendRequest(userA, userB);
    expect(social.listFriends(userA)).toHaveLength(0);
    expect(social.listIncomingFriendRequests(userB)).toHaveLength(1);
    social.acceptFriendRequest(userB, userA);
    expect(social.listFriends(userA)).toHaveLength(1);
    expect(social.listFriends(userB)).toHaveLength(1);
    expect(social.getPlayerProfile(userA)?.friend_count).toBe(1);
  });

  it('rejects self requests, duplicate friendships, and duplicate pending requests', () => {
    expect(() => social.sendFriendRequest(userA, userA)).toThrow('FRIEND_SELF');
    expect(() => social.sendFriendRequest(userA, userB)).toThrow('ALREADY_FRIENDS');
    social.removeFriend(userA, userB);
    social.sendFriendRequest(userA, userB);
    expect(() => social.sendFriendRequest(userA, userB)).toThrow('FRIEND_REQUEST_PENDING');
    expect(() => social.sendFriendRequest(userB, userA)).toThrow('FRIEND_REQUEST_RECEIVED');
  });

  it('declines and removes friendships without leaving stale requests', () => {
    social.declineFriendRequest(userB, userA);
    expect(social.listIncomingFriendRequests(userB)).toHaveLength(0);
    social.sendFriendRequest(userA, userB);
    social.acceptFriendRequest(userB, userA);
    social.removeFriend(userB, userA);
    expect(social.listFriends(userA)).toHaveLength(0);
    expect(() => social.removeFriend(userA, userB)).toThrow('FRIEND_NOT_FOUND');
  });
});

describe('global game-partner progression', () => {
  it('requires acceptance, prevents multiple partners, and tracks shared bond cooldown', () => {
    social.sendMarriageProposal(userC, userD);
    expect(() => social.sendMarriageProposal(userC, userD)).toThrow('MARRIAGE_PROPOSAL_PENDING');
    expect(() => social.sendMarriageProposal(userD, userC)).toThrow('MARRIAGE_PROPOSAL_RECEIVED');

    social.acceptMarriageProposal(userD, userC);
    expect(social.getMarriage(userC)?.partner_id).toBe(userD);
    expect(social.getMarriage(userD)?.partner_id).toBe(userC);
    expect(() => social.sendMarriageProposal(userA, userC)).toThrow('MARRIAGE_ALREADY_MARRIED');

    const now = 1_800_000_000_000;
    const claim = social.claimBond(userC, now);
    expect(claim.points).toBe(10);
    expect(claim.level).toBe(1);
    expect(() => social.claimBond(userD, now + 1)).toThrow('COOLDOWN');
    expect(social.getMarriage(userD)?.bond_points).toBe(10);

    social.divorce(userD);
    expect(social.getMarriage(userC)).toBeUndefined();
    expect(() => social.claimBond(userC, now + 86_400_001)).toThrow('MARRIAGE_NOT_FOUND');
  });

  it('declines a proposal and rejects divorce without a partner', () => {
    social.sendMarriageProposal(userA, userB);
    social.declineMarriageProposal(userB, userA);
    expect(() => social.acceptMarriageProposal(userB, userA)).toThrow('MARRIAGE_PROPOSAL_NOT_FOUND');
    expect(() => social.divorce(userA)).toThrow('MARRIAGE_NOT_FOUND');
  });
});
