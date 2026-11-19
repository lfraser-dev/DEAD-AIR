// DEAD AIR (build 0.75): the helicopter's upgrades, paint jobs and the save file.
//
// Every upgrade has tiers. You buy them in order with SCRAP (earned on missions), and can fit any tier you own.
// Every tier changes how the helicopter looks (see chopper.js), not just its numbers.

export const SLOTS = [
  { id: 'gun', name: 'NOSE GUN', icon: '⁂', tiers: [
    { n: 'CHAIN GUN', cost: 0, d: 'One barrel under the nose. Reliable.' },
    { n: 'ROTARY MINIGUN', cost: 600, d: 'Six spinning barrels. Way faster fire.' },
    { n: 'TWIN MINIGUNS', cost: 1800, d: 'Two miniguns side by side. Shreds hordes.' },
    { n: 'PLASMA CANNON', cost: 4200, d: 'Glowing bolts that blow up on hit. Barely heats up.' },
    { n: 'RAILGUN', cost: 7000, d: 'A blue beam that goes straight through every zombie in a line.' },
    { n: 'LASER', cost: 11000, d: 'Hold to burn a red laser through anything. Melts hordes.' },
  ] },
  { id: 'rockets', name: 'ROCKETS', icon: '➶', tiers: [
    { n: 'NONE', cost: 0, d: 'No rocket pods fitted.' },
    { n: 'ROCKET PODS', cost: 400, d: 'Two pods on the stub wings. 8 rockets.' },
    { n: 'QUAD PODS', cost: 1400, d: 'Four pods. 16 rockets, bigger blasts.' },
    { n: 'HELLFIRE RAILS', cost: 3200, d: 'Missiles that home in on the biggest zombie near your crosshair.' },
    { n: 'SWARM PODS', cost: 6500, d: 'Each shot fires 6 mini missiles that pick their own targets.' },
  ] },
  { id: 'bombs', name: 'BOMB BAY', icon: '●', tiers: [
    { n: 'NONE', cost: 0, d: 'No bombs.' },
    { n: 'FIRE BOMBS', cost: 700, d: 'Drop with SPACE. The street burns for a while.' },
    { n: 'CLUSTER BOMBS', cost: 2000, d: 'Each bomb splits into six. Clears whole streets.' },
    { n: 'NAPALM', cost: 4500, d: 'Barrels of napalm. A huge sea of fire that burns for ages.' },
    { n: 'MINI NUKE', cost: 12000, d: 'Two per refill. A mushroom cloud that wipes out everything. Fly away fast!' },
  ] },
  { id: 'armor', name: 'ARMOUR', icon: '▣', tiers: [
    { n: 'STOCK HULL', cost: 0, d: 'Thin metal. Be careful.' },
    { n: 'BOLT-ON PLATES', cost: 500, d: 'Steel plates on the sides and nose. +60% health.' },
    { n: 'HEAVY ARMOUR', cost: 1500, d: 'Thick plates and a cage over the glass. +130% health.' },
    { n: 'FORTRESS', cost: 3600, d: 'Armour everywhere plus a nose ram. +220% health. Heavy!' },
    { n: 'TITANIUM', cost: 8000, d: 'Sleek black and gold plates. +300% health and much lighter.' },
  ] },
  { id: 'engine', name: 'ENGINE', icon: '✦', tiers: [
    { n: 'STOCK TURBINE', cost: 0, d: 'Gets you up there.' },
    { n: 'TURBO', cost: 500, d: 'Bigger exhausts. More lift and top speed.' },
    { n: 'TWIN TURBO', cost: 1500, d: 'Two turbines. A lot more of everything.' },
    { n: 'AFTERBURNER', cost: 3400, d: 'Hold SHIFT for a huge burst of speed.' },
    { n: 'JET TURBINES', cost: 8500, d: 'Two jet engines. Insane speed, insane afterburner.' },
  ] },
  { id: 'rotor', name: 'ROTOR', icon: '✳', tiers: [
    { n: '4 BLADES', cost: 0, d: 'The standard rotor.' },
    { n: '5 BLADES', cost: 800, d: 'Longer blades. Better lift and quicker turns.' },
    { n: 'COAXIAL', cost: 2600, d: 'Two rotors stacked up. Turns on the spot.' },
    { n: 'SHREDDER', cost: 6000, d: 'Armoured red-tipped blades. Walls can\'t hurt them and they chop zombies on roofs.' },
  ] },
  { id: 'door', name: 'DOOR GUNS', icon: '⌖', tiers: [
    { n: 'NONE', cost: 0, d: 'Empty doors.' },
    { n: 'DOOR GUNNER', cost: 900, d: 'A gunner in the right door shoots zombies by himself.' },
    { n: 'TWIN GUNNERS', cost: 2200, d: 'Gunners in both doors.' },
    { n: 'DOOR MINIGUNS', cost: 5000, d: 'Both gunners get spinning miniguns.' },
  ] },
  { id: 'fuel', name: 'FUEL TANKS', icon: '⛽', tiers: [
    { n: 'STANDARD TANK', cost: 0, d: 'About 5 minutes of flying.' },
    { n: 'SIDE TANKS', cost: 600, d: 'Tanks strapped to the sides. About 8 minutes.' },
    { n: 'FERRY TANKS', cost: 1800, d: 'Huge drop tanks on the wings. About 12 minutes.' },
    { n: 'FUEL RECYCLER', cost: 5500, d: 'Ferry tanks plus a glowing recycler: fuel slowly refills in the air.' },
  ] },
  { id: 'cabin', name: 'CABIN', icon: '♟', tiers: [
    { n: '4 SEATS', cost: 0, d: 'Carry 4 survivors at a time.' },
    { n: '8 SEATS', cost: 400, d: 'Side benches. Carry 8.' },
    { n: '12 SEATS', cost: 1200, d: 'Side pods bolted on. Carry 12.' },
    { n: '16 SEATS', cost: 3500, d: 'Bigger pods and a longer cabin. Carry 16.' },
  ] },
  { id: 'shield', name: 'SHIELD', icon: '◎', tiers: [
    { n: 'NONE', cost: 0, d: 'No shield.' },
    { n: 'SHIELD', cost: 1500, d: 'An energy bubble that soaks up hits and recharges.' },
    { n: 'BIG SHIELD', cost: 4000, d: 'Twice as strong, charges faster.' },
    { n: 'FORCE FIELD', cost: 9000, d: 'Huge and fast to recharge. Acid just bounces off.' },
  ] },
  { id: 'flares', name: 'FLARES', icon: '✺', tiers: [
    { n: 'NONE', cost: 0, d: 'No flares.' },
    { n: 'FLARE PODS', cost: 900, d: 'Press X: flares burn up acid and rubble flying at you. 4 shots.' },
    { n: 'MEGA FLARES', cost: 3000, d: '8 shots, and the flash stuns zombies near you for a few seconds.' },
  ] },
  { id: 'tail', name: 'TAIL GUN', icon: '⟲', tiers: [
    { n: 'NONE', cost: 0, d: 'Nothing covering your back.' },
    { n: 'TAIL GUN', cost: 1600, d: 'A turret under the tail that shoots zombies behind you.' },
    { n: 'TWIN TAIL GUN', cost: 4200, d: 'Two barrels, twice the bullets.' },
  ] },
  { id: 'winch', name: 'WINCH', icon: '⚓', tiers: [
    { n: 'NONE', cost: 0, d: 'No winch.' },
    { n: 'WINCH', cost: 1200, d: 'A crane arm on the door. Hook crates and load survivors from much higher up.' },
    { n: 'MAGNET', cost: 5000, d: 'Press M near zombies: the magnet grabs them. Press M again to drop them from high up!' },
  ] },
  { id: 'radar', name: 'RADAR', icon: '◉', tiers: [
    { n: 'NONE', cost: 0, d: 'No radar.' },
    { n: 'RADAR', cost: 800, d: 'A spinning dish. The map shows zombies much further away.' },
    { n: 'TARGETING RADAR', cost: 3000, d: 'Also marks spitters, brutes and titans on your screen with their health.' },
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
  for (const sl of SLOTS) { if (s.own[sl.id] == null) s.own[sl.id] = 0; if (s.eq[sl.id] == null) s.eq[sl.id] = 0; }
  return s;
}
export function saveSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

// what the fitted upgrades add up to
export function statsFor(eq) {
  const g = eq.gun, ar = eq.armor, en = eq.engine, ro = eq.rotor, v = (k) => eq[k] || 0;
  return {
    hp: Math.round(500 * [1, 1.6, 2.3, 3.2, 4][ar]),
    mass: [1, 1.06, 1.14, 1.26, 1.1][ar] + eq.rockets * 0.02 + eq.bombs * 0.02 + eq.cabin * 0.03 + v('fuel') * 0.03 + v('shield') * 0.02 + v('tail') * 0.02 + v('winch') * 0.02,
    lift: [1, 1.14, 1.28, 1.36, 1.5][en] * [1, 1.07, 1.12, 1.15][ro],
    speed: [1, 1.1, 1.2, 1.26, 1.45][en],
    agility: [1, 1.15, 1.35, 1.3][ro],
    boost: en >= 3, boostMul: en === 4 ? 1.7 : 1,
    shredder: ro === 3,
    gun: [
      { rate: 9, dmg: 22, spread: 0.010, heat: 0.035, cool: 0.45, barrels: 1 },
      { rate: 24, dmg: 16, spread: 0.016, heat: 0.016, cool: 0.4, barrels: 1, spin: true },
      { rate: 44, dmg: 16, spread: 0.018, heat: 0.011, cool: 0.4, barrels: 2, spin: true },
      { rate: 7, dmg: 70, spread: 0.004, heat: 0.03, cool: 0.6, barrels: 1, plasma: true, splash: 3.2 },
      { rate: 2.2, dmg: 420, spread: 0, heat: 0.16, cool: 0.5, barrels: 1, rail: true },
      { rate: 30, dmg: 13, spread: 0, heat: 0.007, cool: 0.5, barrels: 1, laser: true },
    ][g],
    rockets: [0, 8, 16, 12, 36][eq.rockets],
    rocketDmg: [0, 260, 340, 420, 150][eq.rockets],
    rocketR: [0, 6.5, 8, 8.5, 5][eq.rockets],
    homing: eq.rockets >= 3, swarm: eq.rockets === 4,
    bombs: [0, 4, 4, 4, 2][eq.bombs],
    cluster: eq.bombs === 2, napalm: eq.bombs === 3, nuke: eq.bombs === 4,
    gunners: Math.min(2, eq.door), doorMini: eq.door === 3,
    seats: [4, 8, 12, 16][eq.cabin],
    fuel: [100, 160, 240, 240][v('fuel')], recycle: v('fuel') === 3,
    crewMax: [2, 3, 4, 5][eq.cabin],
    shield: [0, 150, 300, 520][v('shield')], shieldRegen: [0, 18, 30, 50][v('shield')],
    flares: [0, 4, 8][v('flares')], megaFlare: v('flares') === 2,
    tail: v('tail'),
    winch: v('winch'), magnet: v('winch') === 2,
    radar: v('radar'),
  };
}
// 0..1 bars for the hangar
export function bars(eq) {
  const s = statsFor(eq), gun = s.gun.rate * s.gun.dmg * (s.gun.splash ? 2.2 : 1);
  return [
    ['ARMOUR', (s.hp + s.shield * 2) / 2600],
    ['FIREPOWER', Math.min(1, (gun * (s.gun.rail ? 2 : 1) + s.rockets * s.rocketDmg / 12 + s.gunners * 150 * (s.doorMini ? 2 : 1) + s.tail * 140 + s.bombs * 60 * (s.nuke ? 8 : 1)) / 2600)],
    ['SPEED', (s.speed * s.lift / s.mass - 0.7) / 0.9],
    ['HANDLING', (s.agility * s.lift / s.mass - 0.7) / 1.2],
    ['FUEL', s.fuel / 240],
    ['SEATS', s.seats / 16],
  ];
}
