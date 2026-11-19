// DEAD AIR: your team. People you recruit (name them, pick their job), kit out (guns, armour, medkits, grenades, packs)
// and send into buildings to bring back scrap, fuel, medicine, weapons and survivors.
//
// A RAID: land on (or hover over) a building you can raid and press R. They go in through the roof door and work DOWN, or
// in through the street door and work UP, clearing each floor: fighting what's there (their guns vs. how many zombies),
// patching each other up, then searching it. You watch it all on the tracker. When the building's done they head to the
// meeting point you picked (the ROOF, or the STREET door) and wait for you. Zombies outside hear the shooting and come.
// Get there, land (or winch them up) and press E. If someone's health hits zero, they're bitten: they don't come back.
export const ROLES = {
  rifleman: { n: 'RIFLEMAN', col: [0.9, 0.25, 0.2], d: 'Steady shot: 20% more firepower.' },
  medic: { n: 'MEDIC', col: [0.95, 0.95, 0.95], d: 'Patches the team up after every floor. Medkits heal twice as much.' },
  scavenger: { n: 'SCAVENGER', col: [0.3, 0.85, 0.3], d: 'Finds half as much loot again.' },
  breacher: { n: 'BREACHER', col: [1, 0.6, 0.1], d: 'Goes in first: the team takes a third less damage.' },
  scout: { n: 'SCOUT', col: [0.3, 0.6, 1], d: 'Quick: the team moves floor to floor much faster, and finds more survivors.' },
};
export const ROLE_IDS = Object.keys(ROLES);

// [power, cost]
export const WEAPONS = {
  pistol: { n: 'PISTOL', p: 1, cost: 0 },
  smg: { n: 'SMG', p: 2, cost: 120 },
  shotgun: { n: 'SHOTGUN', p: 2.5, cost: 160 },
  rifle: { n: 'RIFLE', p: 3, cost: 240 },
  lmg: { n: 'MACHINE GUN', p: 4.2, cost: 480 },
};
export const ARMORS = {
  none: { n: 'NO ARMOUR', k: 1, cost: 0 },
  vest: { n: 'VEST', k: 0.65, cost: 120 },
  heavy: { n: 'HEAVY ARMOUR', k: 0.42, cost: 320 },
};
export const ITEMS = {
  medkit: { n: 'MEDKIT', cost: 50, d: 'Heals 50 when someone gets hurt.' },
  grenade: { n: 'GRENADE', cost: 70, d: 'Clears a crowded floor in one go.' },
  pack: { n: 'BIG BACKPACK', cost: 100, d: '+50% loot carried home.' },
};
const NAMES = ['MAYA', 'KAI', 'ROSA', 'FINN', 'AMIR', 'ZOE', 'LEO', 'IVY', 'OMAR', 'NIA', 'JACK', 'SANA', 'MILO', 'ELLA', 'RAJ', 'TESS', 'OLLIE', 'PRIYA', 'SAM', 'LUCA', 'DEV', 'JADE', 'MO', 'ASH'];
export const randName = () => NAMES[Math.floor(Math.random() * NAMES.length)];
export const HAIR = [[0.1, 0.07, 0.05], [0.35, 0.2, 0.1], [0.75, 0.6, 0.3], [0.2, 0.2, 0.2], [0.6, 0.2, 0.1]];

export function newMember(name, role) {
  return { id: Math.random().toString(36).slice(2, 8), name: (name || randName()).toUpperCase().slice(0, 12), role, hp: 100, max: 100,
    wpn: 'pistol', armor: 'none', medkit: 1, grenade: 0, pack: false, aboard: true, kills: 0, raids: 0, hair: Math.floor(Math.random() * HAIR.length) };
}
export const recruitCost = (team) => (team.length < 2 ? 0 : 80 + team.length * 40);

// what's in a building, floor by floor
export function makeFloors(b, LOOT) {
  const L = LOOT[b.loot], n = b.floors, weights = Object.entries(L.loot), tot = weights.reduce((a, w) => a + w[1], 0);
  const danger = { police: 1.4, hospital: 1.5, gunshop: 1.2, flats: 1.1 }[b.loot] || 1;
  const floors = [];
  for (let i = 0; i < n; i++) {
    const loot = [];
    const items = 1 + Math.floor(Math.random() * 2.5);
    for (let k = 0; k < items; k++) {
      let r = Math.random() * tot;
      for (const [kind, w] of weights) { if ((r -= w) <= 0) { loot.push(kind); break; } }
    }
    floors.push({ z: Math.round((1 + Math.random() * 5) * danger), loot, done: false });
  }
  return floors;
}

// one raid, ticking along on its own
export class Raid {
  constructor(b, team, entry, meet, LOOT) {
    this.b = b; this.team = team; this.entry = entry; this.meet = meet;
    if (!b.floorsData) b.floorsData = makeFloors(b, LOOT);
    this.floors = b.floorsData;
    this.dir = entry === 'roof' ? -1 : 1;
    this.at = entry === 'roof' ? this.floors.length - 1 : 0;
    this.phase = 'enter'; this.t = 2.5;
    this.loot = { scrap: 0, fuel: 0, medkit: 0, grenade: 0, weapon: [], armor: [], survivor: 0 };
    this.log = []; this.done = false; this.lost = [];
    this.say(`${team.length} WENT IN THROUGH THE ${entry === 'roof' ? 'ROOF' : 'FRONT DOOR'}`);
  }
  say(t) { this.log.unshift(t); if (this.log.length > 6) this.log.pop(); this.news = t; }
  alive() { return this.team.filter((m) => m.hp > 0); }
  has(role) { return this.alive().some((m) => m.role === role); }
  power() { return this.alive().reduce((a, m) => a + WEAPONS[m.wpn].p * (m.role === 'rifleman' ? 1.2 : 1), 0); }
  speed() { return this.has('scout') ? 0.6 : 1; }
  tick(dt) {
    if (this.done) return;
    const F = this.floors[this.at];
    this.t -= dt;
    const live = this.alive();
    if (!live.length) { this.done = true; this.wiped = true; this.say('NOBODY CAME OUT'); return; }
    if (this.phase === 'enter') { if (this.t <= 0) { this.phase = 'fight'; this.say(`FLOOR ${this.at + 1}: ${F.done ? 'ALREADY CLEAR' : F.z ? `${F.z} ZOMBIES` : 'QUIET'}`); } return; }
    if (this.phase === 'fight') {
      if (F.done || F.z <= 0) { F.z = 0; this.phase = 'search'; this.t = F.done ? 0.4 : 2.2 * this.speed(); return; }
      // a grenade for a crowded floor
      if (F.z >= 5) { const g = live.find((m) => m.grenade > 0); if (g) { g.grenade--; g.kills += F.z; this.say(`${g.name} THREW A GRENADE · ${F.z} DOWN`); F.z = 0; return; } }
      // shoot: kills come at a rate set by the team's guns
      this.killAcc = (this.killAcc || 0) + dt * this.power() * 0.55;
      while (this.killAcc >= 1 && F.z > 0) { this.killAcc -= 1; F.z--; const s = live[Math.floor(Math.random() * live.length)]; s.kills++; }
      // get hurt: more zombies, more damage; armour and a breacher help
      const hurt = F.z * 2.4 * dt * (this.has('breacher') ? 0.67 : 1);
      if (hurt > 0) {
        const v = live[Math.floor(Math.random() * live.length)];
        v.hp -= hurt * ARMORS[v.armor].k * (0.6 + Math.random() * 0.8);
        if (v.hp < 40 && v.medkit > 0) { v.medkit--; v.hp = Math.min(v.max, v.hp + (this.has('medic') ? 100 : 50)); this.say(`${v.name} USED A MEDKIT`); }
        if (v.hp <= 0) { v.hp = 0; this.lost.push(v); this.say(`${v.name} WAS BITTEN`); }
      }
      return;
    }
    if (this.phase === 'search') {
      if (this.t > 0) return;
      if (!F.done) {
        F.done = true;
        const mul = (this.has('scavenger') ? 1.5 : 1) * (live.some((m) => m.pack) ? 1.5 : 1);
        const got = [];
        for (const it of F.loot) {
          if (it === 'scrap') { const n = Math.round((15 + Math.random() * 25) * mul); this.loot.scrap += n; got.push(`⚙${n}`); }
          else if (it === 'fuel') { const n = Math.round((14 + Math.random() * 16) * mul); this.loot.fuel += n; got.push(`${n} FUEL`); }
          else if (it === 'medkit') { this.loot.medkit++; got.push('MEDKIT'); }
          else if (it === 'ammo') { this.loot.grenade++; got.push('GRENADE'); }
          else if (it === 'weapon') { const w = ['smg', 'shotgun', 'rifle', 'rifle', 'lmg'][Math.floor(Math.random() * 5)]; this.loot.weapon.push(w); got.push(WEAPONS[w].n); }
          else if (it === 'armor') { const a = Math.random() < 0.7 ? 'vest' : 'heavy'; this.loot.armor.push(a); got.push(ARMORS[a].n); }
          else if (it === 'survivor') { const n = 1 + (this.has('scout') && Math.random() < 0.5 ? 1 : 0); this.loot.survivor += n; got.push(`${n} SURVIVOR${n > 1 ? 'S' : ''}`); }
        }
        if (got.length) this.say(`FLOOR ${this.at + 1}: FOUND ${got.join(', ')}`);
        // the medic patches everyone up between floors
        if (this.has('medic')) for (const m of live) m.hp = Math.min(m.max, m.hp + 12);
      }
      // next floor, or out
      const next = this.at + this.dir;
      if (next < 0 || next >= this.floors.length) { this.phase = 'exit'; this.t = this.exitTime(); this.say(`ALL CLEAR · HEADING FOR THE ${this.meet === 'roof' ? 'ROOF' : 'STREET'}`); return; }
      this.at = next; this.phase = 'travel'; this.t = 1.6 * this.speed();
      return;
    }
    if (this.phase === 'travel') { if (this.t <= 0) { this.phase = 'fight'; const f = this.floors[this.at]; this.say(`FLOOR ${this.at + 1}: ${f.done ? 'CLEAR' : f.z ? `${f.z} ZOMBIES` : 'QUIET'}`); } return; }
    if (this.phase === 'exit') { if (this.t <= 0) { this.phase = 'waiting'; this.say(`WAITING ON THE ${this.meet === 'roof' ? 'ROOF' : 'STREET'} · COME AND GET US`); } return; }
  }
  // how long to get from here to the meeting point (floors already cleared are quick)
  exitTime() { const target = this.meet === 'roof' ? this.floors.length - 1 : 0; return 1.5 + Math.abs(target - this.at) * 0.7 * this.speed(); }
  setMeet(m) {
    if (this.meet === m || this.phase === 'waiting') return;
    this.meet = m; this.say(`OK · MEETING YOU ON THE ${m === 'roof' ? 'ROOF' : 'STREET'}`);
    if (this.phase === 'exit') this.t = this.exitTime();
  }
  recall() { if (this.phase === 'waiting' || this.phase === 'exit') return; this.phase = 'exit'; this.t = this.exitTime(); this.say(`PULLING OUT · HEADING FOR THE ${this.meet === 'roof' ? 'ROOF' : 'STREET'}`); }
}
