import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';

const ownerId = '66666666666666666';
const memberId = '77777777777777777';
const otherId = '88888888888888888';
let databasePath = '';
let db!: InstanceType<typeof Database>;
let family!: typeof import('../src/services/family.service.js');
let ensureUser!: (id: string, username: string) => void;

beforeAll(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-family-'));
  databasePath = path.join(directory, 'test.sqlite');
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', databasePath);
  const database = await import('../src/db/database.js');
  db = database.db;
  database.runMigrations();
  family = await import('../src/services/family.service.js');
  ({ ensureUser } = await import('../src/services/economy.service.js'));
  ensureUser(ownerId, 'FamilyOwner');
  ensureUser(memberId, 'FamilyMember');
  ensureUser(otherId, 'OtherPlayer');
});

afterAll(() => {
  db?.close();
  vi.unstubAllEnvs();
  if (databasePath) fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
});

describe('global family cooperatives', () => {
  it('creates a family and requires invitation acceptance', () => {
    const created = family.createFamily(ownerId, 'Sawit Bersatu');
    expect(created.member_count).toBe(1);
    family.inviteFamilyMember(ownerId, memberId);
    expect(family.listFamilyInvites(memberId)).toHaveLength(1);
    expect(family.getFamily(memberId)).toBeUndefined();
    family.acceptFamilyInvite(memberId, created.id);
    expect(family.getFamily(memberId)?.member_count).toBe(2);
    expect(family.getFamilyMembers(ownerId)).toHaveLength(2);
  });

  it('enforces owner permissions and safe leadership transfer', () => {
    expect(() => family.leaveFamily(ownerId)).toThrow('FAMILY_TRANSFER_FIRST');
    expect(() => family.inviteFamilyMember(memberId, otherId)).toThrow('FAMILY_OWNER_ONLY');
    family.inviteFamilyMember(ownerId, otherId);
    const invite = family.listFamilyInvites(otherId)[0];
    expect(invite).toBeDefined();
    family.acceptFamilyInvite(otherId, invite!.family_id);
    family.transferFamilyOwnership(ownerId, memberId);
    expect(family.getFamily(ownerId)?.owner_id).toBe(memberId);
    expect(() => family.kickFamilyMember(ownerId, otherId)).toThrow('FAMILY_OWNER_ONLY');
    family.kickFamilyMember(memberId, otherId);
    expect(family.getFamily(otherId)).toBeUndefined();
    family.kickFamilyMember(memberId, ownerId);
    expect(family.getFamily(ownerId)).toBeUndefined();
    family.leaveFamily(memberId);
    expect(family.getFamily(memberId)).toBeUndefined();
  });

  it('validates names and prevents duplicate membership', () => {
    expect(() => family.createFamily(ownerId, 'x')).toThrow('FAMILY_INVALID_NAME');
    expect(() => family.createFamily(memberId, 'Invalid!Name')).toThrow('FAMILY_INVALID_NAME');
    expect(() => family.acceptFamilyInvite(memberId, 999)).toThrow('FAMILY_ALREADY_MEMBER');
  });
});
