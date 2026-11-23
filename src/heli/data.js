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
    { n: 'TWIN 30MM', cost: 3800, d: 'Two 30 mm chain guns side by side. Twice the explosive shells.' },
  ] },
  { id: 'rockets', name: 'ROCKETS', icon: '➶', tiers: [
    { n: 'NONE', cost: 0, d: 'No rocket pods fitted.' },
    { n: 'ROCKET PODS', cost: 250, d: 'Two pods on the stub wings. 8 rockets.' },
    { n: 'QUAD PODS', cost: 800, d: 'Four pods. 16 rockets.' },
    { n: 'HELLFIRE RAILS', cost: 1700, d: 'Guided missiles: they fly to the biggest crowd near your crosshair.' },
    { n: 'APKWS PODS', cost: 3400, d: 'Laser-guided rockets: each click fires 6 and every one finds its own zombie. 36 of them.' },
  ] },
  { id: 'bombs', name: 'BOMB BAY', icon: '●', tiers: [
    { n: 'NONE', cost: 0, d: 'No bombs.' },
    { n: 'FIRE BOMBS', cost: 450, d: 'Drop with SPACE. The street burns for a while.' },
    { n: 'CLUSTER BOMBS', cost: 1100, d: 'Each bomb splits into six. Clears a street.' },
    { n: 'NAPALM', cost: 2200, d: 'Barrels of napalm. A huge sea of fire.' },
    { n: 'THERMOBARIC', cost: 6000, d: 'Two huge fuel-air bombs per refill. One fireball flattens a whole crowd. Don\'t drop it from low down.' },
  ] },
  { id: 'armor', name: 'ARMOUR', icon: '▣', tiers: [
    { n: 'STOCK HULL', cost: 0, d: 'Thin metal. Be careful.' },
    { n: 'BOLT-ON PLATES', cost: 300, d: 'Steel plates on the sides and nose. +60% health.' },
    { n: 'HEAVY ARMOUR', cost: 900, d: 'Thick plates and a cage over the glass. +130% health.' },
    { n: 'FORTRESS', cost: 2000, d: 'Armour everywhere, even round the tail. +220% health. Heavy!' },
    { n: 'CERAMIC COMPOSITE', cost: 4500, d: 'Ceramic armour tiles over everything. +300% health and lighter than steel.' },
  ] },
  { id: 'engine', name: 'ENGINE', icon: '✦', tiers: [
    { n: 'STOCK TURBINE', cost: 0, d: 'Gets you up there.' },
    { n: 'TURBO', cost: 300, d: 'Bigger exhausts. More lift and top speed.' },
    { n: 'TWIN TURBO', cost: 900, d: 'Two turbines. A lot more of everything.' },
    { n: 'EMERGENCY POWER', cost: 1900, d: 'Hold SHIFT to overboost the engines for a burst of speed.' },
    { n: 'UPRATED ENGINES', cost: 4200, d: 'Two big new turboshafts: much faster, much more lift, and a longer boost.' },
  ] },
  { id: 'rotor', name: 'ROTOR', icon: '✳', tiers: [
    { n: '4 BLADES', cost: 0, d: 'The standard rotor.' },
    { n: '5 BLADES', cost: 500, d: 'Longer blades. Better lift and quicker turns.' },
    { n: 'COAXIAL', cost: 1400, d: 'Two rotors stacked up. Turns on the spot.' },
    { n: 'COMPOSITE BLADES', cost: 3200, d: 'Wide blades with swept tips: more lift, quicker turns, and clipping a wall barely hurts.' },
  ] },
  { id: 'door', name: 'DOOR GUNS', icon: '⌖', tiers: [
    { n: 'NONE', cost: 0, d: 'Empty doors.' },
    { n: 'DOOR GUNNER', cost: 500, d: 'A gunner in the right door shoots zombies he can see.' },
    { n: 'TWIN GUNNERS', cost: 1200, d: 'Gunners in both doors.' },
    { n: 'DOOR MINIGUNS', cost: 2300, d: 'Both gunners get spinning miniguns.' },
    { n: 'MK19 GRENADES', cost: 3400, d: 'Both doors get Mk 19 grenade launchers: a steady stream of 40 mm grenades into the crowds.' },
  ] },
  { id: 'fuel', name: 'FUEL TANKS', icon: '⛽', tiers: [
    { n: 'STANDARD TANK', cost: 0, d: 'About 5 minutes of flying.' },
    { n: 'SIDE TANKS', cost: 350, d: 'Tanks strapped to the sides. About 8 minutes.' },
    { n: 'FERRY TANKS', cost: 1000, d: 'Big drop tanks on the wings. About 12 minutes.' },
    { n: 'AUX CABIN TANK', cost: 2400, d: 'Ferry tanks plus a big tank inside the cabin. About 20 minutes.' },
  ] },
  { id: 'cabin', name: 'CABIN', icon: '♟', tiers: [
    { n: '4 SEATS', cost: 0, d: 'Carry 4 people (your team and survivors).' },
    { n: '8 SEATS', cost: 300, d: 'Side benches. Carry 8.' },
    { n: '12 SEATS', cost: 900, d: 'Side pods bolted on. Carry 12.' },
    { n: '16 SEATS', cost: 2100, d: 'Bigger pods all the way back. Carry 16 (the Mule carries 40).' },
  ] },
  { id: 'winch', name: 'WINCH', icon: '⚓', tiers: [
    { n: 'NONE', cost: 0, d: 'People climb a rope ladder: you have to hover low.' },
    { n: 'RESCUE WINCH', cost: 600, d: 'A winch arm on the door: pick people up from 30 m up, out of reach of the piles.' },
    { n: 'CARGO HOOK', cost: 1300, d: 'Also hooks crates from high up, and lowers your team onto roofs without landing.' },
    { n: 'RESCUE HOIST', cost: 2200, d: 'A fast powered hoist: pick people up from 50 m above a roof, three times quicker.' },
  ] },
  { id: 'flir', name: 'THERMAL CAMERA', icon: '◉', tiers: [
    { n: 'NONE', cost: 0, d: 'Just your eyes.' },
    { n: 'THERMAL CAMERA', cost: 500, d: 'A camera ball under the nose: zombies show on the map from far away.' },
    { n: 'THERMAL + MARKERS', cost: 1300, d: 'Marks screamers and piles on screen, and how many zombies are inside buildings.' },
  ] },
  { id: 'speaker', name: 'LOUDSPEAKER', icon: '♫', tiers: [
    { n: 'NONE', cost: 0, d: 'No speakers.' },
    { n: 'LOUDSPEAKER', cost: 450, d: 'Press V: a siren that drags every zombie nearby to where you are. Lead them away from your team!' },
    { n: 'LRAD', cost: 1600, d: 'A long range acoustic device: the siren also knocks down zombies close under you and shakes them off the skids.' },
  ] },
  { id: 'skids', name: 'SKIDS', icon: '⊥', tiers: [
    { n: 'PLAIN SKIDS', cost: 0, d: 'Easy to grab.' },
    { n: 'ANTI-CLIMB SKIDS', cost: 400, d: 'Spikes and greased bars: zombies can barely hang on.' },
  ] },
  { id: 'light', name: 'SEARCHLIGHT', icon: '☀', tiers: [
    { n: 'NONE', cost: 0, d: 'Nights are dark. Really dark.' },
    { n: 'SEARCHLIGHT', cost: 350, d: 'A big light under the nose that points where you fly. Comes on at night (L to switch).' },
    { n: 'NIGHTSUN', cost: 1100, d: 'The police searchlight: twin lamps, much brighter. Zombies caught in the beam stagger and stop.' },
  ] },
  { id: 'medbay', name: 'MEDICAL BAY', icon: '✚', tiers: [
    { n: 'NONE', cost: 0, d: 'A first aid kit somewhere.' },
    { n: 'MEDICAL BAY', cost: 600, d: 'Stretchers and a medic station: your team heals fast on board and gets +30 health on raids.' },
    { n: 'TRAUMA BAY', cost: 1800, d: 'A full trauma bay: heals 3x faster, +60 health on raids, and a bitten team member is saved once a raid.' },
  ] },
  { id: 'drops', name: 'SUPPLY CHUTES', icon: '☂', tiers: [
    { n: 'NONE', cost: 0, d: 'Your team only has what they took in.' },
    { n: 'SUPPLY CHUTES', cost: 500, d: 'Press B near the building your team is raiding: medkits and grenades parachute down to them.' },
    { n: 'HEAVY DROPS', cost: 1200, d: 'Bigger crates: armour too, and they fight 40% harder for the rest of the raid.' },
  ] },
  { id: 'radio', name: 'RADIO', icon: '📡', tiers: [
    { n: 'HANDHELD', cost: 0, d: 'You only hear calls for help close by.' },
    { n: 'LONG RANGE RADIO', cost: 400, d: 'A big aerial on the tail: hear SOS calls from twice as far, and see hordes coming on the map.' },
    { n: 'SATCOM', cost: 1500, d: 'A satellite dome on the tail: hear SOS calls from anywhere on the map.' },
  ] },
  { id: 'flares', name: 'FLASHBANGS', icon: '✺', tiers: [
    { n: 'NONE', cost: 0, d: 'Nothing to shake them off with.' },
    { n: 'FLASHBANGS', cost: 700, d: 'Press X: a ring of flashbangs. Zombies within 25 m are stunned and anything on the skids lets go. 4 per refill.' },
    { n: 'HEAVY FLASHBANGS', cost: 1900, d: '8 per refill, 50 m wide, and they stay stunned for longer.' },
  ] },
  { id: 'beacon', name: 'NOISE BEACONS', icon: '◬', tiers: [
    { n: 'NONE', cost: 0, d: 'No beacons.' },
    { n: 'NOISE BEACONS', cost: 600, d: 'Press N: drop a screaming beacon. Every zombie around walks to it for 25 seconds. 3 per refill.' },
    { n: 'BOOM BEACONS', cost: 1700, d: '5 of them, and they blow up when they stop, right in the middle of the crowd.' },
  ] },
  { id: 'nvg', name: 'NIGHT VISION', icon: '◐', tiers: [
    { n: 'NONE', cost: 0, d: 'At night you only see what\'s lit.' },
    { n: 'NIGHT VISION', cost: 900, d: 'Goggles for the crew and an infrared lamp on the nose: at night everything shows up bright and green. Z switches it on and off.' },
  ] },
  { id: 'drone', name: 'DRONES', icon: '✣', tiers: [
    { n: 'NONE', cost: 0, d: 'Just you.' },
    { n: 'SPOTTER DRONE', cost: 1200, d: 'A little quadcopter flies alongside: the minimap shows every zombie within 650 m, and the big ones stand out.' },
    { n: 'ARMED DRONE', cost: 2600, d: 'The drone carries a gun: it picks off anything climbing at you or hanging off the skids.' },
    { n: 'DRONE PAIR', cost: 4400, d: 'Two armed drones, one each side.' },
  ] },
  { id: 'ammo', name: 'AMMO', icon: '⁍', tiers: [
    { n: 'BALL', cost: 0, d: 'Ordinary rounds for the nose gun and the door guns.' },
    { n: 'ARMOUR-PIERCING', cost: 900, d: 'Goes straight through riot armour, and on into the one standing behind.' },
    { n: 'INCENDIARY', cost: 1900, d: 'Sets them on fire: they keep burning for a few seconds after you hit them.' },
  ] },
  { id: 'repair', name: 'REPAIRS', icon: '⚒', tiers: [
    { n: 'NONE', cost: 0, d: 'Repairs only at a base.' },
    { n: 'FIELD REPAIR KIT', cost: 800, d: 'Land anywhere and the crew patch the helicopter up (slowly).' },
    { n: 'CREW CHIEF', cost: 2100, d: 'A crew chief on board: fixes things in flight too, and much faster on the ground.' },
  ] },
  { id: 'suppress', name: 'FIRE SUPPRESSION', icon: '❄', tiers: [
    { n: 'NONE', cost: 0, d: 'When it\'s going down, it\'s going down.' },
    { n: 'ENGINE EXTINGUISHERS', cost: 1500, d: 'Once a sortie, a hit that would have brought you down puts the fire out instead: you keep flying on 20% health.' },
  ] },
  { id: 'pods', name: 'GUN PODS', icon: '⁑', tiers: [
    { n: 'NONE', cost: 0, d: 'Nothing on the wings but what you fit there.' },
    { n: '.50 CAL PODS', cost: 1400, d: 'Two HMP-400 heavy machine gun pods on the wings. They fire with the nose gun.' },
    { n: '20 MM CANNON PODS', cost: 3200, d: 'Two 20 mm cannon pods: slower, but every shell bursts. They fire with the nose gun.' },
  ] },
  { id: 'sniper', name: 'MARKSMAN', icon: '⌕', tiers: [
    { n: 'NONE', cost: 0, d: 'Nobody aiming carefully.' },
    { n: 'DESIGNATED MARKSMAN', cost: 1600, d: 'A sharpshooter in the cabin with a scoped rifle: picks off screamers and riot police first, one shot every second and a half.' },
    { n: 'ANTI-MATERIEL RIFLE', cost: 3600, d: 'A .50 calibre rifle: one shot drops a brute, and it goes through riot armour and the one behind.' },
  ] },
  { id: 'racks', name: 'WEAPON RACKS', icon: '☰', tiers: [
    { n: 'NONE', cost: 0, d: 'Standard load.' },
    { n: 'EXTRA RACKS', cost: 900, d: 'Bigger ammo racks: +50% rockets and 2 more bombs.' },
    { n: 'FULL LOADOUT', cost: 2000, d: 'Every rack full: double rockets and 4 more bombs.' },
  ] },
];
export const SLOT = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

// the helicopters you can fly. cap = the highest tier of each upgrade that fits (0 = can't fit it at all).
export const HELIS = {
  warhorse: { n: 'WARHORSE', cost: 0, d: 'The all-rounder. Good guns, room for your team, takes a beating. Fits every upgrade.', seats: [4, 8, 12, 16],
    hp: 1, mass: 1, lift: 1, speed: 1, agility: 1, fuel: 1, cap: {} },
  hornet: { n: 'HORNET', cost: 1500, d: 'A tiny, fast scout. Darts between skyscrapers and turns on a coin. Two inside, two on the benches outside. Paper-thin.', seats: [4, 6],
    hp: 0.6, mass: 0.72, lift: 1.06, speed: 1.3, agility: 1.65, fuel: 0.85, cap: { gun: 2, rockets: 2, bombs: 1, armor: 1, cabin: 1, fuel: 1, winch: 1, medbay: 0, drops: 1, engine: 3, speaker: 1, pods: 1, sniper: 1 } },
  reaper: { n: 'REAPER', cost: 4500, d: 'A gunship. Its chin gun hits 30% harder, its four pylons carry 50% more rockets, and it\'s armoured like a tank. Two seats only.', seats: [2],
    hp: 1.75, mass: 1.2, lift: 1.28, speed: 1.14, agility: 1.08, fuel: 1, gunMul: 1.3, rocketMul: 1.5, cap: { cabin: 0, door: 0, winch: 0, medbay: 0, sniper: 0 } },
  viper: { n: 'VIPER', cost: 3000, d: 'A slim two-seat attack helicopter: the fastest thing in the sky, a chin gun 15% harder and 25% more rockets. Not much armour, no cabin.', seats: [2],
    hp: 0.9, mass: 0.85, lift: 1.12, speed: 1.4, agility: 1.4, fuel: 0.95, gunMul: 1.15, rocketMul: 1.25, cap: { cabin: 0, door: 0, winch: 0, medbay: 0, drops: 1, sniper: 0 } },
  kestrel: { n: 'KESTREL', cost: 6500, d: 'A big three-engine utility helicopter: 12 to 24 seats, a quick cruise, tough as anything, and room for nearly every upgrade.', seats: [12, 16, 20, 24],
    hp: 1.45, mass: 1.35, lift: 1.42, speed: 1.08, agility: 0.8, fuel: 1.5, cap: { gun: 3 } },
  mule: { n: 'MULE', cost: 3500, d: 'A huge twin-rotor transport. Slow and wide, but carries 16 people (32 with the cabin upgrades), flies for ages and can soak up hits.', seats: [16, 24, 32, 40],
    hp: 2.1, mass: 1.75, lift: 1.78, speed: 0.84, agility: 0.52, fuel: 1.9, cap: { gun: 1, rockets: 0, rotor: 1, engine: 3, racks: 0, pods: 0 } },
};
export const HELI_IDS = Object.keys(HELIS);
// the upgrades that actually fit this helicopter
export function capEq(eq, kind = 'warhorse') {
  const cap = (HELIS[kind] || HELIS.warhorse).cap, out = {};
  for (const k of Object.keys(eq)) out[k] = Math.min(eq[k], cap[k] ?? 99);
  return out;
}

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
// camouflage patterns over the paint (k = the pattern number in the shader), nose art and tail markings
export const CAMOS = [
  { id: 'none', n: 'NO CAMO', cost: 0, d: 'Just the paint.' },
  { id: 'woodland', n: 'WOODLAND', cost: 300, k: 1, d: 'Blotches of dark green, brown and black.' },
  { id: 'desert', n: 'DESERT', cost: 300, k: 2, d: 'Big soft patches of sand and earth.' },
  { id: 'urban', n: 'URBAN', cost: 300, k: 3, d: 'Greys, for the city.' },
  { id: 'tiger', n: 'TIGER STRIPES', cost: 700, k: 4, d: 'Black stripes the whole way down.' },
  { id: 'splinter', n: 'SPLINTER', cost: 900, k: 5, d: 'Hard-edged shards of light and dark.' },
  { id: 'digital', n: 'DIGITAL', cost: 1200, k: 6, d: 'Tiny pixels, like modern uniforms.' },
];
export const CAMO = Object.fromEntries(CAMOS.map((p) => [p.id, p]));
export const NOSEART = [
  { id: 'none', n: 'NONE', cost: 0, d: 'A plain nose.' },
  { id: 'shark', n: 'SHARK MOUTH', cost: 600, d: 'Red mouth, white teeth, an eye. The classic.' },
  { id: 'flames', n: 'FLAMES', cost: 900, d: 'Hot-rod flames licking back from the nose.' },
  { id: 'skull', n: 'SKULL & BONES', cost: 900, d: 'A skull and crossbones on both sides.' },
  { id: 'checks', n: 'CHEQUERED NOSE', cost: 500, d: 'Black and white checks, like the old fighter squadrons.' },
];
export const TAILART = [
  { id: 'none', n: 'PLAIN TAIL', cost: 0, d: 'Nothing on the tail.' },
  { id: 'stripes', n: 'INVASION STRIPES', cost: 400, d: 'Black and white bands round the tail boom.' },
  { id: 'bands', n: 'RESCUE BANDS', cost: 400, d: 'Dayglo orange bands, so your team can spot you.' },
  { id: 'number', n: 'TAIL NUMBER', cost: 200, d: 'Your number on both sides. Click it again for a new one.' },
];

// THE SPIRE: what you build at the base. Each tier needs scrap AND enough people living there (everyone you rescue
// moves in). The people are what make the place work: they scavenge, so the more there are, the more scrap comes in.
export const BASE = [
  { id: 'bunks', name: 'BUNKS', icon: '⌂', tiers: [
    { n: 'CAMP BEDS', cost: 0, pop: 0, d: 'Room for 40 people. Everyone over that just sleeps on the floor and doesn\'t help.' },
    { n: 'BARRACKS FLOORS', cost: 1200, pop: 25, d: 'Three floors turned into dorms: room for 150.' },
    { n: 'THE WHOLE TOWER', cost: 3500, pop: 90, d: 'Every floor fitted out: room for 500.' },
  ] },
  { id: 'guns', name: 'DEFENCE GUNS', icon: '⌖', tiers: [
    { n: 'TWIN .50 CALS', cost: 0, pop: 0, d: 'Heavy machine guns on the corners of the flight deck.' },
    { n: 'BOFORS 40 MM', cost: 2500, pop: 30, d: 'Old anti-aircraft guns: explosive shells that blow piles apart.' },
    { n: 'PHALANX CIWS', cost: 6000, pop: 120, d: 'A navy close-in weapon system on every corner: 75 shots a second. Nothing gets near the Spire.' },
  ] },
  { id: 'depot', name: 'FUEL DEPOT', icon: '⛽', tiers: [
    { n: 'JERRY CANS', cost: 0, pop: 0, d: 'Fuel by hand.' },
    { n: 'FUEL BOWSER', cost: 1500, pop: 20, d: 'Refuel twice as fast, and fuel drops (G) cost ⚙60 and bring twice as much.' },
    { n: 'TANK FARM', cost: 4000, pop: 70, d: 'Big tanks and pumps: refuelling, repairs and rearming are instant, and fuel drops are free.' },
  ] },
  { id: 'works', name: 'WORKSHOP', icon: '⚒', tiers: [
    { n: 'TOOLBOX', cost: 0, pop: 0, d: 'A spanner and some tape.' },
    { n: 'WORKSHOP', cost: 2000, pop: 35, d: 'Mechanics among the survivors: every helicopter upgrade costs 10% less.' },
    { n: 'MACHINE SHOP', cost: 5000, pop: 110, d: 'Lathes, welders, a whole crew: upgrades cost 20% less and helicopters 15% less.' },
  ] },
  { id: 'clinic', name: 'CLINIC', icon: '✚', tiers: [
    { n: 'FIRST AID', cost: 0, pop: 0, d: 'Plasters.' },
    { n: 'CLINIC', cost: 1500, pop: 25, d: 'A doctor and nurses: your team gets +25 max health.' },
    { n: 'FIELD HOSPITAL', cost: 4000, pop: 80, d: 'A proper ward: +50 max health, and recruiting is free (they train the volunteers).' },
  ] },
  { id: 'radar', name: 'RADAR ROOM', icon: '◎', tiers: [
    { n: 'BINOCULARS', cost: 0, pop: 0, d: 'Someone on the roof with binoculars.' },
    { n: 'RADAR ROOM', cost: 2200, pop: 40, d: 'Hordes show on your map wherever they are, and more calls for help come in at once.' },
  ] },
];
export const BASE_SLOT = Object.fromEntries(BASE.map((s) => [s.id, s]));
export const BEDS = [40, 150, 500];
export function baseCut(save, heli) { const w = (save.base && save.base.works) || 0; return heli ? [1, 1, 0.85][w] : [1, 0.9, 0.8][w]; }

const KEY = 'semifinals.deadair';
export function loadSave() {
  const s = { scrap: 0, own: {}, eq: {}, paints: ['olive', 'night'], paint: 'olive', camos: ['none'], camo: 'none', noses: ['none'], nose: 'none', tails: ['none'], tailArt: 'none', num: 10 + Math.floor(Math.random() * 90), flight: 'easy', invert: false, sens: 1, best: 0, runs: 0, titans: 0, rescued: 0, crew: [], pool: [], events: 0, name: '' };
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* ignore */ }
  // the belly turret, the tail gun and electric skids are gone: give back everything that was spent on them
  if (!s.refund2) {
    const spent = { turret: [0, 800, 2500], tail: [0, 900, 2900] };
    let back = 0;
    for (const k of Object.keys(spent)) back += spent[k][Math.min(2, (s.own && s.own[k]) || 0)];
    if (s.own && (s.own.skids || 0) >= 2) back += 1100;
    s.refund2 = true;
    if (back > 0) { s.scrap = (s.scrap || 0) + back; s.refundMsg = back; }
    s.refundPending = true;
  }
  for (const sl of SLOTS) {
    const top = sl.tiers.length - 1;
    s.own[sl.id] = Math.min(top, s.own[sl.id] ?? 0); s.eq[sl.id] = Math.min(s.own[sl.id], s.eq[sl.id] ?? 0);
  }
  for (const k of Object.keys(s.eq)) if (!SLOTS.some((sl) => sl.id === k)) { delete s.eq[k]; delete s.own[k]; }
  s.team = s.team || []; s.stash = s.stash || { medkit: 2, pistol: 0, smg: 0, shotgun: 0, rifle: 0, vest: 0, heavy: 0, pack: 0, grenade: 0 };
  if (s.seed == null) s.seed = 0;
  s.base = Object.assign({ bunks: 0, guns: 0, depot: 0, works: 0, clinic: 0, radar: 0 }, s.base || {});
  s.story = Object.assign({ ch: 0, prog: {}, masts: [], fort: false, seen: -1, done: false }, s.story || {});
  s.helis = s.helis || ['warhorse']; if (!HELIS[s.heli] || !s.helis.includes(s.heli)) s.heli = 'warhorse';
  if (s.refundPending) { delete s.refundPending; saveSave(s); }
  return s;
}
export function saveSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

// what the fitted upgrades add up to
export function statsFor(eq0, kind = 'warhorse') {
  const HK = HELIS[kind] || HELIS.warhorse, eq = capEq(eq0, kind);
  const v = (k, max) => Math.min(eq[k] || 0, max);
  const g = v('gun', 4), ar = v('armor', 4), en = v('engine', 4), ro = v('rotor', 3), rk = v('rockets', 4), bo = v('bombs', 4), fl = v('flares', 2), bc = v('beacon', 2);
  const S = {
    kind,
    hp: Math.round(500 * [1, 1.6, 2.3, 3.2, 4][ar]),
    mass: [1, 1.06, 1.14, 1.26, 1.1][ar] + rk * 0.02 + bo * 0.02 + v('cabin', 3) * 0.03 + v('fuel', 3) * 0.03 + v('winch', 3) * 0.02 + v('drone', 3) * 0.01,
    lift: [1, 1.14, 1.28, 1.36, 1.5][en] * [1, 1.07, 1.12, 1.15][ro],
    speed: [1, 1.1, 1.2, 1.26, 1.45][en],
    agility: [1, 1.15, 1.35, 1.3][ro],
    boost: en >= 3, boostMul: en === 4 ? 1.35 : 1,
    toughBlades: ro === 3,
    gun: [
      { rate: 9, dmg: 22, spread: 0.010, heat: 0.035, cool: 0.45, barrels: 1 },
      { rate: 24, dmg: 16, spread: 0.016, heat: 0.016, cool: 0.4, barrels: 1, spin: true },
      { rate: 44, dmg: 16, spread: 0.018, heat: 0.011, cool: 0.4, barrels: 2, spin: true },
      { rate: 5, dmg: 90, spread: 0.006, heat: 0.05, cool: 0.5, barrels: 1, cannon: true, splash: 3.5 },
      { rate: 9, dmg: 90, spread: 0.008, heat: 0.03, cool: 0.5, barrels: 2, cannon: true, splash: 3.5 },
    ][g],
    rockets: Math.round([0, 8, 16, 12, 36][rk] * [1, 1.5, 2][v('racks', 2)]), rocketDmg: [0, 260, 340, 420, 170][rk], rocketR: [0, 6.5, 8, 8.5, 5][rk], homing: rk === 3, swarm: rk === 4,
    bombs: bo ? [0, 4, 4, 4, 2][bo] + [0, 2, 4][v('racks', 2)] / (bo === 4 ? 2 : 1) : 0, cluster: bo === 2, napalm: bo === 3, thermo: bo === 4,
    gunners: Math.min(2, v('door', 4)), doorMini: v('door', 4) === 3, doorGL: v('door', 4) === 4,
    seats: [4, 8, 12, 16][v('cabin', 3)],
    fuel: [100, 160, 240, 330][v('fuel', 3)],
    winch: v('winch', 3), hook: v('winch', 3) >= 2, hoist: v('winch', 3) === 3,
    flir: v('flir', 2), speaker: v('speaker', 2), lrad: v('speaker', 2) === 2, skidGuard: v('skids', 1) >= 1, zap: false,
    light: v('light', 2), medbay: v('medbay', 2), drops: v('drops', 2), radio: v('radio', 2),
    nvg: v('nvg', 1), racks: v('racks', 2), drones: v('drone', 3), ammo: v('ammo', 2), repair: v('repair', 2), suppress: v('suppress', 1), flares: [0, 4, 8][fl], megaFlare: fl === 2, beacons: [0, 3, 5][bc], beaconBoom: bc === 2,
    crewMax: [2, 3, 4, 4][v('cabin', 3)],
    pods: v('pods', 2), sniper: v('sniper', 2),
  };
  // the airframe
  S.hp = Math.round(S.hp * HK.hp); S.mass *= HK.mass; S.lift *= HK.lift; S.speed *= HK.speed; S.agility *= HK.agility;
  S.fuel = Math.round(S.fuel * HK.fuel);
  S.seats = HK.seats[Math.min(HK.seats.length - 1, v('cabin', 3))];
  if (HK.gunMul) S.gun = { ...S.gun, dmg: Math.round(S.gun.dmg * HK.gunMul) };
  if (HK.rocketMul) S.rockets = Math.round(S.rockets * HK.rocketMul);
  if ((HK.cap.door ?? 9) === 0) S.gunners = 0;
  return S;
}
// 0..1 bars for the hangar
export function bars(eq, kind) {
  const s = statsFor(eq, kind), gun = s.gun.rate * s.gun.dmg * (s.gun.splash ? 2.2 : 1);
  return [
    ['ARMOUR', Math.min(1, s.hp / 3600)],
    ['FIREPOWER', Math.min(1, (gun + s.rockets * s.rocketDmg / 12 + s.gunners * 150 * (s.doorMini ? 2 : 1) + s.bombs * 60 + [0, 600, 700][s.pods] + [0, 90, 330][s.sniper]) / 2200)],
    ['FUEL', Math.min(1, s.fuel / 460)],
    ['SEATS', Math.min(1, s.seats / 40)],
  ];
}
