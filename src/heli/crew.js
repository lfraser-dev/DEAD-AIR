// DEAD AIR: your crew. Some of the survivors you bring back offer to join up (they wait at the bases). Each has a job,
// rides up front (the helmet shows the job) and takes a seat from the survivors. Recruit and dismiss them from the TEAM
// screen (T, when you're landed at a base).
export const ROLES = {
  gunner: { n: 'GUNNER', col: [0.9, 0.2, 0.15], d: 'Mans a spare door gun (a rifle if none is fitted). Door guns fire faster.' },
  mechanic: { n: 'MECHANIC', col: [1, 0.55, 0.1], d: 'Patches the hull while you fly. Repairs at bases go faster.' },
  medic: { n: 'MEDIC', col: [0.95, 0.95, 0.95], d: 'Survivors sent for fuel are half as likely to die. +25% scrap for survivors.' },
  scavenger: { n: 'SCAVENGER', col: [0.3, 0.85, 0.3], d: 'Goes on fuel runs too: brings back a lot more fuel and nearly always comes back.' },
  lookout: { n: 'LOOKOUT', col: [0.3, 0.6, 1], d: 'Marks spitters and brutes on screen, and shouts when acid is coming (less acid damage).' },
};
export const ROLE_IDS = Object.keys(ROLES);
export const has = (crew, role) => crew.some((c) => c.role === role);
export const count = (crew, role) => crew.filter((c) => c.role === role).length;
