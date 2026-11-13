import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const a = '11111111111111111';
const b = '22222222222222222';
const c = '33333333333333333';
const d = '44444444444444444';
const e = '55555555555555555';
let database!: { close: () => void };
let ensureUser!: (id: string, username: string) => void;
let social!: typeof import('../src/services/social.service.js');

beforeAll(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-marriage-'));
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', path.join(directory, 'test.sqlite'));
  const databaseModule = await import('../src/db/database.js');
  database = databaseModule.db;
  databaseModule.runMigrations();
  ({ ensureUser } = await import('../src/services/economy.service.js'));
  social = await import('../src/services/social.service.js');
  ensureUser(a, 'PlayerA');
  ensureUser(b, 'PlayerB');
  ensureUser(c, 'PlayerC');
  ensureUser(d, 'PlayerD');
  ensureUser(e, 'PlayerE');
});

afterAll(() => {
  database?.close();
  vi.unstubAllEnvs();
});

describe('global game partner and bond progression', () => {
  it('requires proposal acceptance before creating a pair', () => {
    social.sendMarriageProposal(a, b);
    expect(social.getMarriage(a)).toBeUndefined();
    expect(() => social.sendMarriageProposal(a, b)).toThrow('MARRIAGE_PROPOSAL_PENDING');
    expect(() => social.sendMarriageProposal(b, a)).toThrow('MARRIAGE_PROPOSAL_RECEIVED');
    social.acceptMarriageProposal(b, a);
    expect(social.getMarriage(a)?.partner_id).toBe(b);
    expect(social.getMarriage(b)?.partner_id).toBe(a);
  });

  it('prevents self proposals and a player having multiple partners', () => {
    expect(() => social.sendMarriageProposal(c, c)).toThrow('MARRIAGE_SELF');
    expect(() => social.sendMarriageProposal(a, c)).toThrow('MARRIAGE_ALREADY_MARRIED');
    expect(social.getMarriage(c)).toBeUndefined();
  });

  it('allows one shared bond claim per 24 hours', () => {
    const first = social.claimBond(a, 1_800_000_000_000);
    expect(first.points).toBe(10);
    expect(first.level).toBe(1);
    expect(() => social.claimBond(b, 1_800_000_000_001)).toThrow('COOLDOWN');
    const second = social.claimBond(b, 1_800_000_000_000 + 24 * 60 * 60 * 1000);
    expect(second.points).toBe(20);
  });

  it('declines proposals and clears a pair on divorce', () => {
    social.sendMarriageProposal(d, e);
    social.declineMarriageProposal(e, d);
    expect(() => social.acceptMarriageProposal(e, d)).toThrow('MARRIAGE_PROPOSAL_NOT_FOUND');
    social.divorce(b);
    expect(social.getMarriage(a)).toBeUndefined();
    expect(social.getMarriage(b)).toBeUndefined();
    expect(() => social.divorce(a)).toThrow('MARRIAGE_NOT_FOUND');
  });
});
