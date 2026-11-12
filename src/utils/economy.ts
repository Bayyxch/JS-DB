export function calculateLandExpansionCost(
  currentPlots: number,
  startingPlots: number,
  firstCost: number,
  multiplier: number,
): number {
  if (
    !Number.isSafeInteger(currentPlots) ||
    !Number.isSafeInteger(startingPlots) ||
    !Number.isSafeInteger(firstCost) ||
    !Number.isFinite(multiplier) ||
    currentPlots < 0 ||
    startingPlots < 0 ||
    firstCost < 0 ||
    multiplier <= 1
  ) {
    throw new Error('INVALID_LAND_CONFIG');
  }

  const exponent = Math.max(0, currentPlots - startingPlots);
  const cost = Math.round(firstCost * Math.pow(multiplier, exponent));
  if (!Number.isSafeInteger(cost)) throw new Error('LAND_COST_LIMIT');
  return Math.max(1, cost);
}

export function randomIntInclusive(min: number, max: number, random = Math.random): number {
  if (
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(max) ||
    min > max ||
    !Number.isSafeInteger(max - min + 1)
  ) {
    throw new Error('INVALID_RANGE');
  }

  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error('INVALID_RANDOM_VALUE');
  }

  return min + Math.floor(sample * (max - min + 1));
}
