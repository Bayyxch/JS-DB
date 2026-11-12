import { describe, expect, it } from 'vitest';
import { calculateLandExpansionCost, randomIntInclusive } from '../src/utils/economy.js';

describe('economy formulas', () => {
  it('keeps the first land expansion at the configured base cost', () => {
    expect(calculateLandExpansionCost(4, 4, 12000, 1.32)).toBe(12000);
  });

  it('increases land cost non-linearly', () => {
    const first = calculateLandExpansionCost(4, 4, 12000, 1.32);
    const second = calculateLandExpansionCost(5, 4, 12000, 1.32);
    const third = calculateLandExpansionCost(6, 4, 12000, 1.32);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });

  it('never produces a value below one for a zero base cost', () => {
    expect(calculateLandExpansionCost(4, 4, 0, 1.32)).toBe(1);
  });

  it('rejects invalid land configuration and unsafe costs', () => {
    expect(() => calculateLandExpansionCost(-1, 4, 12000, 1.32)).toThrow('INVALID_LAND_CONFIG');
    expect(() => calculateLandExpansionCost(4, 4, 12000, 1)).toThrow('INVALID_LAND_CONFIG');
    expect(() => calculateLandExpansionCost(1000, 4, 12000, 10)).toThrow('LAND_COST_LIMIT');
  });

  it('generates an inclusive deterministic range', () => {
    expect(randomIntInclusive(6, 8, () => 0)).toBe(6);
    expect(randomIntInclusive(6, 8, () => 0.999999)).toBe(8);
  });

  it('rejects invalid ranges and random samples', () => {
    expect(() => randomIntInclusive(8, 6)).toThrow('INVALID_RANGE');
    expect(() => randomIntInclusive(1, Number.MAX_SAFE_INTEGER)).toThrow('INVALID_RANGE');
    expect(() => randomIntInclusive(1, 2, () => 1)).toThrow('INVALID_RANDOM_VALUE');
    expect(() => randomIntInclusive(1, 2, () => Number.NaN)).toThrow('INVALID_RANDOM_VALUE');
  });
});
