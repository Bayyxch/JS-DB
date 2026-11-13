export interface WorldEvent {
  id: string;
  name: string;
  description: string;
  harvestBonus: number;
  expeditionBonus: number;
  petCostMultiplier: number;
}

const EVENTS: WorldEvent[] = [
  {
    id: 'harvest_festival',
    name: 'Festival Panen Raya',
    description: 'Semua panen mendapatkan bonus +1 hasil per plot.',
    harvestBonus: 1,
    expeditionBonus: 0,
    petCostMultiplier: 1,
  },
  {
    id: 'exploration_week',
    name: 'Pekan Penjelajah',
    description: 'Ekspedisi membawa pulang satu resource tambahan.',
    harvestBonus: 0,
    expeditionBonus: 1,
    petCostMultiplier: 1,
  },
  {
    id: 'pet_festival',
    name: 'Festival Sahabat Hewan',
    description: 'Adopsi hewan peliharaan mendapatkan potongan biaya 20%.',
    harvestBonus: 0,
    expeditionBonus: 0,
    petCostMultiplier: 0.8,
  },
];

export function getCurrentEvent(timestamp = Date.now()): WorldEvent {
  const weekIndex = Math.floor(timestamp / (7 * 24 * 60 * 60 * 1000));
  return EVENTS[((weekIndex % EVENTS.length) + EVENTS.length) % EVENTS.length]!;
}

export function getWorldEvents(): WorldEvent[] {
  return [...EVENTS];
}
