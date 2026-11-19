// DEAD AIR: things happening round the world (on top of the buildings you can raid with your team).
//   RESCUE   people stuck on a roof, waving a green flare. The infected pile up the walls to get them, so be quick:
//            land on the roof (or winch them up) and press E. Bring them back to the Spire.
//   CRATE    a supply drop parachuting in. Land next to it (or hook it) and press E; carry it back to the Spire.
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
  start(g) { this.add(g, 'rescue'); this.add(g, 'rescue'); this.add(g, 'crate'); }
  add(g, kind) {
    const H = g.heli.pos, map = g.map;
    let ev = null;
    if (kind === 'rescue') {
      const used = new Set(this.list.filter((e) => e.kind === 'rescue').map((e) => e.roof.box.id));
      const c = map.roofs.filter((r) => !used.has(r.box.id) && !r.loot && Math.hypot(r.x - H[0], r.z - H[2]) > 150 && Math.hypot(r.x - H[0], r.z - H[2]) < 900 && r.h < 45);
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
    if (this.newT <= 0 && this.list.length < 4) {
      this.newT = 30 + Math.random() * 20;
      this.add(g, Math.random() < 0.7 ? 'rescue' : 'crate');
    }
  }
  shootables() { return []; }
}
