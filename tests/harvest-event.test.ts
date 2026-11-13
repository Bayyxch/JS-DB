import { describe, expect, it } from 'vitest';
import { getHarvestEventTable, resolveHarvestEvent } from '../src/services/harvest-event.service.js';

describe('harvest event system', () => {
  it('keeps event weights at 100 percent', () => {
    expect(getHarvestEventTable().reduce((sum, event) => sum + event.weight, 0)).toBe(100);
  });

  it('returns a normal harvest for the first 70 percent', () => {
    expect(resolveHarvestEvent(() => 0).id).toBe('normal_harvest');
    expect(resolveHarvestEvent(() => 0.6999).id).toBe('normal_harvest');
  });

  it('can resolve positive and negative events at their weighted boundaries', () => {
    expect(resolveHarvestEvent(() => 0.7).id).toBe('blessed_rain');
    expect(resolveHarvestEvent(() => 0.8).id).toBe('abundant_harvest');
    expect(resolveHarvestEvent(() => 0.88).id).toBe('pest_attack');
    expect(resolveHarvestEvent(() => 0.94).id).toBe('drought');
    expect(resolveHarvestEvent(() => 0.98).id).toBe('partial_crop_failure');
  });

  it('does not mutate the internal event definitions', () => {
    const event = resolveHarvestEvent(() => 0);
    event.name = 'Changed';
    expect(resolveHarvestEvent(() => 0).name).toBe('Panen Normal');
  });

  it('rejects invalid random samples', () => {
    expect(() => resolveHarvestEvent(() => -0.1)).toThrow('INVALID_RANDOM_VALUE');
    expect(() => resolveHarvestEvent(() => 1)).toThrow('INVALID_RANDOM_VALUE');
    expect(() => resolveHarvestEvent(() => Number.NaN)).toThrow('INVALID_RANDOM_VALUE');
  });
});
