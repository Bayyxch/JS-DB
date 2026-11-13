import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const owner = '77777777777777777';
const member = '88888888888888888';
const third = '99999999999999999';
let database!: { close: () => void; prepare: (sql: string) => { run: (...args: unknown[]) => void } };
let tempDirectory = '';
let companies!: typeof import('../src/services/company.service.js');
let economy!: typeof import('../src/services/economy.service.js');

beforeAll(async () => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-company-'));
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', path.join(tempDirectory, 'test.sqlite'));
  const databaseModule = await import('../src/db/database.js');
  database = databaseModule.db as unknown as typeof database;
  databaseModule.runMigrations();
  companies = await import('../src/services/company.service.js');
  economy = await import('../src/services/economy.service.js');
  economy.ensureUser(owner, 'Owner');
  economy.ensureUser(member, 'Member');
  economy.ensureUser(third, 'Third');
});

afterAll(() => {
  database?.close();
  vi.unstubAllEnvs();
  if (tempDirectory) fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('global cooperative companies', () => {
  it('creates a company and enforces one company per player', () => {
    const company = companies.createCompany(owner, 'Sawit Bersatu');
    expect(company.name).toBe('Sawit Bersatu');
    expect(company.member_count).toBe(1);
    expect(() => companies.createCompany(owner, 'Another Farm')).toThrow('COMPANY_ALREADY_MEMBER');
    expect(() => companies.createCompany(member, 'sAwIt BeRsAtU')).toThrow('COMPANY_NAME_TAKEN');
  });

  it('requires an owner invite and acceptance to join', () => {
    const company = companies.getUserCompany(owner)!;
    companies.inviteToCompany(owner, member);
    expect(companies.listCompanyInvites(member)).toHaveLength(1);
    expect(() => companies.inviteToCompany(member, third)).toThrow('COMPANY_NOT_FOUND');
    const joined = companies.acceptCompanyInvite(member, company.id);
    expect(joined.member_count).toBe(2);
    expect(() => companies.inviteToCompany(member, third)).toThrow('COMPANY_OWNER_ONLY');
    expect(() => companies.acceptCompanyInvite(member, company.id)).toThrow('COMPANY_ALREADY_MEMBER');
    expect(() => companies.inviteToCompany(owner, owner)).toThrow('COMPANY_INVITE_SELF');
  });

  it('tracks member harvests in shared cooperative progression', () => {
    economy.buyItem(member, 'seed_corn', 1);
    economy.plant(member, 'corn', 1);
    database.prepare('UPDATE farm_plots SET planted_at = ? WHERE user_id = ? AND crop_id = ?')
      .run(Date.now() - 100_000_000, member, 'corn');
    const harvested = economy.harvest(member);
    const company = companies.getUserCompany(member)!;
    expect(company.total_harvested).toBe(harvested.items.find((item) => item.itemId === 'corn')?.quantity);
    expect(company.level).toBe(1);
  });

  it('transfers ownership, allows leaving, and disbands cleanly', () => {
    companies.transferCompanyOwnership(owner, member);
    expect(companies.getUserCompany(member)?.owner_id).toBe(member);
    companies.leaveCompany(owner);
    expect(companies.getUserCompany(owner)).toBeUndefined();
    expect(() => companies.leaveCompany(member)).toThrow('COMPANY_OWNER_TRANSFER_REQUIRED');
    companies.disbandCompany(member);
    expect(companies.getUserCompany(member)).toBeUndefined();
    expect(companies.getCompanyLeaderboard()).toHaveLength(0);
  });
});
