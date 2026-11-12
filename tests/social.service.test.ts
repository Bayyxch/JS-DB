import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userA = '11111111111111111';
const userB = '22222222222222222';
let databasePath = '';
let db: { close: () => void };
let ensureUser: (id: string, username: string) => void;
let social: typeof import('../src/services/social.service.js');

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
