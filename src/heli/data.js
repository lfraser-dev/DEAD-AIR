// DEAD AIR: the helicopter's upgrades, paint jobs and the save file.
//
// Every upgrade has tiers. You buy them in order with SCRAP (earned on missions), and can fit any tier you own.
// Every tier changes how the helicopter looks (see chopper.js), not just its numbers.

export const SLOTS = [
  { id: 'gun', name: 'NOSE GUN', icon: '⁂', tiers: [
    { n: 'CHAIN GUN', cost: 0, d: 'One barrel under the nose. Reliable.' },
    { n: 'ROTARY MINIGUN', cost: 350, d: 'Six spinning barrels. Way faster fire.' },
    { n: 'TWIN MINIGUNS', cost: 900, d: 'Two miniguns side by side. Shreds crowds.' },
    { n: 'AUTOCANNON', cost: 1900, d: '30 mm explosive shells. Blows piles apart.' },
  ] },
  { id: 'rockets', name: 'ROCKETS', icon: '➶', tiers: [
    { n: 'NONE', cost: 0, d: 'No rocket pods fitted.' },
    { n: 'ROCKET PODS', cost: 250, d: 'Two pods on the stub wings. 8 rockets.' },
    { n: 'QUAD PODS', cost: 800, d: 'Four pods. 16 rockets.' },
    { n: 'HELLFIRE RAILS', cost: 1700, d: 'Guided missiles: they fly to the biggest crowd near your crosshair.' },
  ] },
  { id: 'bombs', name: 'BOMB BAY', icon: '●', tiers: [
    { n: 'NONE', cost: 0, d: 'No bombs.' },
    { n: 'FIRE BOMBS', cost: 450, d: 'Drop with SPACE. The street burns for a while.' },
    { n: 'CLUSTER BOMBS', cost: 1100, d: 'Each bomb splits into six. Clears a street.' },
    { n: 'NAPALM', cost: 2200, d: 'Barrels of napalm. A huge sea of fire.' },
  ] },
  { id: 'armor', name: 'ARMOUR', icon: '▣', tiers: [
    { n: 'STOCK HULL', cost: 0, d: 'Thin metal. Be careful.' },
    { n: 'BOLT-ON PLATES', cost: 300, d: 'Steel plates on the sides and nose. +60% health.' },
    { n: 'HEAVY ARMOUR', cost: 900, d: 'Thick plates and a cage over the glass. +130% health.' },
    { n: 'FORTRESS', cost: 2000, d: 'Armour everywhere plus a nose ram. +220% health. Heavy!' },
  ] },
  { id: 'engine', name: 'ENGINE', icon: '✦', tiers: [
    { n: 'STOCK TURBINE', cost: 0, d: 'Gets you up there.' },
    { n: 'TURBO', cost: 300, d: 'Bigger exhausts. More lift and top speed.' },
    { n: 'TWIN TURBO', cost: 900, d: 'Two turbines. A lot more of everything.' },
    { n: 'AFTERBURNER', cost: 1900, d: 'Hold SHIFT for a burst of speed.' },
  ] },
  { id: 'rotor', name: 'ROTOR', icon: '✳', tiers: [
    { n: '4 BLADES', cost: 0, d: 'The standard rotor.' },
    { n: '5 BLADES', cost: 500, d: 'Longer blades. Better lift and quicker turns.' },
    { n: 'COAXIAL', cost: 1400, d: 'Two rotors stacked up. Turns on the spot.' },
  ] },
  { id: 'door', name: 'DOOR GUNS', icon: '⌖', tiers: [
    { n: 'NONE', cost: 0, d: 'Empty doors.' },
    { n: 'DOOR GUNNER', cost: 500, d: 'A gunner in the right door shoots zombies he can see.' },
    { n: 'TWIN GUNNERS', cost: 1200, d: 'Gunners in both doors.' },
    { n: 'DOOR MINIGUNS', cost: 2300, d: 'Both gunners get spinning miniguns.' },
  ] },
  { id: 'fuel', name: 'FUEL TANKS', icon: '⛽', tiers: [
    { n: 'STANDARD TANK', cost: 0, d: 'About 5 minutes of flying.' },
    { n: 'SIDE TANKS', cost: 350, d: 'Tanks strapped to the sides. About 8 minutes.' },
    { n: 'FERRY TANKS', cost: 1000, d: 'Big drop tanks on the wings. About 12 minutes.' },
  ] },
  { id: 'cabin', name: 'CABIN', icon: '♟', tiers: [
    { n: '4 SEATS', cost: 0, d: 'Carry 4 people (your team and survivors).' },
    { n: '8 SEATS', cost: 300, d: 'Side benches. Carry 8.' },
    { n: '12 SEATS', cost: 900, d: 'Side pods bolted on. Carry 12.' },
  ] },
  { id: 'winch', name: 'WINCH', icon: '⚓', tiers: [
    { n: 'NONE', cost: 0, d: 'People climb a rope ladder: you have to hover low.' },
    { n: 'RESCUE WINCH', cost: 600, d: 'A winch arm on the door: pick people up from 30 m up, out of reach of the piles.' },
    { n: 'CARGO HOOK', cost: 1300, d: 'Also hooks crates from high up, and lowers your team onto roofs without landing.' },
  ] },
  { id: 'flir', name: 'THERMAL CAMERA', icon: '◉', tiers: [
    { n: 'NONE', cost: 0, d: 'Just your eyes.' },
    { n: 'THERMAL CAMERA', cost: 500, d: 'A camera ball under the nose: zombies show on the map from far away.' },
    { n: 'THERMAL + MARKERS', cost: 1300, d: 'Marks screamers and piles on screen, and how many zombies are inside buildings.' },
  ] },
  { id: 'speaker', name: 'LOUDSPEAKER', icon: '♫', tiers: [
    { n: 'NONE', cost: 0, d: 'No speakers.' },
    { n: 'LOUDSPEAKER', cost: 450, d: 'Press V: a siren that drags every zombie nearby to where you are. Lead them away from your team!' },
  ] },
  { id: 'skids', name: 'SKIDS', icon: '⊥', tiers: [
    { n: 'PLAIN SKIDS', cost: 0, d: 'Easy to grab.' },
    { n: 'ANTI-CLIMB SKIDS', cost: 400, d: 'Spikes and greased bars: zombies can barely hang on.' },
  ] },
];
export const SLOT = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

// paint jobs: body colour, trim colour, a pattern, and the cost
export const PAINTS = [
  { id: 'olive', n: 'OLIVE', body: [0.3, 0.34, 0.22], trim: [0.16, 0.17, 0.13], cost: 0 },
  { id: 'night', n: 'NIGHT OPS', body: [0.12, 0.13, 0.15], trim: [0.05, 0.05, 0.06], cost: 0 },
  { id: 'arctic', n: 'ARCTIC', body: [0.82, 0.84, 0.86], trim: [0.3, 0.33, 0.36], cost: 150 },
  { id: 'desert', n: 'DESERT', body: [0.66, 0.55, 0.38], trim: [0.4, 0.31, 0.2], cost: 150 },
  { id: 'rescue', n: 'RESCUE', body: [0.85, 0.2, 0.12], trim: [0.92, 0.92, 0.9], cost: 300, stripe: [0.92, 0.92, 0.9] },
  { id: 'hazard', n: 'HAZARD', body: [0.95, 0.72, 0.08], trim: [0.08, 0.08, 0.08], cost: 500, stripe: [0.08, 0.08, 0.08] },
  { id: 'shark', n: 'SHARK MOUTH', body: [0.42, 0.46, 0.5], trim: [0.2, 0.22, 0.25], cost: 800, shark: true },
  { id: 'toxic', n: 'TOXIC', body: [0.2, 0.22, 0.2], trim: [0.35, 1, 0.2], cost: 1200, glow: [0.35, 1, 0.2], stripe: [0.35, 1, 0.2] },
  { id: 'gold', n: 'SOLID GOLD', body: [0.85, 0.64, 0.2], trim: [0.5, 0.36, 0.1], cost: 5000, mat: 'brass' },
  { id: 'dev', n: 'DEV: ROOT', body: [0.04, 0.05, 0.06], trim: [0.1, 1, 0.45], cost: 0, glow: [0.1, 1, 0.45], stripe: [0.1, 1, 0.45], dev: true },
];
export const PAINT = Object.fromEntries(PAINTS.map((p) => [p.id, p]));

const KEY = 'semifinals.deadair';
export function loadSave() {
  const s = { scrap: 0, own: {}, eq: {}, paints: ['olive', 'night'], paint: 'olive', flight: 'easy', invert: false, sens: 1, best: 0, runs: 0, titans: 0, rescued: 0, crew: [], pool: [], events: 0, name: '' };
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* ignore */ }
  for (const sl of SLOTS) {
    const top = sl.tiers.length - 1;
    s.own[sl.id] = Math.min(top, s.own[sl.id] ?? 0); s.eq[sl.id] = Math.min(s.own[sl.id], s.eq[sl.id] ?? 0);
  }
  for (const k of Object.keys(s.eq)) if (!SLOTS.some((sl) => sl.id === k)) { delete s.eq[k]; delete s.own[k]; }
  s.team = s.team || []; s.stash = s.stash || { medkit: 2, pistol: 0, smg: 0, shotgun: 0, rifle: 0, vest: 0, heavy: 0, pack: 0, grenade: 0 };
  if (s.seed == null) s.seed = 0;
  return s;
}
export function saveSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

// what the fitted upgrades add up to
export function statsFor(eq) {
  const v = (k, max) => Math.min(eq[k] || 0, max);
  const g = v('gun', 3), ar = v('armor', 3), en = v('engine', 3), ro = v('rotor', 2), rk = v('rockets', 3), bo = v('bombs', 3);
  return {
    hp: Math.round(500 * [1, 1.6, 2.3, 3.2][ar]),
    mass: [1, 1.06, 1.14, 1.26][ar] + rk * 0.02 + bo * 0.02 + v('cabin', 2) * 0.03 + v('fuel', 2) * 0.03 + v('winch', 2) * 0.02,
    lift: [1, 1.14, 1.28, 1.36][en] * [1, 1.07, 1.12][ro],
    speed: [1, 1.1, 1.2, 1.26][en],
    agility: [1, 1.15, 1.35][ro],
    boost: en === 3, boostMul: 1,
    gun: [
      { rate: 9, dmg: 22, spread: 0.010, heat: 0.035, cool: 0.45, barrels: 1 },
      { rate: 24, dmg: 16, spread: 0.016, heat: 0.016, cool: 0.4, barrels: 1, spin: true },
      { rate: 44, dmg: 16, spread: 0.018, heat: 0.011, cool: 0.4, barrels: 2, spin: true },
      { rate: 5, dmg: 90, spread: 0.006, heat: 0.05, cool: 0.5, barrels: 1, cannon: true, splash: 3.5 },
    ][g],
    rockets: [0, 8, 16, 12][rk], rocketDmg: [0, 260, 340, 420][rk], rocketR: [0, 6.5, 8, 8.5][rk], homing: rk === 3,
    bombs: [0, 4, 4, 4][bo], cluster: bo === 2, napalm: bo === 3,
    gunners: Math.min(2, v('door', 3)), doorMini: v('door', 3) === 3,
    seats: [4, 8, 12][v('cabin', 2)],
    fuel: [100, 160, 240][v('fuel', 2)],
    winch: v('winch', 2), hook: v('winch', 2) === 2,
    flir: v('flir', 2), speaker: v('speaker', 1), skidGuard: v('skids', 1) === 1,
    crewMax: [2, 3, 4][v('cabin', 2)],
  };
}
// 0..1 bars for the hangar
export function bars(eq) {
  const s = statsFor(eq), gun = s.gun.rate * s.gun.dmg * (s.gun.splash ? 2.2 : 1);
  return [
    ['ARMOUR', s.hp / 1600],
    ['FIREPOWER', Math.min(1, (gun + s.rockets * s.rocketDmg / 12 + s.gunners * 150 * (s.doorMini ? 2 : 1) + s.bombs * 60) / 1900)],
    ['SPEED', (s.speed * s.lift / s.mass - 0.7) / 0.9],
    ['HANDLING', (s.agility * s.lift / s.mass - 0.7) / 1.2],
    ['FUEL', s.fuel / 240],
    ['SEATS', s.seats / 12],
  ];
}
