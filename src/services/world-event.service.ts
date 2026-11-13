export interface WorldEvent {
  id: string;
  name: string;
  description: string;
  harvestMultiplier: number;
  adventureMultiplier: number;
  petXpMultiplier: number;
}

const EVENTS: WorldEvent[] = [
  {
    id: 'harvest_festival',
    name: 'Festival Panen',
    description: 'Hasil panen meningkat 10% untuk semua pemain.',
    harvestMultiplier: 1.1,
    adventureMultiplier: 1,
    petXpMultiplier: 1,
  },
  {
    id: 'adventure_week',
    name: 'Pekan Penjelajah',
    description: 'Hadiah SawitCoin dari petualangan meningkat 10%.',
    harvestMultiplier: 1,
    adventureMultiplier: 1.1,
    petXpMultiplier: 1,
  },
  {
    id: 'pet_parade',
    name: 'Festival Sahabat',
    description: 'Pakan memberikan 50% XP hewan peliharaan tambahan.',
    harvestMultiplier: 1,
    adventureMultiplier: 1,
    petXpMultiplier: 1.5,
  },
];

export function getCurrentWorldEvent(timestamp = Date.now()): WorldEvent {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new Error('INVALID_TIMESTAMP');
  const day = Math.floor(timestamp / 86_400_000);
  return EVENTS[day % EVENTS.length]!;
}

export function getWorldEventCycle(): WorldEvent[] {
  return EVENTS.map((event) => ({ ...event }));
}
