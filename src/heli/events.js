// DEAD AIR: things happening round the world (on top of the buildings you can raid with your team).
//   RESCUE   people stuck on a roof, waving a green flare. The infected pile up the walls to get them, so be quick:
//            land on the roof (or winch them up) and press E. Bring them back to the Spire.
//   CRATE    a supply drop parachuting in. Land next to it (or hook it) and press E; carry it back to the Spire.
//   BRIDGE   a crowd stuck in the traffic jam on one of the big bridges, and the dead walking in from both ends along
//            the deck. Land on the bridge next to them and press E (it takes a few trips).
//   HORDE    a migrating horde: hundreds of them, walking across the country towards a town. Thin them out with
//            bombs and rockets before they get there. Far away it's just a number on the map; get close and there they are.
// A scenario's zombies only turn up when you're near it, so nothing goes wrong far away while you're busy.
import { WATER } from './terrain.js';
import { WORLD } from './map.js';

const NEAR = 320;
const dist2 = (a, x, z) => Math.hypot(a.x - x, a.z - z);
export { randName } from './team.js';

class Ev {
  constructor(kind, name, x, z) { this.kind = kind; this.name = name; this.x = x; this.z = z; this.done = false; this.id = Math.random().toString(36).slice(2, 7); }
  near(g) { return dist2(this, g.heli.pos[0], g.heli.pos[2]) < NEAR; }
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
  mix(g) { const r = Math.random(), t = g.time; return t > 60 && r < 0.2 ? 'runner' : r > 0.9 ? 'crawler' : t > 90 && r > 0.86 && r <= 0.9 ? 'screamer' : 'walker'; }
  parts() {}
}

export class Rescue extends Ev {
  constructor(roof) {
    super('rescue', 'RESCUE', roof.x, roof.z);
    this.roof = { ...roof, kind: 'roof', active: true, count: 2 + Math.floor(Math.random() * 4), wave: Math.random() * 6 };
    this.roof.start = this.roof.count;
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
    for (let i = 0; i < r.count; i++) { const a = (r.start - r.count + i) * 2.1 + r.wave; person(r.x + Math.cos(a) * 2.4, r.top, r.z + Math.sin(a) * 2.4, -a, true, i); }
    P([r.x + 3, r.top + 0.3, r.z + 3], [0, 0, 0], [0.5, 0.5, 0.5], [0.4, 1, 0.4], { em: 1, shape: 'sphere' });
    P([r.x + 3, r.top + 45, r.z + 3], [0, 0, 0], [1.8, 90, 1.8], [0.3, 1, 0.35], { em: 1, shape: 'cylY', alpha: 0.16 });
  }
  net() { const r = this.roof; return { k: 'rescue', x: r.x, y: r.top, z: r.z, n: r.count, s: r.start, w: r.wave }; }
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
    if (!r.active || r.count <= 0) { r.active = false; this.done = true; for (const z of g.horde.list) if (z.ev === this.id) { z.keep = false; z.roof = null; z.st = 'fall'; z.vel = [0, 0, 0]; } return; }
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
    const d = Math.hypot(this.x - g.heli.pos[0], this.z - g.heli.pos[2]);
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
      for (const z of g.horde.list) if (z.ev === this.id) { z.keep = false; z.ev = null; z.tgt = null; }
    }
  }
  make(g) {
    const R = Math.sqrt(this.start) * 1.7;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * R, x = this.x + Math.cos(a) * r, z = this.z + Math.sin(a) * r;
      if (g.horde.blockedAt(x, z)) continue;
      const zb = g.horde.spawn(Math.random() < 0.12 ? 'runner' : Math.random() < 0.05 ? 'screamer' : 'walker', x, z, { tgt: this.tgt });
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
    if (this.carried) return;
    this.hp -= dmg;
    if (this.hp <= 0) { this.done = true; this.tgt.alive = false; g.feed('THE INFECTED SMASHED THE CRATE OPEN', 'r'); }
  }
  marker() { return { p: [this.x, this.y + 4, this.z], col: '#ff9f3a', icon: '▣', text: this.carried ? 'CRATE · TAKE IT TO THE SPIRE' : 'SUPPLY DROP', sub: this.landed && !this.carried ? `${Math.ceil((this.hp / 300) * 100)}%` : '' }; }
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
    P([(top[0] + x) / 2, (top[1] + y + 1.8) / 2, (top[2] + z) / 2], [0, 0, 0], [0.06, l, 0.06], [0.1, 0.1, 0.1], {});
  }
  if (landed && !carried) P([x, y + 2.2, z], [0, 0, 0], [0.25, 0.25, 0.25], [1, 0.6, 0.2], { em: (t * 2) % 1 < 0.5 ? 1 : 0.2, shape: 'sphere' });
}

export class Director {
  constructor() { this.list = []; this.newT = 6; }
  clear() { this.list.length = 0; this.newT = 6; }
  start(g) { this.add(g, 'rescue'); this.add(g, 'rescue'); this.add(g, 'crate'); this.hordeT = 70; this.add(g, 'horde'); }
  add(g, kind) {
    const H = g.heli.pos, map = g.map;
    let ev = null;
    const far = g.S && g.S.radio ? 1900 : 1000;
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
    this.list = this.list.filter((e) => !e.done || (e.kind === 'crate' && e.carried));
    this.newT -= dt;
    if (this.newT <= 0 && this.list.filter((e) => e.kind !== 'horde').length < 4) {
      this.newT = 30 + Math.random() * 20;
      const r = Math.random();
      this.add(g, r < 0.12 && !this.list.some((e) => e.br) ? 'bridge' : r < 0.72 ? 'rescue' : 'crate');
    }
    this.hordeT = (this.hordeT ?? 200) - dt;
    if (this.hordeT <= 0 && this.list.filter((e) => e.kind === 'horde').length < 2) { this.hordeT = 200 + Math.random() * 160; this.add(g, 'horde'); }
  }
  shootables() { return []; }
}
