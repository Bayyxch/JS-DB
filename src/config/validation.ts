export interface EconomyConfigForValidation {
  startingBalance: number;
  startingSeeds: number;
  startingPlots: number;
  basicSeedPrice: number;
  basicGrowSeconds: number;
  basicMinYield: number;
  basicMaxYield: number;
  tbsSellPrice: number;
  firstLandCost: number;
  landCostMultiplier: number;
  maxPlots: number;
  workMinReward: number;
  workMaxReward: number;
  workCooldownMinutes: number;
  dailyReward: number;
  dailyCooldownHours: number;
}

function requireSafeInteger(name: string, value: number, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe integer greater than or equal to ${minimum}`);
  }
}

export function validateEconomyConfig(economy: EconomyConfigForValidation): void {
  const integerRules: Array<[string, number, number]> = [
    ['STARTING_BALANCE', economy.startingBalance, 0],
    ['STARTING_SEEDS', economy.startingSeeds, 0],
    ['STARTING_PLOTS', economy.startingPlots, 1],
    ['BASIC_SEED_PRICE', economy.basicSeedPrice, 1],
    ['BASIC_GROW_SECONDS', economy.basicGrowSeconds, 1],
    ['BASIC_MIN_YIELD', economy.basicMinYield, 1],
    ['BASIC_MAX_YIELD', economy.basicMaxYield, 1],
    ['TBS_SELL_PRICE', economy.tbsSellPrice, 0],
    ['FIRST_LAND_COST', economy.firstLandCost, 1],
    ['MAX_PLOTS', economy.maxPlots, 1],
    ['WORK_MIN_REWARD', economy.workMinReward, 0],
    ['WORK_MAX_REWARD', economy.workMaxReward, 0],
    ['WORK_COOLDOWN_MINUTES', economy.workCooldownMinutes, 1],
    ['DAILY_REWARD', economy.dailyReward, 1],
    ['DAILY_COOLDOWN_HOURS', economy.dailyCooldownHours, 1],
  ];

  for (const [name, value, minimum] of integerRules) {
    requireSafeInteger(name, value, minimum);
  }

  if (economy.basicMinYield > economy.basicMaxYield) {
    throw new Error('BASIC_MIN_YIELD cannot be greater than BASIC_MAX_YIELD');
  }
  if (economy.workMinReward > economy.workMaxReward) {
    throw new Error('WORK_MIN_REWARD cannot be greater than WORK_MAX_REWARD');
  }
  if (economy.startingPlots > economy.maxPlots) {
    throw new Error('STARTING_PLOTS cannot exceed MAX_PLOTS');
  }
  if (!Number.isFinite(economy.landCostMultiplier) || economy.landCostMultiplier <= 1) {
    throw new Error('LAND_COST_MULTIPLIER must be a finite number greater than 1');
  }

  const lastExpansionExponent = Math.max(0, economy.maxPlots - economy.startingPlots - 1);
  const lastExpansionCost = Math.round(
    economy.firstLandCost * Math.pow(economy.landCostMultiplier, lastExpansionExponent),
  );
  if (!Number.isSafeInteger(lastExpansionCost)) {
    throw new Error('Land expansion cost exceeds the safe integer limit; reduce MAX_PLOTS or LAND_COST_MULTIPLIER');
  }
}

export function validatePrefix(prefix: string): void {
  if (prefix.length < 1 || prefix.length > 5 || /\s/.test(prefix)) {
    throw new Error('PREFIX must contain 1 to 5 non-whitespace characters');
  }
}
