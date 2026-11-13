export type HarvestEventKind = 'neutral' | 'positive' | 'negative';

export interface HarvestEvent {
  id: string;
  name: string;
  description: string;
  kind: HarvestEventKind;
  yieldMultiplier: number;
  weight: number;
}

const EVENTS: HarvestEvent[] = [
  {
    id: 'normal_harvest',
    name: 'Panen Normal',
    description: 'Cuaca bersahabat. Hasil panen sesuai perkiraan.',
    kind: 'neutral',
    yieldMultiplier: 1,
    weight: 70,
  },
  {
    id: 'blessed_rain',
    name: 'Hujan Berkah',
    description: 'Hujan membuat tanaman tumbuh subur. Hasil panen bertambah 20%.',
    kind: 'positive',
    yieldMultiplier: 1.2,
    weight: 10,
  },
  {
    id: 'abundant_harvest',
    name: 'Panen Melimpah',
    description: 'Tandan tumbuh lebih lebat. Hasil panen bertambah 35%.',
    kind: 'positive',
    yieldMultiplier: 1.35,
    weight: 8,
  },
  {
    id: 'pest_attack',
    name: 'Serangan Hama',
    description: 'Sebagian tanaman terserang hama. Hasil panen berkurang 25%.',
    kind: 'negative',
    yieldMultiplier: 0.75,
    weight: 6,
  },
  {
    id: 'drought',
    name: 'Musim Kering',
    description: 'Tanaman kekurangan air. Hasil panen berkurang 40%.',
    kind: 'negative',
    yieldMultiplier: 0.6,
    weight: 4,
  },
  {
    id: 'partial_crop_failure',
    name: 'Gagal Panen Sebagian',
    description: 'Sebagian besar hasil rusak. Hasil panen berkurang 60%, tetapi kebun tetap bisa dipanen kembali.',
    kind: 'negative',
    yieldMultiplier: 0.4,
    weight: 2,
  },
];

const TOTAL_WEIGHT = EVENTS.reduce((total, event) => total + event.weight, 0);

export function resolveHarvestEvent(random: () => number = Math.random): HarvestEvent {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error('INVALID_RANDOM_VALUE');
  }

  let threshold = sample * TOTAL_WEIGHT;
  for (const event of EVENTS) {
    if (threshold < event.weight) return { ...event };
    threshold -= event.weight;
  }

  return { ...EVENTS[0]! };
}

export function getHarvestEventTable(): HarvestEvent[] {
  return EVENTS.map((event) => ({ ...event }));
}
