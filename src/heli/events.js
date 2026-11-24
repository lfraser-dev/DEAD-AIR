// DEAD AIR: things happening round the world (on top of the buildings you can raid with your team).
//   RESCUE   people stuck on a roof, waving a green flare. The infected pile up the walls to get them, so be quick:
//            land on the roof (or winch them up) and press E. Bring them back to the Spire.
//   CRATE    a supply drop parachuting in. Land next to it (or hook it) and press E; carry it back to the Spire.
//   BRIDGE   a crowd stuck in the traffic jam on one of the big bridges, and the dead walking in from both ends along
//            the deck. Land on the bridge next to them and press E (it takes a few trips).
//   CRASH    a helicopter came down on a roof: the crew are alive, the wreck's burning, everything heard it.
//   OUTBREAK a town square full of them. Clear it (kill nine in ten) before the clock runs out or it spreads.
//   CONVOY   survivors' trucks driving down a road to safety. They only move while you're overhead: clear the
//            road ahead and keep the dead off them.
//   HORDE    a migrating horde: hundreds of them, walking across the country towards a town. Thin them out with
//            bombs and rockets before they get there. Far away it's just a number on the map; get close and there they are.
// A scenario's zombies only turn up when you're near it, so nothing goes wrong far away while you're busy.
import { WATER } from './terrain.js';
import { WORLD } from './map.js';
import { pickType, BOSS_TYPES } from './horde.js';

const NEAR = 320;
const dist2 = (a, x, z) => Math.hypot(a.x - x, a.z - z);
export { randName } from './team.js';

class Ev {
  constructor(kind, name, x, z) { this.kind = kind; this.name = name; this.x = x; this.z = z; this.done = false; this.id = Math.random().toString(36).slice(2, 7); }
  // how far the nearest player is (the host, or a friend flying their own helicopter)
  dist(g) { return g.pilotDist ? g.pilotDist(this.x, this.z) : dist2(this, g.heli.pos[0], g.heli.pos[2]); }
  near(g) { return this.dist(g) < NEAR; }
  edgeSpot(g, x, z, r0 = 50, r1 = 100) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, r = r0 + Math.random() * (r1 - r0), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (Math.abs(px) < WORLD - 10 && Math.abs(pz) < WORLD - 10 && !g.horde.blockedAt(px, pz)) return [px, pz];
    }
    return null;
  }
  spawnAt(g, type, x, z, tgt) {
    const p = this.edgeSpot(g, x, z);
    if (!p) return null;
    const zb = g.horde.spawn(type, p[0], p[1], { tgt });
    zb.ev = this.id;
    return zb;
  }
  mix(g) { return pickType(g.night || 0, g.time, true); }
  parts() {}
}

export class Rescue extends Ev {
  constructor(roof) {
    super('rescue', 'RESCUE', roof.x, roof.z);
    this.roof = { ...roof, kind: 'roof', active: true, count: 2 + Math.floor(Math.random() * 4), wave: Math.random() * 6 };
    this.roof.start = this.roof.count;
    // where they stand: off to one side, clear of the stair hut and the plant room in the middle of the roof
    this.roof.sx0 = roof.bridge ? roof.x : roof.x - (roof.sx || 12) * 0.3; this.roof.sz0 = roof.bridge ? roof.z : roof.z + (roof.sz || 12) * 0.3;
    this.spawnT = 0; this.spawned = 0;
  }
  update(dt, g) {
    const r = this.roof;
    if (!r.active || r.count <= 0) { r.active = false; this.done = true; return; }
    if (!this.near(g)) return;
    this.spawnT -= dt;
    // a steady trickle, never an impossible flood: enough to build a pile if you take your time
    if (this.spawnT <= 0 && this.spawned < 30 + g.time / 30) { this.spawnT = 2.4; this.spawned++; this.spawnAt(g, this.mix(g), r.x, r.z, r); }
  }
  marker(g) {
    const p = g.horde.piles.get(`roof${this.roof.box.id}`);
    const k = p ? Math.min(1, p.h / Math.max(1, p.reach)) : 0;
    return { p: [this.x, this.roof.top + 4, this.z], col: '#7dff9a', icon: this.roof.count, text: 'SOS', sub: k > 0.05 ? `⚠ PILE ${Math.round(k * 100)}% UP THE WALL` : '' };
  }
  parts(P, t, person) {
    const r = this.roof;
    const sx = r.sx0 ?? r.x, sz = r.sz0 ?? r.z;
    for (let i = 0; i < r.count; i++) { const a = (r.start - r.count + i) * 2.1 + r.wave; person(sx + Math.cos(a) * 1.8, r.top, sz + Math.sin(a) * 1.8, -a, true, i); }
    P([sx + 2.2, r.top + 0.3, sz - 2.2], [0, 0, 0], [0.5, 0.5, 0.5], [0.4, 1, 0.4], { em: 1, shape: 'sphere' });
    P([sx + 2.2, r.top + 45, sz - 2.2], [0, 0, 0], [1.8, 90, 1.8], [0.3, 1, 0.35], { em: 1, shape: 'cylY', alpha: 0.16 });
  }
  net() { const r = this.roof; return { k: 'rescue', x: r.sx0 ?? r.x, y: r.top, z: r.sz0 ?? r.z, n: r.count, s: r.start, w: r.wave }; }
}

// survivors on a bridge deck; the dead come along the deck from both ends
export class BridgeRescue extends Rescue {
  constructor(br) {
    const P = 14;
    super({ box: br.box, top: br.top, x: br.x, z: br.z, h: br.h });
    this.kind = 'rescue'; this.name = 'BRIDGE';
    this.br = br;
    this.roof.count = this.roof.start = 6 + Math.floor(Math.random() * 5);
    this.roof.pick = { min: [br.x - P, br.top - 1, br.z - P], max: [br.x + P, br.top, br.z + P] };
    this.roof.bridge = true;
  }
  update(dt, g) {
    const r = this.roof;
    if (!r.active || r.count <= 0) { if (!this.done && r.count <= 0) g.storyHit?.('bridge', 1); r.active = false; this.done = true; for (const z of g.horde.list) if (z.ev === this.id) { z.keep = false; z.roof = null; z.st = 'fall'; z.vel = [0, 0, 0]; } return; }
    if (!this.near(g)) return;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.spawned < 90) {
      this.spawnT = 1.1; this.spawned++;
      const b = this.br, end = Math.random() < 0.5 ? b.xa : b.xb, x = end + Math.sign(b.x - end) * (6 + Math.random() * 20), z = b.z + (Math.random() - 0.5) * 18;
      const zb = g.horde.spawn(this.mix(g), x, z);
      zb.y = b.top; zb.st = 'roof'; zb.roof = r; zb.ev = this.id; zb.keep = true;
    }
  }
  marker(g) {
    const n = g.horde.list.filter((z) => z.ev === this.id && z.alive).length;
    return { p: [this.x, this.roof.top + 4, this.z], col: '#7dff9a', icon: this.roof.count, text: 'SOS · BRIDGE', sub: n ? `⚠ ${n} ON THE BRIDGE` : '' };
  }
}

// a migrating horde: a big crowd walking towards a town. Only real (zombies you can see and shoot) when you're near.
const SKULL = '☠';
export class HordeEv extends Ev {
  constructor(town, x, z, n) {
    super('horde', 'HORDE', x, z);
    this.town = town; this.n = this.start = n; this.real = false; this.spd = 1.5; this.arrived = 0;
    this.tgt = { kind: 'chase', sticky: true, r: town.r * 0.5, alive: true, x: town.x, z: town.z, field: `horde${this.id}` };
  }
  update(dt, g) {
    const d = this.dist(g);
    const mine = this.real ? g.horde.list.filter((z) => z.ev === this.id) : [];
    if (this.real) {
      const live = mine.filter((z) => z.alive);
      this.n = live.length + (this.unspawned || 0);
      if (live.length) { let sx = 0, sz = 0; for (const z of live) { sx += z.x; sz += z.z; } this.x = sx / live.length; this.z = sz / live.length; }
      // top up as they arrive in view
      if (this.unspawned > 0) { for (let k = 0; k < 40 && this.unspawned > 0; k++) { if (this.make(g)) this.unspawned--; else break; } }
      if (d > 760) { this.real = false; for (const z of mine) z.alive = false; this.n = Math.max(this.n, 0); }
    } else {
      // out of sight: just a number moving across the map
      const dx = this.town.x - this.x, dz = this.town.z - this.z, dd = Math.hypot(dx, dz);
      if (dd > this.town.r) { this.x += (dx / dd) * this.spd * dt; this.z += (dz / dd) * this.spd * dt; }
      else this.arrived += dt * this.n * 0.05;
      if (d < 620) { this.real = true; this.unspawned = this.n; }
    }
    if (this.arrived >= 30 || (Math.hypot(this.town.x - this.x, this.town.z - this.z) < this.town.r && this.n > 20)) { this.overrun(g); return; }
    if (this.n <= Math.max(12, this.start * 0.08)) {
      this.done = true;
      const bonus = 300 + Math.round(this.start * 0.6);
      g.addScrap(bonus); g.save.events = (g.save.events || 0) + 1;
      g.banner('HORDE BROKEN', `${this.town.name} IS SAFE · +⚙${bonus}`, 'g', 3);
      g.storyHit?.('horde', 1);
      for (const z of g.horde.list) if (z.ev === this.id) { z.keep = false; z.ev = null; z.tgt = null; }
    }
  }
  make(g) {
    const R = Math.sqrt(this.start) * 1.7;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * R, x = this.x + Math.cos(a) * r, z = this.z + Math.sin(a) * r;
      if (g.horde.blockedAt(x, z)) continue;
      const zb = g.horde.spawn(pickType(g.night || 0, g.time, false), x, z, { tgt: this.tgt });
      zb.ev = this.id; zb.keep = true;
      return zb;
    }
    return null;
  }
  hitTarget(tgt, dmg) { this.arrived += dmg / 6; }
  overrun(g) {
    this.done = true;
    g.banner('TOO LATE', `THE HORDE OVERRAN ${this.town.name}`, 'r', 3);
    g.feed(`${this.town.name} IS GONE`, 'r');
    for (const z of g.horde.list) if (z.ev === this.id) { z.keep = false; z.ev = null; z.tgt = null; }
  }
  marker() { return { p: [this.x, (this.y || 20) + 30, this.z], col: '#ff4a3a', icon: SKULL, text: `HORDE · ${this.n}`, sub: `HEADING FOR ${this.town.name}`, horde: true, r: Math.sqrt(this.n) * 1.7 }; }
  net() { return { k: 'horde', x: this.x, z: this.z, n: this.n }; }
}

export class Crate extends Ev {
  constructor(x, z) {
    super('crate', 'SUPPLY DROP', x, z);
    this.y = 160; this.landed = false; this.carried = false;
    this.tgt = { kind: 'chase', sticky: true, r: 1.4, alive: true, x, z };
    this.hp = 300; this.spawnT = 3;
  }
  update(dt, g) {
    if (this.dust) { const d = this.dust.pos; this.x = d[0]; this.y = d[1] - 7; this.z = d[2]; this.tgt.x = this.x; this.tgt.z = this.z; return; }
    if (this.carried) { const p = g.heli.toWorld([0, -6.5, 0.3]); this.x = p[0]; this.y = p[1]; this.z = p[2]; this.tgt.x = this.x; this.tgt.z = this.z; return; }
    if (!this.landed) {
      this.y -= 6 * dt;
      const floor = g.groundAt(this.x, this.z);
      if (this.y <= floor) { this.y = floor; this.landed = true; g.fx.dust([this.x, this.y, this.z], 10); }
      return;
    }
    this.tgt.x = this.x; this.tgt.z = this.z;
    if (!this.near(g)) return;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && g.horde.list.filter((z) => z.ev === this.id).length < 14) { this.spawnT = 3; this.spawnAt(g, this.mix(g), this.x, this.z, this.tgt); }
  }
  hitTarget(tgt, dmg, g) {
    if (this.carried || this.dust) return;
    this.hp -= dmg;
    if (this.hp <= 0) { this.done = true; this.tgt.alive = false; g.feed('THE INFECTED SMASHED THE CRATE OPEN', 'r'); }
  }
  marker() { return { p: [this.x, this.y + 4, this.z], col: '#ff9f3a', icon: '▣', text: this.carried ? 'CRATE · TAKE IT TO THE SPIRE' : 'SUPPLY DROP', sub: this.landed && !this.carried ? `${Math.ceil((this.hp / 300) * 100)}%` : '' }; }
  parts(P, t, person, heli) { crateParts(P, this.x, this.y, this.z, this.landed, this.carried, t, heli); }
  net() { return { k: 'crate', x: this.x, y: this.y, z: this.z, l: this.landed, c: this.carried, dz: !!this.dust, dn: !!this.done }; }
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
    P([(top[0] + x) / 2, (top[1] + y + 1.8) / 2, (top[2] + z) / 2], [0, 0, 0], [0.06, l, 0.06], [0.1, 0.1, 0.1], {});
  }
  if (landed && !carried) P([x, y + 2.2, z], [0, 0, 0], [0.25, 0.25, 0.25], [1, 0.6, 0.2], { em: (t * 2) % 1 < 0.5 ? 1 : 0.2, shape: 'sphere' });
}

// a helicopter down on a roof: the crew are on the roof by the burning wreck
export class CrashSite extends Rescue {
  constructor(roof) {
    super(roof);
    this.name = 'CRASH SITE'; this.crash = true;
    this.roof.count = this.roof.start = 2 + Math.floor(Math.random() * 3);
    this.roof.eaten = 0;
    this.wx = roof.x + (roof.sx || 16) * 0.27; this.wz = roof.z - (roof.sz || 16) * 0.27;
    this.yaw = Math.random() * 6.28; this.smokeT = 0; this.paid = false;
  }
  update(dt, g) {
    const r = this.roof;
    if (r.count <= 0 && !this.paid) {
      this.paid = true;
      const saved = r.start - (r.eaten || 0);
      if (saved > 0) g.storyHit?.('crash', 1);
      if (saved > 0) { const b = 150 + saved * 90; g.addScrap(b); g.save.events = (g.save.events || 0) + 1; g.banner('CREW RECOVERED', `THE BLACK BOX TOO · +⚙${b}`, 'g', 3); }
    }
    super.update(dt, g);
    if (!this.near(g)) return;
    // the wreck smokes
    this.smokeT -= dt;
    if (this.smokeT <= 0 && g.smokes) {
      this.smokeT = 0.35;
      g.smokes.push({ pos: [this.wx + (Math.random() - 0.5) * 2, r.top + 1.5, this.wz + (Math.random() - 0.5) * 2], t: 0, life: 7 + Math.random() * 3, size: 2.5 + Math.random() * 2, drift: [0.6, 0.3], fire: Math.random() < 0.3 ? 0.6 : 0 });
    }
  }
  marker(g) { const m = super.marker(g); return { ...m, col: '#ffb03a', text: 'CRASH SITE', icon: this.roof.count }; }
  parts(P, t, person) {
    super.parts(P, t, person);
    wreckParts(P, this.wx, this.roof.top, this.wz, this.yaw, t);
  }
  net() { return { ...super.net(), k: 'crash', wx: this.wx, wz: this.wz, yw: this.yaw }; }
}
export function wreckParts(P, x, y, z, yaw, t) {
  const c = Math.cos(yaw), s = Math.sin(yaw), W = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const BURNT = [0.13, 0.12, 0.11];
  P(W(0, 1.35, 0), [0.15, yaw, 1.35], [1, 1, 1], BURNT, { shape: 'h_hornet', mat: 'metal', tex: 68 });
  P(W(0.2, 0.25, 3.6), [0.3, yaw + 0.5, 0.2], [0.26, 0.28, 2.4], BURNT, { shape: 'cyl', mat: 'metal' });
  for (let k = 0; k < 3; k++) P(W(-1.5 + k * 1.4, 0.12, -1 + k * 0.9), [0.05 * k, yaw + k * 1.9, 0.1], [0.4, 0.06, 3 + k], [0.08, 0.08, 0.08], { mat: 'metal' });
  P(W(0, 0.6, 0.4), [0, 0, 0], [1.6, 1.0, 1.6], [1, 0.45, 0.1], { em: 0.7 + 0.3 * Math.sin(t * 13), shape: 'sphere', alpha: 0.55 });
  P(W(-1.4, 0.05, 1.2), [0, 0, 0], [2.4, 0.04, 2.0], [0.04, 0.04, 0.04], { alpha: 0.7 });
}

// an outbreak: a town square packed with them. Clear it before the clock runs out.
export class Outbreak extends Ev {
  constructor(town) {
    super('outbreak', 'OUTBREAK', town.x, town.z);
    this.town = town; this.start = 120 + Math.floor(Math.random() * 90); this.left = this.start; this.real = false; this.time = 210; this.y = town.y || 10;
    this.tgt = { kind: 'chase', sticky: true, r: 26, alive: true, x: town.x, z: town.z, field: `ob${this.id}` };
  }
  update(dt, g) {
    const d = this.dist(g);
    if (!this.real) { if (d < 650) { this.real = true; this.unspawned = this.left; g.feed(`OUTBREAK IN ${this.town.name}: CLEAR IT!`, 'r'); } return; }
    const mine = g.horde.list.filter((z) => z.ev === this.id && z.alive);
    if (this.unspawned > 0) for (let k = 0; k < 30 && this.unspawned > 0; k++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 45, x = this.x + Math.cos(a) * r, z = this.z + Math.sin(a) * r;
      if (g.horde.blockedAt(x, z)) continue;
      const zb = g.horde.spawn(this.mix(g), x, z, { tgt: this.tgt }); zb.ev = this.id; zb.keep = true; this.unspawned--;
    }
    this.left = mine.length + (this.unspawned || 0);
    if (d > 950) { this.real = false; for (const z of mine) z.alive = false; return; }   // you left: they stay put, the clock stops
    this.time -= dt;
    if (this.left <= Math.ceil(this.start * 0.1)) {
      this.done = true;
      const b = 400 + Math.round(this.start * 1.5);
      g.addScrap(b); g.save.events = (g.save.events || 0) + 1;
      g.banner('OUTBREAK CLEARED', `${this.town.name} · +⚙${b}`, 'g', 3);
      g.storyHit?.('outbreak', 1);
      for (const z of mine) { z.keep = false; z.ev = null; z.tgt = null; }
    } else if (this.time <= 0) {
      this.done = true;
      g.banner('IT SPREAD', `THE OUTBREAK IN ${this.town.name} GOT AWAY`, 'r', 3);
      for (const z of mine) { z.keep = false; z.ev = null; z.tgt = null; z.angry = 30; }
    }
  }
  marker() { return { p: [this.x, this.y + 30, this.z], col: '#ff6a2a', icon: '☣', text: `OUTBREAK · ${this.left}`, sub: this.real ? `CLEAR IT · ${Math.max(0, Math.ceil(this.time))}s` : this.town.name, horde: true, r: 45 }; }
  net() { return { k: 'outbreak', x: this.x, z: this.z, n: this.left }; }
}

// a convoy of survivors' trucks driving along a road. They move while you're near; anything on the road ahead stops them.
export class Convoy extends Ev {
  constructor(path) {
    super('convoy', 'CONVOY', path[0][0], path[0][1]);
    this.path = path; this.L = 0;
    for (const p of path) { p.s = this.L; this.L += p.len; }
    this.s = 30; this.hp = this.max = 1000; this.spawnT = 2; this.trucks = [];
    this.tgt = { kind: 'chase', sticky: true, r: 4, alive: true, x: this.x, z: this.z };
    this.blocked = false; this.place();
  }
  at(s) {
    s = Math.max(0, Math.min(this.L - 0.01, s));
    let i = 0; while (i < this.path.length - 1 && this.path[i + 1].s <= s) i++;
    const p = this.path[i], f = (s - p.s) / p.len;
    return [p[0] + (p[2] - p[0]) * f, p[4] + (p[5] - p[4]) * f, p[1] + (p[3] - p[1]) * f, Math.atan2(p[2] - p[0], p[3] - p[1])];
  }
  place() {
    this.trucks = [0, 1, 2].map((k) => this.at(this.s - k * 13));
    const m = this.trucks[1]; this.x = m[0]; this.z = m[2]; this.tgt.x = m[0]; this.tgt.z = m[2];
  }
  update(dt, g) {
    const d = this.dist(g), near = d < 450;
    const lead = this.trucks[0];
    // anything standing on the road just ahead blocks it
    let block = 0;
    if (near) for (const z of g.horde.list) if (z.alive && Math.abs(z.x - lead[0]) < 14 && Math.abs(z.z - lead[2]) < 14) { const ahead = (z.x - lead[0]) * Math.sin(lead[3]) + (z.z - lead[2]) * Math.cos(lead[3]); if (ahead > 0 && ahead < 12) block++; }
    this.blocked = block >= 3;
    if (near && !this.blocked) { this.s += 6.5 * dt; this.place(); }
    if (this.s >= this.L - 5) {
      this.done = true; this.tgt.alive = false;
      const b = 500 + Math.round((this.hp / this.max) * 500);
      g.addScrap(b); g.save.events = (g.save.events || 0) + 1; g.save.saved = (g.save.saved || 0) + 8;
      g.banner('CONVOY SAFE', `8 SURVIVORS MADE IT · +⚙${b}`, 'g', 3);
      g.save.rescued = (g.save.rescued || 0) + 8; g.storyHit?.('convoy', 1);
      for (const z of g.horde.list) if (z.ev === this.id) { z.keep = false; z.ev = null; z.tgt = null; }
      return;
    }
    if (!near) return;
    // they come at it from the sides of the road ahead
    this.spawnT -= dt;
    if (this.spawnT <= 0 && g.horde.list.filter((z) => z.ev === this.id && z.alive).length < 45) {
      this.spawnT = 1.1;
      const ah = this.at(this.s + 50 + Math.random() * 90), side = Math.random() < 0.5 ? -1 : 1, off = 14 + Math.random() * 22;
      const x = ah[0] + Math.cos(ah[3]) * off * side, z = ah[2] - Math.sin(ah[3]) * off * side;
      if (!g.horde.blockedAt(x, z)) { const zb = g.horde.spawn(this.mix(g), x, z, { tgt: this.tgt }); zb.ev = this.id; zb.keep = true; }
    }
  }
  hitTarget(tgt, dmg, g) {
    if (this.done) return;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.done = true; this.tgt.alive = false;
      g.banner('CONVOY LOST', 'THEY OVERRAN THE TRUCKS', 'r', 3);
      for (const t of this.trucks) g.fires?.push({ pos: [t[0], t[1], t[2]], r: 5, t: 10, tick: 0 });
      for (const z of g.horde.list) if (z.ev === this.id) { z.keep = false; z.ev = null; z.tgt = null; }
    }
  }
  marker() {
    const left = Math.max(0, Math.round(this.L - this.s));
    return { p: [this.x, this.trucks[1][1] + 8, this.z], col: '#7ad7ff', icon: '⛟', text: this.blocked ? 'CONVOY · ROAD BLOCKED' : 'CONVOY', sub: `${Math.ceil((this.hp / this.max) * 100)}% · ${left} M TO GO` };
  }
  parts(P) { convoyParts(P, this.trucks); }
  net() { return { k: 'convoy', t: this.trucks.map((t) => t.map((v) => Math.round(v * 10) / 10)) }; }
}
export function convoyParts(P, trucks) {
  trucks.forEach((t, k) => {
    const [x, y, z, yaw] = t, c = Math.cos(yaw), s = Math.sin(yaw), W = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const col = k === 1 ? [0.75, 0.72, 0.65] : [0.3, 0.38, 0.25];
    P(W(0, 0.9, 2.6), [0, yaw, 0], [2.3, 1.9, 2.0], col, { shape: 0.12, mat: 'paint' });
    P(W(0, 1.4, 3.55), [0, yaw, 0], [2.0, 0.8, 0.1], [0.1, 0.13, 0.16], { mat: 'glass' });
    P(W(0, 1.7, -1.4), [0, yaw, 0], [2.4, 2.8, 5.6], k === 1 ? [0.85, 0.85, 0.82] : [0.36, 0.4, 0.3], { shape: 0.06, mat: k === 1 ? 'paint' : 'cloth' });
    if (k === 1) for (const sd of [-1, 1]) P(W(sd * 1.22, 1.9, -1.4), [0, yaw, 0], [0.02, 0.9, 0.9], [0.85, 0.1, 0.1], {});
    for (const lz of [2.6, -0.4, -3]) for (const sd of [-1, 1]) P(W(sd * 1.1, 0.45, lz), [0, yaw, Math.PI / 2], [0.9, 0.4, 0.9], [0.06, 0.06, 0.06], { shape: 'cylY' });
    for (const sd of [-0.8, 0.8]) P(W(sd, 0.95, 3.62), [0, yaw, 0], [0.3, 0.2, 0.05], [1, 0.95, 0.75], { em: 1 });
  });
}

// ---------------------------------------------------------------- the big ones (mostly from the story)
// MAST: a radio mast on a hill. Land on its pad and press E: your engineer gets the radios going (it takes a while) and
// everything on the hill comes for the hut. Keep them off it.
export class MastEv extends Ev {
  constructor(mast) {
    super('mast', mast.name, mast.x, mast.z);
    this.mast = mast; this.y = mast.y; this.prog = 0; this.working = false; this.hut = 100; this.spawnT = 0;
    this.tgt = { kind: 'chase', sticky: true, r: 4, alive: true, x: mast.hut[0], z: mast.hut[2], field: `mast${mast.n}` };
  }
  start(g) { if (this.working) return; this.working = true; this.hut = 100; g.feed(`ENGINEER ON THE GROUND AT ${this.name} · KEEP THEM OFF THE HUT`, 'y'); g.radio?.(`${this.name}: I'm in. Give me a minute to get the radios going. Keep them off me.`); }
  update(dt, g) {
    if (!this.working) return;
    const d = this.dist(g);
    if (d > 500) { this.working = false; this.prog = Math.max(0, this.prog - 0.25); g.feed(`YOU LEFT THE ENGINEER AT ${this.name} · THEY HID`, 'r'); return; }
    this.prog += dt / 55;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && g.horde.list.filter((z) => z.ev === this.id && z.alive).length < 70) { this.spawnT = 0.55; this.spawnAt(g, this.mix(g), this.x, this.z, this.tgt); }
    if (this.prog >= 1) {
      this.done = true; this.tgt.alive = false; this.mast.on = true;
      g.addScrap(400); g.save.events = (g.save.events || 0) + 1;
      g.banner(`${this.name} BACK ON THE AIR`, '+⚙400', 'g', 3); g.snd?.finish?.();
      g.storyHit?.('mast', this.mast.n);
      for (const z of g.horde.list) if (z.ev === this.id) { z.keep = false; z.ev = null; z.tgt = null; }
    }
  }
  spawnAt(g, type, x, z, tgt) { const p = this.edgeSpot(g, x, z, 60, 120); if (!p) return null; const zb = g.horde.spawn(type, p[0], p[1], { tgt }); zb.ev = this.id; zb.keep = true; return zb; }
  hitTarget(tgt, dmg, g) {
    this.hut -= dmg * 0.7;
    if (this.hut <= 0) { this.working = false; this.prog = Math.max(0, this.prog - 0.4); this.hut = 100; g.banner('THE ENGINEER HAD TO RUN', `${this.name} · LAND AND TRY AGAIN`, 'r', 2.6); for (const z of g.horde.list) if (z.ev === this.id) { z.tgt = null; z.keep = false; z.ev = null; } }
  }
  marker() { return { p: [this.x, this.mast.top + 4, this.z], col: '#ffd23a', icon: '📡', text: this.name, sub: this.working ? `FIXING ${Math.floor(this.prog * 100)}% · HUT ${Math.ceil(this.hut)}%` : 'LAND ON THE PAD AND PRESS E', story: true }; }
  parts(P, t, person) {
    if (!this.working) return;
    const [hx, hy, hz] = this.mast.hut;
    person(hx - 4, hy, hz + 1, Math.sin(t) * 0.5 + 1.6, false, 3);
    if (Math.sin(t * 9) > 0.6) P([hx - 4.6, hy + 1.3, hz + 0.6], [0, 0, 0], [0.25, 0.25, 0.25], [1, 0.9, 0.5], { em: 1, shape: 'sphere' });
  }
  net() { return { k: 'mast', x: this.x, z: this.z, p: this.prog, wk: !!this.working, my: this.mast.y, nm: this.name }; }
}

// FORT CALDER: the base is full of them. Kill nine in ten and it's yours: a second base with fuel, repairs and guns.
export class FortEv extends Ev {
  constructor(fort) {
    super('fort', 'FORT CALDER', fort.x, fort.z);
    this.fort = fort; this.y = fort.y; this.start = 340; this.left = this.start; this.real = false;
    this.tgt = { kind: 'chase', sticky: true, r: 60, alive: true, x: fort.x, z: fort.z, field: `fort${this.id}` };
  }
  update(dt, g) {
    const d = this.dist(g);
    if (!this.real) { if (d < 700) { this.real = true; this.unspawned = this.left; g.radio?.('Fort Calder dead ahead. The whole garrison turned. Clear the place out and we can use it.'); } return; }
    const mine = g.horde.list.filter((z) => z.ev === this.id && z.alive);
    if (this.unspawned > 0) for (let k = 0; k < 40 && this.unspawned > 0; k++) {
      const x = this.x + (Math.random() - 0.5) * 200, z = this.z + (Math.random() - 0.5) * 200;
      if (g.horde.blockedAt(x, z)) continue;
      const zb = g.horde.spawn(Math.random() < 0.3 ? 'riot' : this.mix(g), x, z, { tgt: this.tgt }); zb.ev = this.id; zb.keep = true; this.unspawned--;
    }
    this.left = mine.length + (this.unspawned || 0);
    if (d > 1000) { this.real = false; for (const z of mine) z.alive = false; return; }
    if (this.left <= Math.ceil(this.start * 0.1)) {
      this.done = true; this.fort.locked = false;
      g.addScrap(1500); g.save.events = (g.save.events || 0) + 1;
      g.banner('FORT CALDER IS OURS', 'A SECOND BASE · FUEL, REPAIRS AND GUNS · +⚙1500', 'g', 4); g.snd?.finish?.();
      g.storyHit?.('fort');
      for (const z of mine) { z.keep = false; z.ev = null; z.tgt = null; }
    }
  }
  marker() { return { p: [this.x, this.y + 30, this.z], col: '#c8ff5a', icon: '★', text: `FORT CALDER · ${this.left}`, sub: this.real ? 'CLEAR OUT THE GARRISON' : 'TAKE IT BACK', horde: this.real, r: 90, story: true }; }
  net() { return { k: 'fort', x: this.x, z: this.z, n: this.left }; }
}

// EVACUATION: St Mary's. Thirty people on the roof and the whole district coming. It takes trips.
export class Evac extends Rescue {
  constructor(h) {
    const r = h.roof;
    super({ ...r, sx: r.sx, sz: r.sz });
    this.name = 'EVACUATION'; this.evac = true; this.hosp = h;
    this.roof.count = this.roof.start = 30;
    this.roof.sx0 = r.x - 8; this.roof.sz0 = r.z + 6;
    this.announced = false;
  }
  update(dt, g) {
    const r = this.roof;
    if (r.count <= 0 && !this.paid) {
      this.paid = true;
      const saved = r.start - (r.eaten || 0);
      g.addScrap(1000 + saved * 40); g.save.events = (g.save.events || 0) + 1;
      g.banner("ST MARY'S IS EMPTY", `${saved} PEOPLE GOT OUT · +⚙${1000 + saved * 40}`, 'g', 4);
      g.storyHit?.('evac', saved);
    }
    if (!r.active || r.count <= 0) { r.active = false; this.done = true; return; }
    if (!this.near(g)) return;
    if (!this.announced) { this.announced = true; g.radio?.("St Mary's roof, this is the Spire. We see you. Hang on, help's coming. Pilot: this'll take more than one trip."); }
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.spawned < 600) { this.spawnT = 0.45; this.spawned++; const zb = this.spawnAt(g, Math.random() < 0.3 ? 'runner' : this.mix(g), r.x, r.z, r); if (zb) zb.keep = true; }
  }
  edgeSpot(g, x, z) { return super.edgeSpot(g, x, z, 70, 160); }
  marker(g) { const m = super.marker(g); return { ...m, col: '#ff6aa0', text: "EVACUATION · ST MARY'S", story: true }; }
}

// THE SIEGE: everything in the city comes for the Spire at once, in waves. They go for the doors at the bottom. If the
// doors go, the Spire loses power: no fuel, repairs or guns for two minutes.
export class Siege extends Ev {
  constructor(sp) {
    super('siege', 'THE SIEGE', sp.foot[0], sp.foot[2]);
    this.sp = sp; this.gate = this.gateMax = 2400; this.wave = 0; this.waves = 6; this.waveT = 25; this.toSpawn = 0; this.spawnT = 0; this.t = 0;
    this.tgt = { kind: 'chase', sticky: true, r: 6, alive: true, x: sp.foot[0], z: sp.foot[2], field: `siege${this.id}` };
  }
  update(dt, g) {
    this.t += dt;
    const mine = g.horde.list.filter((z) => z.ev === this.id && z.alive);
    this.alive = mine.length;
    this.waveT -= dt;
    if (this.waveT <= 0 && this.wave < this.waves) {
      this.wave++; this.waveT = 55; this.toSpawn += 120 + this.wave * 40;
      g.banner(`WAVE ${this.wave} OF ${this.waves}`, 'THEY\'RE COMING FOR THE SPIRE', 'bad', 2.5); g.snd?.alarm?.();
      this.dirs = [0, 1, 2].map(() => Math.random() * Math.PI * 2);
    }
    this.spawnT -= dt;
    while (this.toSpawn > 0 && this.spawnT <= 0) {
      this.spawnT += 0.04;
      const a = this.dirs[Math.floor(Math.random() * this.dirs.length)] + (Math.random() - 0.5) * 0.5, r = 330 + Math.random() * 120;
      const x = this.x + Math.cos(a) * r, z = this.z + Math.sin(a) * r;
      if (g.horde.blockedAt(x, z)) continue;
      const type = this.wave >= 4 && Math.random() < 0.08 ? 'brute' : Math.random() < 0.25 ? 'runner' : this.mix(g);
      const zb = g.horde.spawn(type, x, z, { tgt: this.tgt }); zb.ev = this.id; zb.keep = true; this.toSpawn--;
    }
    if (this.wave >= this.waves && this.toSpawn <= 0 && mine.length < 20) {
      this.done = true; this.tgt.alive = false;
      const b = 2500 + Math.round((this.gate / this.gateMax) * 1500);
      g.addScrap(b); g.save.events = (g.save.events || 0) + 1;
      g.banner('THE SPIRE HELD', `+⚙${b}`, 'g', 4); g.snd?.finish?.();
      g.storyHit?.('siege');
      for (const z of mine) { z.keep = false; z.ev = null; z.tgt = null; }
    }
  }
  hitTarget(tgt, dmg, g) {
    if (this.done) return;
    this.gate -= dmg;
    if (this.gate <= 0 && !this.sp.wrecked) {
      this.gate = this.gateMax * 0.5;
      this.sp.wrecked = true; this.sp.wreckT = 120;
      g.banner('THE DOORS ARE DOWN', 'THE SPIRE HAS NO POWER FOR 2 MINUTES · KEEP KILLING', 'bad', 3); g.snd?.fail?.();
    }
  }
  marker() { return { p: [this.x, this.sp.pos[1] + 12, this.z], col: '#ff3a3a', icon: '⚔', text: `THE SIEGE · WAVE ${this.wave}/${this.waves}`, sub: `DOORS ${Math.ceil((this.gate / this.gateMax) * 100)}% · ${(this.alive || 0) + this.toSpawn} LEFT`, story: true, horde: true, r: 60 }; }
  net() { return { k: 'siege', x: this.x, z: this.z, w: this.wave }; }
}

// THE GREAT HORDE: every zombie for miles, walking on the city. It's a horde, but enormous.
export class GreatHorde extends HordeEv {
  constructor(town, x, z, n) { super(town, x, z, n); this.great = true; this.spd = 1.1; }
  update(dt, g) {
    const was = this.done;
    super.update(dt, g);
    if (!was && this.done && this.n <= Math.max(12, this.start * 0.08)) g.storyHit?.('great');
  }
  overrun(g) {
    // the great horde never really "wins": it hits the city and turns round for another go
    g.banner('THEY REACHED THE CITY', 'THE HORDE IS REGROUPING · HIT THEM AGAIN', 'r', 3);
    this.arrived = 0; const a = Math.random() * 6.28; this.x = this.town.x + Math.cos(a) * 900; this.z = this.town.z + Math.sin(a) * 900;
    for (const z of g.horde.list) if (z.ev === this.id) z.alive = false;
    this.real = false;
  }
  marker() { const m = super.marker(); return { ...m, col: '#b02aff', text: `THE GREAT HORDE · ${this.n}`, story: true }; }
}

// BOSSES: a giant walking for a town. Each has its own trick, and they all swat anything that comes too close.
export const BOSSES = {
  goliath: { n: 'GOLIATH', sub: 'THROWS CARS · STAY MOVING', col: '#ff4a2a', scrap: 1500, lore: "ATLAS subject one. It throws cars like stones: never hover where it can see you." },
  spitter: { n: 'THE SPITTER', sub: 'SPITS ACID AT ANYTHING FLYING', col: '#9aff3a', scrap: 1200, lore: "It lives in the chemical works now and it spits that stuff. Keep moving and keep your distance." },
  mother: { n: 'THE BROODMOTHER', sub: 'KEEPS MAKING MORE OF THEM', col: '#ff8a6a', scrap: 1300, lore: "Every one of those glowing things on its back is another runner. Kill it fast or you'll be fighting its children all day." },
};
export const CARS = [[0.6, 0.12, 0.1], [0.15, 0.25, 0.5], [0.75, 0.75, 0.72], [0.12, 0.12, 0.13], [0.8, 0.65, 0.15]];
export class BossEv extends Ev {
  constructor(bk, x, z, town, lair) {
    super('boss', BOSSES[bk].n, x, z);
    this.bk = bk; this.town = town; this.lair = lair || null; this.wind = 0; this.atkT = 4; this.swipeT = 0; this.spawnT = 3; this.shots = []; this.z0 = null; this.y = 0; this.saidT = 0;
  }
  update(dt, g) {
    if (!this.z0) {
      const Z = this.z0 = g.horde.spawn(this.bk, this.x, this.z);
      Z.ev = this.id; Z.side = Math.random() < 0.5 ? 1 : -1;
      if (this.town) Z.goal = { x: this.town.x, z: this.town.z };
    }
    const Z = this.z0, B = BOSSES[this.bk];
    this.x = Z.x; this.z = Z.z; this.y = Z.y;
    // what it's thrown or spat, flying
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const sh = this.shots[i];
      sh.t += dt; sh.v[1] -= (sh.k === 'r' ? 9.8 : 5) * dt;
      for (let k = 0; k < 3; k++) sh.p[k] += sh.v[k] * dt;
      sh.spin += dt * 4;
      let hit = false;
      for (const P of g.pilots()) {
        if (Math.hypot(P.pos[0] - sh.p[0], P.pos[1] - sh.p[1], P.pos[2] - sh.p[2]) < (sh.k === 'r' ? 5.5 : 4.5)) { P.hurt(sh.k === 'r' ? 90 : 40, sh.p); hit = true; break; }
      }
      if (hit || sh.t > 9 || sh.p[1] < g.groundAt(sh.p[0], sh.p[2])) {
        if (sh.k === 'r') { g.boom?.(sh.p, 1.6); g.horde.blast(sh.p, 8, 200, 10, 'boss'); }
        else { g.boom?.(sh.p, 0.6); g.horde.blast(sh.p, 5, 60, 3, 'boss'); }
        this.shots.splice(i, 1);
      }
    }
    if (!Z.alive) {
      this.done = true;
      g.addScrap(B.scrap); g.save.events = (g.save.events || 0) + 1; g.save.bosses = (g.save.bosses || 0) + 1;
      g.banner(`${B.n} IS DOWN`, `+⚙${B.scrap.toLocaleString('en-GB')}`, 'good', 4);
      g.snd?.finish?.();
      const p = [Z.x, Z.y + Z.s, Z.z];
      for (let i = 0; i < 6; i++) setTimeout(() => g.boom?.([p[0] + (Math.random() - 0.5) * 14, p[1] + Math.random() * 6, p[2] + (Math.random() - 0.5) * 14], 2.2), i * 200);
      g.storyHit?.('boss', 1);
      if (g.save.story) { const pr = g.save.story.prog = g.save.story.prog || {}; (pr.killed = pr.killed || []).push(this.bk); }
      for (const z of g.horde.list) if (z.ev === this.id) { z.keep = false; z.ev = null; }
      return;
    }
    // it reached the town: it tears through it, then turns for the next one
    if (this.town && Math.hypot(Z.x - this.town.x, Z.z - this.town.z) < Math.max(25, this.town.r * 0.5)) {
      g.banner(`${B.n} TORE THROUGH ${this.town.name}`, 'IT\'S HEADING FOR THE NEXT TOWN', 'r', 3);
      const nx = (g.map.towns || []).filter((t) => t !== this.town).sort((a, b) => Math.hypot(a.x - Z.x, a.z - Z.z) - Math.hypot(b.x - Z.x, b.z - Z.z))[0];
      this.town = nx || null; Z.goal = nx ? { x: nx.x, z: nx.z } : null;
    }
    // attacks: only when someone's in reach
    const P = g.pilots().map((q) => ({ ...q, d: Math.hypot(q.pos[0] - Z.x, q.pos[2] - Z.z) })).sort((a, b) => a.d - b.d)[0];
    if (!P || P.d > 650) return;
    const rage = Z.hp < Z.max * 0.4 ? 0.6 : 1;
    if (rage < 1 && !this.raged) { this.raged = true; g.feed(`${B.n} IS ENRAGED`, 'r'); }
    this.atkT -= dt; this.swipeT -= dt; this.spawnT -= dt;
    const h = P.pos[1] - Z.y;
    // too close: it swats you
    if (this.swipeT <= 0 && P.d < Z.s * 3.2 && h < Z.s * 2.8) { this.swipeT = 2.5; Z.stomp = 0.7; P.hurt(120, P.pos); g.feed(`${B.n} SWATTED YOU`, 'r'); }
    const hand = [Z.x, Z.y + Z.s * 2, Z.z];
    if (Z.atk > 0) Z.atk = Math.max(0, Z.atk - dt / (this.bk === 'goliath' ? 0.9 : 0.55));
    // the throw / spit lets go at the end of the wind-up, aimed at wherever you are then
    const throwAt = (spd, grav, kind) => {
      const T = Math.min(4.5, Math.max(1, P.d / spd));
      const tg = [P.pos[0] + (P.vel[0] || 0) * T, P.pos[1] + (P.vel[1] || 0) * T * 0.5, P.pos[2] + (P.vel[2] || 0) * T];
      const v = [(tg[0] - hand[0]) / T, (tg[1] - hand[1]) / T + 0.5 * grav * T, (tg[2] - hand[2]) / T];
      this.shots.push({ k: kind, p: [...hand], v, t: 0, spin: 0, c: CARS[Math.floor(Math.random() * CARS.length)] });
      Z.yaw = Math.atan2(-(P.pos[0] - Z.x), -(P.pos[2] - Z.z));
    };
    if (this.wind > 0) { this.wind -= dt; if (this.wind <= 0) { if (this.bk === 'goliath') throwAt(42, 9.8, 'r'); else { Z.spit = 0.4; throwAt(60, 5, 'a'); } } }
    if (this.bk === 'goliath' && this.atkT <= 0 && P.d < 260) { this.atkT = 4.5 * rage; Z.stomp = 1.0; Z.atk = 1; this.wind = 0.85; g.roar?.(0.25, P.d); }
    if (this.bk === 'spitter' && this.atkT <= 0 && P.d < 300) { this.atkT = 1.9 * rage; Z.atk = 1; this.wind = 0.5; }
    if (Z.spit > 0) Z.spit -= dt;
    if (this.bk === 'mother' && this.spawnT <= 0 && P.d < 500) {
      this.spawnT = 3.5 * rage;
      const kids = g.horde.list.filter((z) => z.alive && z.ev === this.id && !z.boss).length;
      if (kids < 45) for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28, x = Z.x + Math.cos(a) * Z.s * 1.5, zz = Z.z + Math.sin(a) * Z.s * 1.5; if (g.horde.blockedAt(x, zz)) continue; const kz = g.horde.spawn('runner', x, zz); kz.ev = this.id; kz.keep = true; kz.angry = 20; }
    }
  }
  marker() {
    const B = BOSSES[this.bk], Z = this.z0;
    const pct = Z ? Math.max(1, Math.round(Z.hp / Z.max * 100)) : 100;
    return { p: [this.x, (this.y || 10) + (Z ? Z.s * 2.3 : 10) + 8, this.z], col: B.col, icon: '☠', text: `${B.n} · ${pct}%`, sub: this.town ? `HEADING FOR ${this.town.name}` : B.sub, boss: true, story: this.story };
  }
  parts(P) {
    for (const sh of this.shots) {
      if (sh.k === 'r') P(sh.p, [sh.spin, sh.spin * 0.7, 0], [2.0, 1.4, 4.2], sh.c, { shape: 0.15, mat: 'paint' });
      else P(sh.p, [0, 0, 0], [1.3, 1.3, 1.3], [0.55, 1, 0.2], { em: 1, shape: 'sphere' });
    }
  }
  net() {
    const Z = this.z0, r = (v) => Math.round(v * 10) / 10;
    return { k: 'boss', x: this.x, z: this.z, b: this.bk, w: Z && Z.atk > 0 ? 1 : 0, h: Z ? Math.round(Z.hp) : 1, m: Z ? Z.max : 1, p: this.shots.map((s) => [s.k, r(s.p[0]), r(s.p[1]), r(s.p[2]), r(s.spin), CARS.indexOf(s.c), r(s.v[0]), r(s.v[1]), r(s.v[2])]) };
  }
}

// HALDEN BIOLAB (story): clear the dead out of the compound, then a survivor shows herself on the office roof
export class LabEv extends Ev {
  constructor(lab) { super('lab', 'HALDEN BIOLAB', lab.x, lab.z); this.lab = lab; this.phase = 'clear'; this.spawned = 0; this.story = true; this.resc = null; }
  update(dt, g) {
    const L = this.lab;
    if (this.phase === 'clear') {
      if (this.dist(g) > 1100) return;
      if (!this.spawned) {
        for (let k = 0; k < 70; k++) { const a = Math.random() * 6.28, r = 15 + Math.random() * 80, x = L.x + Math.cos(a) * r, z = L.z + Math.sin(a) * r; if (g.horde.blockedAt(x, z)) continue; const zb = g.horde.spawn(k % 5 === 0 ? 'runner' : k % 11 === 0 ? 'brute' : 'walker', x, z); zb.ev = this.id; zb.keep = true; this.spawned++; }
        g.radio?.("Halden Biolab, pilot. Army quarantine site. Whatever they were working on in there... the place is crawling. Clear the yard and we'll see if anyone's left.", 8);
      }
      this.left = g.horde.list.filter((z) => z.alive && z.ev === this.id).length;
      if (this.left <= 10) {
        this.phase = 'roof';
        const R0 = L.roof;
        const r = this.resc = new Rescue({ box: R0.box, top: R0.top, x: R0.x, z: R0.z, sx: R0.sx, sz: R0.sz });
        r.roof.count = 1; r.roof.start = 1; r.hale = true; r.story = true;
        g.director.list.push(r);
        g.radio?.("There! On the office roof, somebody's waving a lab coat. Land up there and get them out, pilot. Quickly.", 7);
        g.feed('SURVIVOR ON THE BIOLAB ROOF', 'g');
      }
    } else if (this.phase === 'roof') {
      const r = this.resc;
      if (r.roof.count <= 0 || r.done) {
        this.phase = 'out'; this.done = true;
        g.storyHit?.('lab', 1);
        g.banner('DR. HALE IS SAFE', 'THE SCIENTIST FROM HALDEN BIOLAB', 'good', 4);
        setTimeout(() => g.radio?.("This is Dr. Ruth Hale. Thank you... I've been on that roof nine days. Listen to me: the black ones, the stalkers, aren't a mutation. We made them. Project ATLAS. The army wanted soldiers that could hunt in the dark. Three vats in the hall are still growing them. Smash them, and I can start on a cure.", 16), 2500);
      }
    }
  }
  marker() {
    const L = this.lab;
    if (this.phase === 'clear') return { p: [L.x, L.y + 30, L.z], col: '#ffd23a', icon: '☣', text: 'HALDEN BIOLAB', sub: this.spawned ? `CLEAR THE YARD · ${Math.max(0, (this.left || 0) - 10)} LEFT` : 'FLY OUT AND TAKE A LOOK', story: true };
    return { p: [L.x, L.y + 30, L.z], col: '#ffd23a', icon: '☣', text: 'HALDEN BIOLAB', sub: 'GET THE SURVIVOR OFF THE ROOF', story: true };
  }
  net() { return { k: 'lab', x: this.x, z: this.z }; }
}

// the three growth vats under HALDEN BIOLAB (story): shoot them, rocket them, bomb them
export class VatEv extends Ev {
  constructor(lab, gone) {
    super('vats', 'THE VATS', lab.x, lab.z); this.lab = lab; this.story = true;
    this.vats = lab.vats.map((v, i) => ({ i, pos: [v.x, v.y, v.z], r: 4.5, hp: gone.includes(i) ? 0 : 1500, max: 1500, parts: v.parts }));
    this.saidT = 0;
  }
  shootables(g) {
    return this.vats.filter((v) => v.hp > 0).map((v) => ({ pos: v.pos, r: v.r, hit: (d, gg) => this.hit(v, d, gg || g) }));
  }
  hit(v, d, g) {
    if (v.hp <= 0) return;
    v.hp -= d;
    if (v.hp > 0) return;
    v.hp = 0;
    for (const b of v.parts) b.hidden = true;
    g.boom?.([v.pos[0], v.pos[1] - 2, v.pos[2]], 2.5);
    for (let k = 0; k < 10; k++) g.fx?.flame([v.pos[0] + (Math.random() - 0.5) * 6, v.pos[1] - 6 + Math.random() * 4, v.pos[2] + (Math.random() - 0.5) * 6], [0, 3, 0], 2);
    const st = g.save.story; if (st) { st.vats = st.vats || []; if (!st.vats.includes(v.i)) st.vats.push(v.i); }
    g.storyHit?.('vat', 1);
    const left = this.vats.filter((q) => q.hp > 0).length;
    g.banner(left ? 'VAT DESTROYED' : 'PROJECT ATLAS IS OVER', left ? `${left} LEFT` : 'NO MORE NEW STALKERS', 'good', 3);
    if (!left) this.done = true;
  }
  update(dt, g) {
    if (this.vats.every((v) => v.hp <= 0)) this.done = true;
    if (!this.said && this.dist(g) < 500) { this.said = true; g.radio?.("Those are the growth vats, inside the hall with the hole in the wall. Rockets, bombs, whatever you've got. Don't stop until all three are glass.", 8); }
  }
  marker() {
    const left = this.vats.filter((v) => v.hp > 0), L = this.lab;
    const hp = left.reduce((a, v) => a + v.hp, 0) / (3 * 1500);
    return { p: [L.hall[0], L.hall[1] + 30, L.hall[2]], col: '#9aff3a', icon: '☣', text: `GROWTH VATS · ${left.length} LEFT`, sub: `${Math.round(hp * 100)}% · SHOOT THEM, BOMB THEM`, story: true };
  }
  net() { return { k: 'vats', x: this.x, z: this.z, v: this.vats.map((v) => [v.pos[0], v.pos[1], v.pos[2], Math.max(0, Math.round(v.hp))]) }; }
}

// THE CURE (story): pick up a cold case at Halden, then race it to a town before it warms up and spoils. Land in the
// middle of town: the cure goes out on the air and every zombie nearby drops.
export class CureEv extends Ev {
  constructor(lab, towns) {
    super('cure', 'THE CURE', lab.x, lab.z + 75); this.lab = lab; this.towns = towns; this.story = true;
    this.phase = 'pick'; this.t = 0; this.to = null; this.used = []; this.warn = 0;
  }
  landed(g, x, z, r) {
    const H = g.heli; if (!H || H.dead) return false;
    const agl = H.pos[1] - g.groundAt(H.pos[0], H.pos[2]);
    return Math.hypot(H.pos[0] - x, H.pos[2] - z) < r && agl < 4 && Math.hypot(...H.vel) < 5;
  }
  update(dt, g) {
    const H = g.heli; if (!H) return;
    if (this.phase === 'pick') {
      if (!this.landed(g, this.x, this.z, 22)) return;
      // the nearest town you haven't cured yet that's a proper flight away
      const c = this.towns.filter((t) => t.name !== 'NOWHERE' && !this.used.includes(t.name)).map((t) => [t, Math.hypot(t.x - this.x, t.z - this.z)]).filter((q) => q[1] > 700).sort((a, b) => a[1] - b[1]);
      const pick = c[Math.min(c.length - 1, Math.floor(Math.random() * 3))]; if (!pick) { this.done = true; return; }
      this.to = pick[0]; this.t = Math.round(pick[1] / 30 + 60); this.phase = 'carry'; this.warn = 0;
      g.banner('CURE CASE ABOARD', `GET IT TO ${this.to.name} · ${Math.floor(this.t / 60)}:${String(this.t % 60).padStart(2, '0')}`, 'good', 3);
      g.radio?.(`Case is loaded and it's cold. Get it to ${this.to.name} and land right in the middle of town. Go, go.`, 6);
      // the dead can smell it: they mob the town before you get there
      for (let k = 0; k < 45; k++) { const a = Math.random() * 6.28, r = 12 + Math.random() * 50, x = this.to.x + Math.cos(a) * r, z = this.to.z + Math.sin(a) * r; if (!g.horde.blockedAt(x, z)) { const zb = g.horde.spawn(this.mix(g), x, z); zb.ev = this.id; } }
      return;
    }
    if (this.phase === 'carry') {
      this.t -= dt;
      if (H.dead) { this.fail(g, 'THE CURE CASE WAS LOST IN THE CRASH'); return; }
      if (this.t <= 30 && this.warn < 1) { this.warn = 1; g.feed('CURE CASE WARMING UP · 30 SECONDS', 'r'); }
      if (this.t <= 0) { this.fail(g, 'THE CURE SPOILED · FLY BACK TO HALDEN FOR ANOTHER'); return; }
      if (this.landed(g, this.to.x, this.to.z, 45)) {
        // the cure goes out: every zombie close by goes down
        let n = 0;
        for (const z of g.horde.list) if (z.alive && Math.hypot(z.x - this.to.x, z.z - this.to.z) < 260) { g.fx?.sparks?.([z.x, z.y + 1.5, z.z], 6, [0.5, 1, 0.6], 3, 1, 0.05, 2); g.horde.damage(z, 1e5, [0, 0.5, 0], 'cure'); n++; }
        this.used.push(this.to.name); g.storyHit?.('cure', 1); g.addScrap?.(400);
        g.banner(`${this.to.name} IS CURED`, `${n} OF THEM DROPPED · +⚙400`, 'good', 4); g.snd?.finish?.();
        this.phase = this.used.length >= 3 ? 'done' : 'pick'; this.to = null;
        if (this.phase === 'done') this.done = true;
        else g.radio?.('It worked! They just... dropped. Get back to Halden, the next case is ready.', 6);
      }
    }
  }
  fail(g, why) { g.banner('CURE LOST', why, 'bad', 3); this.phase = 'pick'; this.to = null; }
  marker() {
    if (this.phase === 'carry' && this.to) { const s = Math.max(0, Math.ceil(this.t)); return { p: [this.to.x, (this.to.y || 0) + 30, this.to.z], col: s < 30 ? '#ff5a4a' : '#7dffd0', icon: '❄', text: `CURE → ${this.to.name}`, sub: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · LAND IN THE MIDDLE OF TOWN`, story: true }; }
    return { p: [this.x, (this.lab.y || 0) + 25, this.z], col: '#7dffd0', icon: '❄', text: 'CURE CASE', sub: `LAND AT HALDEN TO PICK IT UP · ${this.used.length}/3 DONE`, story: true };
  }
  parts(P) {
    if (this.phase !== 'pick') return;
    const y = this.lab.y || 0;
    P([this.x, y + 0.5, this.z], [0, 0, 0], [1.2, 0.8, 0.8], [0.85, 0.9, 0.95], { mat: 'paint' });
    P([this.x, y + 45, this.z], [0, 0, 0], [1.8, 90, 1.8], [0.4, 1, 0.85], { em: 1, shape: 'cylY', alpha: 0.16 });
  }
  net() { return { k: 'cure', x: this.x, z: this.z }; }
}

export class Director {
  constructor() { this.list = []; this.newT = 6; }
  clear() { this.list.length = 0; this.newT = 6; this.bossT = 420; }
  start(g) { this.add(g, 'rescue'); this.add(g, 'rescue'); this.add(g, 'crate'); this.add(g, 'convoy'); this.hordeT = 70; this.add(g, 'horde'); }
  add(g, kind, opt = {}) {
    const H = g.heli.pos, map = g.map;
    let ev = null;
    // how far you hear calls for help: your radio, plus every mast you've got working
    const masts = (g.map.masts || []).filter((m) => m.on).length;
    const far = (g.S && g.S.radio ? (g.S.radio === 2 ? 9000 : 1900) : 1000) * (1 + masts * 0.35);
    if (kind === 'bridge') {
      const used = new Set(this.list.filter((e) => e.br).map((e) => e.br));
      const c = (map.bridges || []).filter((b) => !used.has(b));
      if (c.length) ev = new BridgeRescue(c[Math.floor(Math.random() * c.length)]);
    } else if (kind === 'horde') {
      // pick a town, and start the horde a long walk away from it on open ground
      const towns = map.towns.filter((t) => Math.hypot(t.x - H[0], t.z - H[2]) < far * 1.6 && !this.list.some((e) => e.town === t));
      for (let tries = 0; tries < 20 && towns.length && !ev; tries++) {
        const t = towns[Math.floor(Math.random() * towns.length)], a = Math.random() * 6.28, d = 650 + Math.random() * 250;
        const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        if (Math.abs(x) > WORLD - 50 || Math.abs(z) > WORLD - 50 || g.horde.blockedAt(x, z)) continue;
        ev = new HordeEv(t, x, z, Math.round(260 + Math.random() * 340 + Math.min(400, g.time * 0.5)));
        g.feed(`RADIO: A HORDE IS HEADING FOR ${t.name}`, 'r');
      }
    } else if (kind === 'rescue') {
      const used = new Set(this.list.filter((e) => e.kind === 'rescue').map((e) => e.roof.box.id));
      const c = map.roofs.filter((r) => !used.has(r.box.id) && !r.loot && Math.hypot(r.x - H[0], r.z - H[2]) > 150 && Math.hypot(r.x - H[0], r.z - H[2]) < far && r.h < 45);
      if (c.length) ev = new Rescue(c[Math.floor(Math.random() * c.length)]);
    } else if (kind === 'crash') {
      const used = new Set(this.list.filter((e) => e.kind === 'rescue').map((e) => e.roof.box.id));
      const c = map.roofs.filter((r) => !used.has(r.box.id) && !r.loot && (r.sx || 0) >= 16 && (r.sz || 0) >= 16 && r.h < 70 && Math.hypot(r.x - H[0], r.z - H[2]) > 250 && Math.hypot(r.x - H[0], r.z - H[2]) < far);
      if (c.length) { ev = new CrashSite(c[Math.floor(Math.random() * c.length)]); g.feed('RADIO: MAYDAY, MAYDAY · A HELICOPTER IS DOWN', 'y'); }
    } else if (kind === 'outbreak') {
      const towns = map.towns.filter((t) => t.kind === 'town' && Math.hypot(t.x - H[0], t.z - H[2]) < far * 1.4 && !this.list.some((e) => e.town === t));
      if (towns.length) { const t = towns[Math.floor(Math.random() * towns.length)]; ev = new Outbreak(t); g.feed(`RADIO: OUTBREAK IN ${t.name}`, 'r'); }
    } else if (kind === 'convoy') {
      // a run of joined-up road at least 700 m long, starting within reach
      const R = map.roads;
      for (let tries = 0; tries < 40 && !ev; tries++) {
        let i = Math.floor(Math.random() * R.length);
        if (Math.hypot(R[i][0] - H[0], R[i][1] - H[2]) > far) continue;
        const path = [];
        let L = 0;
        while (i < R.length && path.length < 40) {
          const r = R[i], len = Math.hypot(r[2] - r[0], r[3] - r[1]);
          path.push(Object.assign([...r], { len })); L += len;
          if (i + 1 >= R.length || Math.hypot(R[i + 1][0] - r[2], R[i + 1][1] - r[3]) > 0.5) break;
          i++;
        }
        if (L > 700) { ev = new Convoy(path); g.feed('RADIO: SURVIVORS ARE MAKING A RUN FOR IT · ESCORT THE CONVOY', 'y'); }
      }
    } else if (kind === 'boss') {
      // a giant walks out of its den and heads for the nearest town
      const lairs = map.lairs || {}, alive = new Set(this.list.filter((e) => e.kind === 'boss').map((e) => e.bk));
      const kinds = (opt.bk ? [opt.bk] : BOSS_TYPES).filter((k) => lairs[k] && !alive.has(k));
      if (kinds.length) {
        const bk = kinds[Math.floor(Math.random() * kinds.length)], L = lairs[bk];
        const t = (map.towns || []).filter((q) => Math.hypot(q.x - L.x, q.z - L.z) > 350).sort((a2, b2) => Math.hypot(a2.x - L.x, a2.z - L.z) - Math.hypot(b2.x - L.x, b2.z - L.z))[0];
        ev = new BossEv(bk, L.x + (Math.random() - 0.5) * 20, L.z + (Math.random() - 0.5) * 20, t || null, L);
        g.feed(`RADIO: ${BOSSES[bk].n} IS ON THE MOVE FROM ${L.name}`, 'r');
        g.radio?.(`Pilot, the masts are shaking. ${BOSSES[bk].n} just walked out of ${L.name}${t ? ` and it's heading for ${t.name}` : ''}. ${BOSSES[bk].lore}`, 10);
        g.roar?.(0.5);
      }
    } else if (kind === 'crate') {
      const spots = map.open.filter(([x, z]) => Math.hypot(x - H[0], z - H[2]) > 160 && Math.hypot(x - H[0], z - H[2]) < 1000 && !this.list.some((e) => Math.hypot(e.x - x, e.z - z) < 80) && g.groundAt(x, z) > WATER + 1);
      if (spots.length) { const [x, z] = spots[Math.floor(Math.random() * spots.length)]; ev = new Crate(x + (Math.random() - 0.5) * 8, z + (Math.random() - 0.5) * 8); }
    }
    if (ev) this.list.push(ev);
    return ev;
  }
  update(dt, g) {
    for (const e of this.list) e.update(dt, g);
    for (const e of this.list) if (e.done && e.kind === 'rescue') g.horde.dropField(`roof${e.roof.box.id}`);
    for (const e of this.list) if (e.done && e.kind === 'outbreak') g.horde.dropField(`ob${e.id}`);
    this.list = this.list.filter((e) => !e.done || (e.kind === 'crate' && e.carried));
    this.newT -= dt;
    const cap = (g.save && g.save.base && g.save.base.radar ? 7 : 5) + (g.coop ? g.coop.friends.size : 0);
    if (this.newT <= 0 && this.list.filter((e) => e.kind !== 'horde' && !e.story).length < cap) {
      this.newT = 30 + Math.random() * 20;
      const r = Math.random();
      const has = (k) => this.list.some((e) => e.kind === k);
      this.add(g, r < 0.1 && !this.list.some((e) => e.br) ? 'bridge' : r < 0.2 && !this.list.some((e) => e.crash) ? 'crash' : r < 0.3 && !has('outbreak') ? 'outbreak' : r < 0.4 && !has('convoy') ? 'convoy' : r < 0.78 ? 'rescue' : 'crate');
    }
    this.hordeT = (this.hordeT ?? 200) - dt;
    if (this.hordeT <= 0 && this.list.filter((e) => e.kind === 'horde' && !e.story).length < 2) { this.hordeT = 200 + Math.random() * 160; this.add(g, 'horde'); }
  }
  shootables(g) { return this.list.filter((e) => e.shootables).flatMap((e) => e.shootables(g)); }
}
