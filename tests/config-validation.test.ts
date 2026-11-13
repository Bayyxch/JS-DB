import { describe, expect, it } from 'vitest';
import { validateEconomyConfig, validatePrefix, type EconomyConfigForValidation } from '../src/config/validation.js';

const validConfig: EconomyConfigForValidation = {
  startingBalance: 2500,
  startingSeeds: 8,
  startingPlots: 4,
  basicSeedPrice: 300,
  basicGrowSeconds: 30,
  basicMinYield: 6,
  basicMaxYield: 8,
  tbsSellPrice: 70,
  firstLandCost: 12000,
  landCostMultiplier: 1.32,
  maxPlots: 100,
  workMinReward: 100,
  workMaxReward: 180,
  workCooldownMinutes: 120,
  dailyReward: 250,
  dailyCooldownHours: 24,
};

describe('configuration validation', () => {
  it('accepts the documented default economy configuration', () => {
    expect(() => validateEconomyConfig(validConfig)).not.toThrow();
  });

  it('rejects negative or unsafe starting balances', () => {
    expect(() => validateEconomyConfig({ ...validConfig, startingBalance: -1 })).toThrow(/STARTING_BALANCE/);
    expect(() => validateEconomyConfig({ ...validConfig, startingBalance: Number.MAX_SAFE_INTEGER + 1 })).toThrow(/STARTING_BALANCE/);
  });

  it('rejects inconsistent crop yields', () => {
    expect(() => validateEconomyConfig({ ...validConfig, basicMinYield: 9, basicMaxYield: 8 })).toThrow(/BASIC_MIN_YIELD/);
  });

  it('rejects inconsistent work rewards', () => {
    expect(() => validateEconomyConfig({ ...validConfig, workMinReward: 200, workMaxReward: 100 })).toThrow(/WORK_MIN_REWARD/);
  });

  it('rejects invalid land settings and unsafe expansion costs', () => {
    expect(() => validateEconomyConfig({ ...validConfig, maxPlots: 3 })).toThrow(/MAX_PLOTS/);
    expect(() => validateEconomyConfig({ ...validConfig, landCostMultiplier: 1 })).toThrow(/LAND_COST_MULTIPLIER/);
    expect(() => validateEconomyConfig({ ...validConfig, landCostMultiplier: 10 })).toThrow(/safe integer limit/);
  });

  it('rejects malformed prefixes', () => {
    expect(() => validatePrefix('')).toThrow(/PREFIX/);
    expect(() => validatePrefix('too long')).toThrow(/PREFIX/);
    expect(() => validatePrefix('a b')).toThrow(/PREFIX/);
    expect(() => validatePrefix('!')).not.toThrow();
  });
});
