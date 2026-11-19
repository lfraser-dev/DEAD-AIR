// DEAD AIR: scenarios that pop up round the open world. A few are going at once; finish one and another turns up.
//   RESCUE   survivors on a roof (green flare). Land on it, press E to load them, drop them off at a base.
//   CONVOY   lorries waiting at the end of a road. Fly over them and they set off for the base; keep them alive.
//   NEST     a zombie nest pumping out zombies. Blow it up.
//   CRATE    a supply crate parachuting in. Land next to it, E to hook it on, carry it to a base and E to drop it.
//   SIEGE    a base under attack. Kill the attackers before they wreck it (a wrecked base can't refuel you for a while).
//   TITAN    a giant heading for a base. Kill it.
// Zombies only come out for a scenario when you're near it (so far-off ones wait for you), except sieges and titans.
import { compose, clamp } from '../math.js';
import { HALF, WORLD } from './map.js';

const NEAR = 360;
const dist2 = (a, x, z) => Math.hypot(a.x - x, a.z - z);
const NAMES = ['MAYA', 'KAI', 'ROSA', 'FINN', 'AMIR', 'ZOE', 'LEO', 'IVY', 'OMAR', 'NIA', 'JACK', 'SANA', 'MILO', 'ELLA', 'RAJ', 'TESS', 'OLLIE', 'PRIYA', 'SAM', 'LUCA'];
export const randName = () => NAMES[Math.floor(Math.random() * NAMES.length)];

class Ev {
  constructor(kind, name, x, z) { this.kind = kind; this.name = name; this.x = x; this.z = z; this.done = false; this.t = 0; this.id = Math.random().toString(36).slice(2, 7); }
  near(g) { return dist2(this, g.heli.pos[0], g.heli.pos[2]) < NEAR; }
  // pick a spot on open ground 50-110 m from (x, z) for zombies to come from
  edgeSpot(g, x, z, r0 = 55, r1 = 110) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, r = r0 + Math.random() * (r1 - r0), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (Math.abs(px) < WORLD - 10 && Math.abs(pz) < WORLD - 10 && !g.horde.blockedAt(px, pz)) return [px, pz];
    }
    return null;
  }
  spawnAt(g, type, x, z, tgt, keep = false) {
    const p = this.edgeSpot(g, x, z);
    if (!p) return null;
    const zb = g.horde.spawn(type, p[0], p[1], { tgt });
    zb.keep = keep; zb.ev = this.id;
    return zb;
  }
  mix(g) { const r = Math.random(), t = g.time; return t > 90 && r < 0.18 ? 'runner' : t > 45 && r > 0.93 ? 'spitter' : t > 160 && r > 0.89 && r < 0.93 ? 'brute' : 'walker'; }
  shootables() { return []; }
  parts() {}
}

export class Rescue extends Ev {
  constructor(roof) {
    super('rescue', 'RESCUE', roof.x, roof.z);
    this.roof = { ...roof, kind: 'roof', active: true, count: 3 + Math.floor(Math.random() * 4), wave: Math.random() * 6 };
    this.roof.start = this.roof.count;
    this.spawnT = 0; this.spawned = 0;
  }
  get y() { return this.roof.top; }
  update(dt, g) {
    const r = this.roof;
    if (!r.active || r.count <= 0) { r.active = false; this.done = true; return; }
    if (!this.near(g)) return;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.spawned < 26 + g.time / 20) { this.spawnT = 2.2; this.spawned++; this.spawnAt(g, this.mix(g), r.x, r.z, r); }
  }
  marker(g) {
    const climbing = g.horde.list.filter((z) => z.alive && (z.st === 'climb' || z.st === 'roof') && z.roof === this.roof).length;
    return { p: [this.x, this.roof.top + 4, this.z], col: '#7dff9a', icon: this.roof.count, text: 'SOS', sub: climbing ? `⚠ ${climbing} CLIMBING` : '' };
  }
  parts(P, t, person) {
    const r = this.roof;
    for (let i = 0; i < r.count; i++) { const a = (r.start - r.count + i) * 2.1 + r.wave; person(r.x + Math.cos(a) * 2.4, r.top, r.z + Math.sin(a) * 2.4, -a, true, i); }
    P([r.x + 3, r.top + 0.3, r.z + 3], [0, 0, 0], [0.5, 0.5, 0.5], [0.4, 1, 0.4], { em: 1, shape: 'sphere' });
    P([r.x + 3, r.top + 45, r.z + 3], [0, 0, 0], [1.8, 90, 1.8], [0.3, 1, 0.35], { em: 1, shape: 'cylY', alpha: 0.18 });
  }
  net() { const r = this.roof; return { k: 'rescue', x: r.x, y: r.top, z: r.z, n: r.count, s: r.start, w: r.wave }; }
}

export class Convoy extends Ev {
  constructor(road, fob) {
    super('convoy', 'CONVOY', road.from[0], road.from[1]);
    this.fob = fob; this.road = road;
    const d = [road.to[0] - road.from[0], road.to[1] - road.from[1]], l = Math.hypot(d[0], d[1]);
    this.dir = [d[0] / l, d[1] / l]; this.len = l;
    this.trucks = [0, 1, 2].map((i) => ({ kind: 'chase', sticky: true, r: 2.2, alive: true, hp: 260, max: 260, s: -i * 14, x: 0, z: 0 }));
    this.started = false; this.spawnT = 0; this.place();
    this.y = 0;
  }
  place() {
    for (const tr of this.trucks) {
      const s = clamp(tr.s, 0, this.len);
      tr.x = this.road.from[0] + this.dir[0] * s; tr.z = this.road.from[1] + this.dir[1] * s;
    }
    const lead = this.trucks.find((t) => t.alive) || this.trucks[0];
    this.x = lead.x; this.z = lead.z;
  }
  update(dt, g) {
    const live = this.trucks.filter((t) => t.alive);
    if (!live.length) { this.done = true; this.failed = true; g.feed('THE CONVOY WAS LOST', 'r'); g.banner('CONVOY LOST', 'ALL THE LORRIES WERE WRECKED', 'bad', 2); return; }
    if (!this.started) {
      if (dist2(this, g.heli.pos[0], g.heli.pos[2]) < 120) { this.started = true; g.feed('CONVOY ROLLING · KEEP IT SAFE', 'y'); g.snd.startRun?.(); }
      return;
    }
    // drive, slower when zombies are on them
    const busy = g.horde.list.some((z) => z.alive && z.tgt && z.tgt.sticky && live.includes(z.tgt) && Math.hypot(z.x - z.tgt.x, z.z - z.tgt.z) < 4);
    for (const tr of this.trucks) if (tr.alive) tr.s += dt * (busy ? 2.5 : 7);
    this.place();
    if (live[live.length - 1].s >= this.len) {
      this.done = true;
      const pay = live.length * 120;
      g.addScrap(pay); g.fuelUp(20);
      g.banner('CONVOY DELIVERED', `${live.length} LORR${live.length === 1 ? 'Y' : 'IES'} MADE IT · +${pay} SCRAP`, 'good', 2.4); g.snd.finish?.();
      for (const z of g.horde.list) if (z.tgt && live.includes(z.tgt)) z.tgt = null;
      return;
    }
    if (!this.near(g)) return;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 1.4;
      const tr = live[Math.floor(Math.random() * live.length)];
      const z = this.spawnAt(g, this.mix(g), tr.x + this.dir[0] * 40, tr.z + this.dir[1] * 40, tr, true);
      if (z) z.keep = true;
    }
  }
  hitTarget(tr, dmg, g) {
    tr.hp -= dmg;
    if (tr.hp <= 0 && tr.alive) { tr.alive = false; g.boom([tr.x, 1.5, tr.z], 1.6); g.feed('A LORRY WAS WRECKED', 'r'); }
  }
  marker() {
    const live = this.trucks.filter((t) => t.alive).length;
    return { p: [this.x, 6, this.z], col: '#ffcf3a', icon: '⛟', text: this.started ? 'CONVOY' : 'CONVOY · FLY OVER TO START', sub: `${live}/3 LORRIES` };
  }
  parts(P) { truckParts(P, this.trucks.map((t) => [t.x, t.z, t.alive ? t.hp / t.max : 0]), this.dir); }
  net() { return { k: 'convoy', d: this.dir, tr: this.trucks.map((t) => [Math.round(t.x * 10) / 10, Math.round(t.z * 10) / 10, t.alive ? Math.round((t.hp / t.max) * 100) / 100 : 0]) }; }
}
export function truckParts(P, trucks, dir) {
  const yaw = Math.atan2(-dir[0], -dir[1]), c = Math.cos(yaw), s = Math.sin(yaw);
  const L = (x, z, lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
  for (const [x, z, k] of trucks) {
    if (k <= 0) { P(L(x, z, 0, 1.2, 0.5), [0, yaw, 0.3], [2.4, 1.8, 6], [0.08, 0.07, 0.06], { shape: 0.1 }); continue; }
    P(L(x, z, 0, 1.4, -2.6), [0, yaw, 0], [2.3, 2.2, 1.8], [0.3, 0.36, 0.24], { shape: 0.15, mat: 'paint' });
    P(L(x, z, 0, 1.9, -3.5), [0, yaw, 0], [2.0, 0.8, 0.05], [0.1, 0.14, 0.18], { mat: 'glass' });
    P(L(x, z, 0, 1.8, 1.2), [0, yaw, 0], [2.4, 2.6, 5.2], [0.36, 0.4, 0.28], { shape: 0.1, mat: 'cloth' });
    for (const [wx, wz] of [[-1.1, -2.6], [1.1, -2.6], [-1.1, 1], [1.1, 1], [-1.1, 2.6], [1.1, 2.6]]) P(L(x, z, wx, 0.5, wz), [0, yaw + Math.PI / 2, 0], [1, 1, 0.4], [0.08, 0.08, 0.08], { shape: 'cyl' });
    if (k < 0.5) P(L(x, z, 0, 3.4, 1), [0, 0, 0], [0.8, 0.8, 0.8], [1, 0.5, 0.1], { em: 1, shape: 'sphere', alpha: 0.6 });
  }
}

export class Nest extends Ev {
  constructor(x, z) { super('nest', 'NEST', x, z); this.hp = 2600; this.max = 2600; this.spawnT = 0; this.y = 0; this.pulse = 0; }
  update(dt, g) {
    this.pulse += dt;
    if (this.hp <= 0) return;
    if (!this.near(g)) return;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && g.horde.list.filter((z) => z.ev === this.id).length < 45) {
      this.spawnT = 2;
      const a = Math.random() * 6.28, zb = g.horde.spawn(this.mix(g), this.x + Math.cos(a) * 6, this.z + Math.sin(a) * 6, {});
      zb.ev = this.id;
      g.fx.sparks([this.x, 2, this.z], 6, [0.5, 1, 0.3], 4, 0.5, 0.1, 3);
    }
  }
  shootables() { return this.hp > 0 ? [{ pos: [this.x, 3.5, this.z], r: 5, hit: (dmg, g) => this.hit(dmg, g) }] : []; }
  hit(dmg, g) {
    if (this.hp <= 0) return false;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.done = true;
      for (let i = 0; i < 5; i++) setTimeout(() => g.boom([this.x + (Math.random() - 0.5) * 8, 2 + Math.random() * 4, this.z + (Math.random() - 0.5) * 8], 1.8), i * 150);
      g.addScrap(350); g.banner('NEST DESTROYED', '+350 SCRAP', 'good', 2.2); g.snd.finish?.();
      g.horde.blast([this.x, 2, this.z], 18, 400, 20, 'nest');
      return true;
    }
    return false;
  }
  marker() { return { p: [this.x, 10, this.z], col: '#c46bff', icon: '☣', text: 'NEST', sub: `${Math.ceil((this.hp / this.max) * 100)}%` }; }
  parts(P, t) { nestParts(P, this.x, this.z, this.hp / this.max, t); }
  net() { return { k: 'nest', x: this.x, z: this.z, h: Math.round((this.hp / this.max) * 100) / 100 }; }
}
export function nestParts(P, x, z, k, t) {
  if (k <= 0) return;
  const p = 1 + Math.sin(t * 3) * 0.06;
  P([x, 2.4, z], [0, t * 0.2, 0], [9 * p, 5.5 * p, 9 * p], [0.25, 0.12, 0.2], { shape: 'sphere' });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3, q = 1 + Math.sin(t * 4 + i) * 0.15;
    P([x + Math.cos(a) * 4.2, 1.2, z + Math.sin(a) * 4.2], [0, a, 0], [2.6 * q, 2.4 * q, 2.6 * q], [0.45, 1, 0.25], { em: 0.8, shape: 'sphere' });
    P([x + Math.cos(a) * 7, 0.4, z + Math.sin(a) * 7], [0, -a, 0.4], [0.8, 0.8, 6], [0.2, 0.1, 0.16], { shape: 'cyl' });
  }
  P([x, 6.2, z], [0, 0, 0], [3 * p, 3 * p, 3 * p], [0.6, 1, 0.3], { em: 1, shape: 'sphere' });
}

export class Crate extends Ev {
  constructor(x, z) {
    super('crate', 'SUPPLY CRATE', x, z);
    this.y = 140; this.vy = -6; this.landed = false; this.carried = false;
    this.tgt = { kind: 'chase', sticky: true, r: 1.4, alive: true, x, z };
    this.hp = 300; this.spawnT = 3;
  }
  update(dt, g) {
    if (this.carried) { const p = g.heli.toWorld([0, -6.5, 0.3]); this.x = p[0]; this.y = p[1]; this.z = p[2]; this.tgt.x = this.x; this.tgt.z = this.z; return; }
    if (!this.landed) {
      this.y += this.vy * dt;
      const floor = g.groundAt(this.x, this.z);
      if (this.y <= floor) { this.y = floor; this.landed = true; g.fx.dust([this.x, this.y, this.z], 10); }
      return;
    }
    this.tgt.x = this.x; this.tgt.z = this.z;
    if (!this.near(g) || this.y > 1) return;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && g.horde.list.filter((z) => z.ev === this.id).length < 18) { this.spawnT = 2.6; this.spawnAt(g, this.mix(g), this.x, this.z, this.tgt); }
  }
  hitTarget(tgt, dmg, g) {
    if (this.carried) return;
    this.hp -= dmg;
    if (this.hp <= 0) { this.done = true; this.tgt.alive = false; g.feed('THE ZOMBIES BROKE INTO THE CRATE', 'r'); g.fx.sparks([this.x, this.y + 1, this.z], 20, [0.6, 0.45, 0.2], 6, 1, 0.2, 3); }
  }
  marker() { return { p: [this.x, this.y + 4, this.z], col: '#ff9f3a', icon: '▣', text: this.carried ? 'CRATE · TAKE IT TO A BASE' : 'SUPPLY CRATE', sub: this.landed && !this.carried ? `${Math.ceil((this.hp / 300) * 100)}%` : '' }; }
  parts(P, t, person, heli) { crateParts(P, this.x, this.y, this.z, this.landed, this.carried, t, heli); }
  net() { return { k: 'crate', x: this.x, y: this.y, z: this.z, l: this.landed, c: this.carried }; }
}
export function crateParts(P, x, y, z, landed, carried, t, heli) {
  P([x, y + 0.9, z], [0, 0.3, 0], [1.8, 1.8, 1.8], [0.45, 0.36, 0.2], { tex: 12, shape: 0.05 });
  P([x, y + 0.9, z], [0, 0.3, 0], [1.85, 0.25, 1.85], [0.85, 0.2, 0.15], { shape: 0.03 });
  if (!landed) {
    P([x, y + 9, z], [0, t * 0.5, 0], [8, 2.5, 8], [0.95, 0.9, 0.85], { shape: 'sphere', mat: 'cloth' });
    for (const [dx, dz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) P([x + dx / 2, y + 5, z + dz / 2], [Math.atan2(dz, 7) * 0.5, 0, -Math.atan2(dx, 7) * 0.5], [0.05, 7, 0.05], [0.9, 0.9, 0.9], {});
  }
  if (carried && heli) {
    const top = heli.toWorld([0, -1.9, 0.3]), l = Math.hypot(top[0] - x, top[1] - (y + 1.8), top[2] - z);
    P([(top[0] + x) / 2, (top[1] + y + 1.8) / 2, (top[2] + z) / 2], [Math.atan2(top[2] - z, top[1] - y) * 0, 0, 0], [0.06, l, 0.06], [0.1, 0.1, 0.1], {});
  }
  if (landed && !carried) P([x, y + 2.2, z], [0, 0, 0], [0.25, 0.25, 0.25], [1, 0.6, 0.2], { em: (t * 2) % 1 < 0.5 ? 1 : 0.2, shape: 'sphere' });
}

export class Siege extends Ev {
  constructor(fob) { super('siege', 'SIEGE', fob.padAt[0], fob.padAt[2]); this.fob = fob; this.y = 0; this.left = 0; this.started = false; }
  update(dt, g) {
    if (!this.started) {
      this.started = true;
      for (let i = 0; i < 40; i++) { const z = this.spawnAt(g, i % 5 === 0 ? 'runner' : i % 13 === 0 ? 'brute' : 'walker', this.x, this.z, this.fob, true); if (z) z.siege = this.id; }
      g.banner(`${this.fob.name} UNDER ATTACK`, 'GET THERE AND HELP', 'bad', 2.4); g.snd.alarm?.();
    }
    this.left = g.horde.list.filter((z) => z.alive && z.siege === this.id).length;
    if (this.fob.wrecked) { this.done = true; for (const z of g.horde.list) if (z.siege === this.id) z.keep = false; return; }
    if (this.left === 0) { this.done = true; g.addScrap(300); g.banner('BASE SAVED', `${this.fob.name} · +300 SCRAP`, 'good', 2.2); g.snd.finish?.(); }
  }
  marker() { return { p: [this.x, 8, this.z], col: '#ff5a3a', icon: '⚔', text: `${this.fob.name} UNDER ATTACK`, sub: `${this.left} LEFT · BASE ${Math.ceil((this.fob.hp / this.fob.max) * 100)}%` }; }
  net() { return { k: 'siege' }; }
}

export class Titan extends Ev {
  constructor(g, fob) {
    const a = Math.atan2(fob.padAt[2], fob.padAt[0]) + Math.PI + (Math.random() - 0.5) * 0.8;
    super('titan', 'TITAN', Math.cos(a) * (WORLD - 30), Math.sin(a) * (WORLD - 30));
    this.fob = fob; this.y = 0;
    this.z0 = g.horde.spawn('titan', this.x, this.z, { tgt: fob });
    this.z0.keep = true; this.z0.ev = this.id;
    g.banner('A TITAN IS COMING', `IT'S HEADING FOR ${fob.name}`, 'bad', 3); g.snd.alarm?.();
  }
  update(dt, g) {
    const T = this.z0;
    if (!T.alive) { this.done = true; return; }
    this.x = T.x; this.z = T.z;
    if (this.fob.wrecked) { T.tgt = g.fobs.find((f) => !f.wrecked && !f.fuelOnly) || null; if (T.tgt) this.fob = T.tgt; }
  }
  marker() { return { p: [this.x, this.z0.s * 2.1, this.z], col: '#ff5a3a', icon: '☠', text: 'TITAN', sub: `${Math.ceil((this.z0.hp / this.z0.max) * 100)}%` }; }
  net() { return { k: 'titan' }; }
}

// keeps a few scenarios going
export class Director {
  constructor() { this.list = []; this.newT = 6; this.titanT = 240; }
  clear() { this.list.length = 0; this.newT = 6; this.titanT = 240; }
  start(g) {
    this.add(g, 'rescue'); this.add(g, 'rescue'); this.add(g, 'crate'); this.add(g, 'convoy');
  }
  add(g, kind) {
    const H = g.heli.pos, map = g.map;
    let ev = null;
    if (kind === 'rescue') {
      const used = new Set(this.list.filter((e) => e.kind === 'rescue').map((e) => e.roof.box.id));
      const c = map.roofs.filter((r) => !used.has(r.box.id) && Math.hypot(r.x - H[0], r.z - H[2]) > 120 && Math.hypot(r.x - H[0], r.z - H[2]) < 700);
      if (c.length) ev = new Rescue(c[Math.floor(Math.random() * c.length)]);
    } else if (kind === 'convoy') {
      if (this.list.some((e) => e.kind === 'convoy')) return null;
      const roads = map.roads.filter((r) => !g.fobById(r.fob).wrecked);
      if (roads.length) { const r = roads[Math.floor(Math.random() * roads.length)]; ev = new Convoy(r, g.fobById(r.fob)); }
    } else if (kind === 'nest' || kind === 'crate') {
      const spots = map.open.filter(([x, z]) => Math.hypot(x - H[0], z - H[2]) > 150 && !this.list.some((e) => Math.hypot(e.x - x, e.z - z) < 80));
      if (spots.length) { const [x, z] = spots[Math.floor(Math.random() * spots.length)]; ev = kind === 'nest' ? new Nest(x, z) : new Crate(x + (Math.random() - 0.5) * 10, z + (Math.random() - 0.5) * 10); }
    } else if (kind === 'siege') {
      const f = g.fobs.filter((f) => !f.fuelOnly && !f.wrecked && !this.list.some((e) => e.fob === f));
      if (f.length) ev = new Siege(f[Math.floor(Math.random() * f.length)]);
    } else if (kind === 'titan') {
      const f = g.fobs.filter((f) => !f.fuelOnly && !f.wrecked);
      if (f.length) ev = new Titan(g, f[Math.floor(Math.random() * f.length)]);
    }
    if (ev) this.list.push(ev);
    return ev;
  }
  update(dt, g) {
    for (const e of this.list) e.update(dt, g);
    for (const e of this.list) if (e.done && e.kind === 'rescue') g.horde.dropField(`roof${e.roof.box.id}`);
    this.list = this.list.filter((e) => !e.done || (e.kind === 'crate' && e.carried));
    this.newT -= dt; this.titanT -= dt;
    const n = this.list.filter((e) => e.kind !== 'siege' && e.kind !== 'titan').length;
    if (this.newT <= 0 && n < 5) {
      this.newT = 22 + Math.random() * 14;
      const w = [['rescue', 4], ['crate', 2], ['nest', 1.5], ['convoy', 1.2], ['siege', g.time > 150 ? 0.8 : 0]];
      let r = Math.random() * w.reduce((a, b) => a + b[1], 0), kind = 'rescue';
      for (const [k, v] of w) { if ((r -= v) <= 0) { kind = k; break; } }
      this.add(g, kind);
    }
    if (this.titanT <= 0 && !this.list.some((e) => e.kind === 'titan')) { this.titanT = 300 + Math.random() * 120; this.add(g, 'titan'); }
  }
  shootables() { return this.list.flatMap((e) => e.shootables()); }
}
