// DEAD AIR: the infected. Like DayZ / World War Z: no powers, just lots of them.
//   WALKER    the bulk: slow, shambling, never stops
//   RUNNER    sprints straight at you
//   CRAWLER   legs gone, drags itself along (hard to see in the long grass)
//   SCREAMER  shrieks when it spots you: everything nearby comes running
// They PILE UP. To get at people on a roof (or you, if you hover low) they climb over each other: a ramp of bodies up the
// wall, or a heap under the helicopter. Shoot the pile and it collapses. Hundreds of them, each a few shapes drawn in a
// handful of instanced batches. They find their way with flow fields (a "how far to the goal" map per target) over the
// ground, round buildings, water and cliffs.
// THOUSANDS: the streets fill up to how busy a place was (the city is packed, the countryside isn't). Zombies near you
// are worked out every frame in full; ones further off shuffle along more simply a few times a second, and are drawn as
// fewer shapes the further away they are (a full body close up, two boxes further out, one box in the distance).
import { compose, mat4, clamp } from '../math.js';
import { INST_FLOATS } from '../renderer.js';
import { WORLD } from './map.js';
import { WATER } from './terrain.js';

export const TYPES = {
  walker: { hp: 45, spd: [1.5, 2.5], s: 1, scrap: 2 },
  runner: { hp: 35, spd: [6.0, 7.4], s: 0.97, scrap: 3 },
  crawler: { hp: 30, spd: [0.8, 1.1], s: 1, scrap: 2 },
  screamer: { hp: 60, spd: [2.4, 2.9], s: 1.02, scrap: 8 },
  brute: { hp: 320, spd: [1.3, 1.9], s: 1.32, scrap: 18 },        // huge, tough, can't be knocked over; three of them on the skids is a lot
  bloater: { hp: 50, spd: [0.9, 1.4], s: 1.06, scrap: 7 },        // swollen up: bursts when it dies and takes the ones round it too
  riot: { hp: 110, spd: [1.7, 2.5], s: 1.0, scrap: 8 },           // riot police: helmet and vest shrug off bullets (explosives work)
};
// what turns up: mostly walkers, more runners at night and later on, the odd special
const SMALL_ARMS = new Set(['gun', 'door', 'turret', 'team', 'tail', 'drone']);
export function pickType(night = 0, t = 0, city = false) {
  const r = Math.random() * 100;
  const tab = [['runner', 9 + night * 14 + Math.min(8, t / 300)], ['crawler', 7], ['screamer', t > 60 ? 3 : 1], ['brute', t > 45 ? 2.2 : 0.4], ['bloater', 4], ['riot', city ? 6 : 2]];
  let a = 0;
  for (const [k, w] of tab) { a += w; if (r < a) return k; }
  return 'walker';
}
const SKINS = [[0.48, 0.5, 0.42], [0.55, 0.52, 0.45], [0.42, 0.44, 0.38], [0.6, 0.55, 0.48], [0.38, 0.33, 0.28]];
const SHIRT = [[0.3, 0.12, 0.1], [0.15, 0.2, 0.32], [0.38, 0.36, 0.3], [0.2, 0.25, 0.18], [0.45, 0.42, 0.38], [0.12, 0.12, 0.13], [0.42, 0.28, 0.12], [0.55, 0.55, 0.6], [0.6, 0.25, 0.35]];
const PANTS = [[0.15, 0.17, 0.24], [0.22, 0.2, 0.16], [0.12, 0.12, 0.12], [0.3, 0.28, 0.22], [0.35, 0.33, 0.3]];

const CELL = 4, GX0 = -WORLD, GZ0 = -WORLD, NX = Math.ceil((2 * WORLD) / CELL), NZ = NX;
const cellOf = (x, z) => { const i = Math.floor((x - GX0) / CELL), k = Math.floor((z - GZ0) / CELL); return i < 0 || k < 0 || i >= NX || k >= NZ ? -1 : k * NX + i; };
const FR = 110, HB = 1 << 16;
const fv = (F, c) => { const a = (c % NX) - F.i0, b = Math.floor(c / NX) - F.k0; return a < 0 || b < 0 || a >= F.W || b >= F.W ? 65535 : F.f[b * F.W + a]; };
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export class Horde {
  constructor(world, effects) {
    this.world = world; this.T = world.terrain; this.fx = effects;
    this.list = []; this.shots = []; this.events = [];
    this.m = mat4();
    this.fields = new Map();
    this.piles = new Map();
    this.head = new Int32Array(HB); this.next = new Int32Array(8000); this.frameN = 0; this.popT = 0;
    // squares zombies can't stand in (buildings, water, cliffs), worked out 16 x 16 squares at a time when first asked
    this.blk = new Uint8Array(NX * NZ);        // 0 = not worked out yet, 1 = open, 2 = blocked
    this.blockedAt = (x, z) => { const c = cellOf(x, z); return c < 0 || this.isBlocked(c); };
  }
  isBlocked(c) { let v = this.blk[c]; if (!v) { this.blockTile(c); v = this.blk[c]; } return v === 2; }
  blockTile(c) {
    const T = this.T, world = this.world, i0 = (c % NX) - ((c % NX) % 16), k0 = Math.floor(c / NX) - (Math.floor(c / NX) % 16);
    for (let k = k0; k < Math.min(NZ, k0 + 16); k++) for (let i = i0; i < Math.min(NX, i0 + 16); i++) {
      const x = GX0 + (i + 0.5) * CELL, z = GZ0 + (k + 0.5) * CELL, gy = T.heightAt(x, z);
      const b = gy < WATER + 0.4 || T.slopeAt(x, z) > 0.55 || World_pointInside(world, [x, gy + 2, z]) || World_pointInside(world, [x + 1.4, gy + 2, z + 1.4]) || World_pointInside(world, [x - 1.4, gy + 2, z - 1.4]);
      this.blk[k * NX + i] = b ? 2 : 1;
    }
  }

  clear() { this.list.length = 0; this.events.length = 0; this.piles.clear(); }
  groundAt(x, z) { return this.T.heightAt(x, z); }

  // distance-to-goal for every square within FR squares of the goal (further out they just head straight for it)
  field(key, isGoal, cx, cz) {
    let F = this.fields.get(key);
    if (F) return F;
    const W = FR * 2 + 1, i0 = Math.floor((cx - GX0) / CELL) - FR, k0 = Math.floor((cz - GZ0) / CELL) - FR;
    const f = new Uint16Array(W * W).fill(65535), q = new Int32Array(W * W); let h = 0, t = 0;
    F = { f, i0, k0, W };
    const ok = (i, k) => i >= 0 && k >= 0 && i < NX && k < NZ && !this.isBlocked(k * NX + i);
    for (let b = 0; b < W; b++) for (let a = 0; a < W; a++) {
      const i = i0 + a, k = k0 + b;
      if (ok(i, k) && isGoal(GX0 + (i + 0.5) * CELL, GZ0 + (k + 0.5) * CELL)) { f[b * W + a] = 0; q[t++] = b * W + a; }
    }
    while (h < t) {
      const c = q[h++], a = c % W, b = (c - a) / W, d = f[c] + 1;
      for (let n = 0; n < 4; n++) {
        const aa = a + N8[n][0], bb = b + N8[n][1];
        if (aa < 0 || bb < 0 || aa >= W || bb >= W) continue;
        const cc = bb * W + aa;
        if (f[cc] <= d || !ok(i0 + aa, k0 + bb)) continue;
        f[cc] = d; q[t++] = cc;
      }
    }
    if (this.fields.size > 40) this.fields.delete(this.fields.keys().next().value);
    this.fields.set(key, F);
    return F;
  }
  roofField(r) { const b = r.box; return this.field(`roof${b.id}`, (x, z) => x > b.min[0] - 5 && x < b.max[0] + 5 && z > b.min[2] - 5 && z < b.max[2] + 5, r.x, r.z); }
  pointField(key, px, pz, r = 6) { return this.field(key, (x, z) => Math.hypot(x - px, z - pz) < r, px, pz); }
  dropField(key) { this.fields.delete(key); }

  spawn(type, x, z, o = {}) {
    const T = TYPES[type] || TYPES.walker, r = Math.random;
    const zb = {
      type, x, y: this.groundAt(x, z), z, yaw: r() * 6.28, hp: T.hp, max: T.hp, s: T.s * (0.92 + r() * 0.16),
      spd: T.spd[0] + r() * (T.spd[1] - T.spd[0]), ph: r() * 6.28, st: 'walk', tgt: o.tgt || null, cd: 1 + r() * 3,
      skin: SKINS[Math.floor(r() * SKINS.length)], shirt: SHIRT[Math.floor(r() * SHIRT.length)], pants: PANTS[Math.floor(r() * PANTS.length)],
      vel: [0, 0, 0], hitT: 0, grip: 0, slot: -1, think: r(), dx: 0, dz: 0, side: (r() - 0.5) * 2, alive: true, seen: 0, id: Math.floor(r() * 1e9),
      torn: r() < 0.5, hunch: r() * 0.25, tilt: 0, roll: 0,
    };
    if (type === 'screamer') { zb.skin = [0.62, 0.58, 0.55]; zb.shirt = [0.75, 0.73, 0.7]; }
    if (type === 'brute') { zb.skin = [0.46, 0.5, 0.43]; zb.shirt = [0.3, 0.27, 0.24]; zb.pants = [0.22, 0.24, 0.28]; zb.torn = true; }
    if (type === 'bloater') { zb.skin = [0.58, 0.62, 0.36]; zb.shirt = [0.55, 0.5, 0.4]; }
    if (type === 'riot') { zb.shirt = [0.08, 0.1, 0.16]; zb.pants = [0.07, 0.09, 0.14]; zb.torn = false; }
    this.list.push(zb);
    return zb;
  }
  count(type) { let n = 0; for (const z of this.list) if (z.alive && (!type || z.type === type)) n++; return n; }

  // ---- piles: a ramp of bodies against a wall, or a heap under the helicopter
  // key -> { x, y, z (base), nx, nz (which way the ramp leans out; 0,0 = a heap), reach (how high it has to get), members, h }
  pile(key, x, y, z, nx, nz, reach) {
    let p = this.piles.get(key);
    if (!p) { p = { key, x, y, z, nx, nz, reach, members: [], h: 0, t: 0 }; this.piles.set(key, p); }
    p.reach = reach;
    return p;
  }
  joinPile(z, p) { if (z.pile === p) return; z.st = 'pile'; z.pile = p; z.pileT = p.t++; p.members.push(z); }
  leavePile(z) { const p = z.pile; if (!p) return; p.members = p.members.filter((m) => m !== z); z.pile = null; z.tilt = 0; z.roll = 0; }
  // where a member stands: later arrivals climb higher; each body adds ~0.38 m
  pileTick(dt, H) {
    for (const [key, p] of this.piles) {
      p.members = p.members.filter((m) => m.alive && m.pile === p);
      if (!p.members.length && key === 'heli') { p.h = 0; p.top = p.y; continue; }
      if (!p.members.length) { this.piles.delete(key); if (p.roof) this.dropField(`foot${p.roof.box.id}`); continue; }
      p.members.sort((a, b) => a.pileT - b.pileT);
      const n = p.members.length, want = Math.min(p.reach + 0.6, 0.52 * n * (p.nx || p.nz ? 1 : 0.75));
      p.h += (want - p.h) * Math.min(1, dt * 1.5);
      // the shape: a wedge of bodies against the wall (a cone under the helicopter), wide at the bottom, narrow at the
      // top. Early arrivals are down in it, later ones climb over them; everyone lies on the slope (heads up-hill),
      // a few sprawled sideways, and the top few are up on their feet, reaching.
      const wall = p.nx || p.nz;
      p.members.forEach((m, i) => {
        const u = (i + 0.5) / n, top = i >= n - 3;
        const y = p.h * (1 - Math.sqrt(1 - u * 0.985)), rem = p.h - y;
        const r1 = hash(m.id), r2 = hash(m.id + 3.3), r3 = hash(m.id + 9.1);
        const slope = Math.atan2(1, wall ? 0.72 : 0.85);         // how steep the pile is
        let x, zz;
        if (wall) {
          const out = 0.4 + rem * 0.72 - r3 * 0.35, lat = (r1 - 0.5) * 2 * (0.5 + rem * 0.55);
          x = p.x + p.nx * out - p.nz * lat; zz = p.z + p.nz * out + p.nx * lat;
          m.yaw = Math.atan2(p.nx, p.nz) + (r2 - 0.5) * 0.9;
        } else {
          const a = r1 * 6.28, rr = 0.3 + rem * 0.85 - r3 * 0.25;
          x = p.x + Math.cos(a) * rr; zz = p.z + Math.sin(a) * rr;
          m.yaw = Math.atan2(Math.cos(a), Math.sin(a)) + (r2 - 0.5) * 0.6;
        }
        // pose: lying face down on the slope (pitched over towards the top), some rolled on their side
        const lie = top ? 0.25 : clamp(slope + 0.35 + (r2 - 0.5) * 0.5, 0.9, 1.5);
        m.tilt += (lie - (m.tilt || 0)) * Math.min(1, dt * 4);
        m.roll = top ? 0 : (r3 > 0.75 ? (r1 > 0.5 ? 1.2 : -1.2) : (r3 - 0.5) * 0.5);
        m.x += (x - m.x) * Math.min(1, dt * 4); m.z += (zz - m.z) * Math.min(1, dt * 4);
        m.y += (p.y + y - m.y) * Math.min(1, dt * 3);
        m.ph += dt * (top ? 6 : 2.5);
      });
      p.top = p.y + p.h;
    }
    void H;
  }

  // g: { heli, heliAlt, roofs (rescue / team roofs), lure: [x, z] or null }
  update(dt, g) {
    const H = g.heli, hp = H.pos;
    this.head.fill(-1);
    const L = this.list;
    if (this.next.length < L.length) this.next = new Int32Array(L.length * 2);
    this.frameN++;
    for (let i = 0; i < L.length; i++) {
      const z = L[i]; if (!z.alive || z.st !== 'walk') continue;
      const c = cellOf(z.x, z.z); if (c < 0) continue;
      this.next[i] = this.head[c & (HB - 1)]; this.head[c & (HB - 1)] = i;
    }
    let grabbers = 0;
    for (const z of L) if (z.alive && z.st === 'grab') grabbers++;
    // the heap under the helicopter, if it's hovering low and slow over open ground
    const gH = this.groundAt(hp[0], hp[2]);
    const lowSlow = !H.dead && !g.noHeap && g.heliAlt > 1.5 && g.heliAlt < 14 && hp[1] - gH < 18 && Math.hypot(H.vel[0], H.vel[2]) < 6;
    const hk = 'heli';
    if (lowSlow) { const p = this.pile(hk, hp[0], gH, hp[2], 0, 0, hp[1] - 2 - gH - 1.6); p.x += (hp[0] - p.x) * Math.min(1, dt * 0.6); p.z += (hp[2] - p.z) * Math.min(1, dt * 0.6); }
    else if (this.piles.has(hk)) { for (const m of this.piles.get(hk).members) { m.st = 'fall'; m.pile = null; m.vel = [(Math.random() - 0.5) * 3, 1, (Math.random() - 0.5) * 3]; } this.piles.delete(hk); }
    this.pileTick(dt, H);
    for (let i = 0; i < L.length; i++) {
      const z = L[i];
      if (!z.alive) continue;
      z.hitT = Math.max(0, z.hitT - dt);
      z.cd -= dt;
      if (z.st === 'mag') continue;
      if (z.stun > 0 && z.st === 'walk') { z.stun -= dt; z.ph += dt * 3; continue; }
      if (z.st === 'walk') {
        // far away and minding its own business: a cheap shuffle, four times less often
        const far = !z.tgt && !(z.angry > 0) && Math.abs(z.x - hp[0]) + Math.abs(z.z - hp[2]) > 190;
        if (far) { if ((i + this.frameN) % 4 === 0) this.shuffle(z, dt * 4, g); }
        else this.walk(z, i, dt, g);
      }
      else if (z.st === 'pile') {
        const p = z.pile;
        if (!p || !this.piles.has(p.key)) { z.st = 'fall'; z.pile = null; z.vel = [0, 0, 0]; continue; }
        // the top of the pile gets over
        if (p.members[p.members.length - 1] === z && p.h >= p.reach - 0.3) {
          if (p.roof && p.roof.active) {
            this.leavePile(z); z.st = 'roof'; z.roof = p.roof; z.y = p.roof.top;
            z.x = clamp(z.x - p.nx * 2, p.roof.box.min[0] + 1, p.roof.box.max[0] - 1); z.z = clamp(z.z - p.nz * 2, p.roof.box.min[2] + 1, p.roof.box.max[2] - 1);
          } else if (p.key === hk && this.tryGrab(z, H, grabbers, true)) { grabbers++; }
        }
      } else if (z.st === 'roof') {
        const r = z.roof;
        let gx = r ? r.x : z.x, gz = r ? r.z : z.z;
        const heliHere = H.landed && r && H.landed === r.box;
        if (heliHere || !r || !r.active || (r.count <= 0 && !r.team)) { gx = hp[0]; gz = hp[2]; }
        const dx = gx - z.x, dz = gz - z.z, d = Math.hypot(dx, dz);
        if (d > 1.2) {
          z.x += (dx / d) * z.spd * 0.8 * dt; z.z += (dz / d) * z.spd * 0.8 * dt; z.yaw = Math.atan2(-dx, -dz); z.ph += dt * z.spd * 2.4;
          if (r) { z.x = clamp(z.x, r.box.min[0] + 0.8, r.box.max[0] - 0.8); z.z = clamp(z.z, r.box.min[2] + 0.8, r.box.max[2] - 0.8); }
        } else if (r && r.active && z.cd <= 0) {
          z.cd = 2.5;
          if (r.team) this.events.push({ type: 'hitTeam', roof: r, z });
          else if (r.count > 0) { r.count--; this.events.push({ type: 'eaten', roof: r }); }
        }
        if (this.tryGrab(z, H, grabbers, false)) grabbers++;
      } else if (z.st === 'grab') {
        const sk = [[-1.25, -1.95, -1.2], [1.25, -1.95, -1.2], [-1.25, -1.95, 1.6], [1.25, -1.95, 1.6], [-1.25, -1.95, 0.2], [1.25, -1.95, 0.2]][z.slot % 6];
        const p = H.toWorld(sk);
        z.x = p[0]; z.y = p[1] - 1.75 * z.s; z.z = p[2]; z.yaw = H.heading + (z.slot % 2 ? -1.57 : 1.57);
        z.ph += dt * 7;
        const shake = Math.hypot(H.w[0], H.w[1], H.w[2]) + Math.max(0, H.vel[1] - 6) * 0.15;
        if (shake > 1.0) z.grip -= dt * (shake - 0.7) * 1.4 * (g.skidGuard ? 2 : 1);
        if (g.skidGuard) z.grip -= dt * 0.25;
        if (z.cd <= 0) { z.cd = 0.5; this.events.push({ type: 'claw', z, dmg: 2.5 }); }
        if (z.grip <= 0 || H.dead) { z.st = 'fall'; z.vel = [H.vel[0] + (Math.random() - 0.5) * 6, H.vel[1] + 2, H.vel[2] + (Math.random() - 0.5) * 6]; z.slot = -1; this.events.push({ type: 'shook' }); }
      } else if (z.st === 'fall') {
        z.vel[1] -= 20 * dt;
        z.x += z.vel[0] * dt; z.y += z.vel[1] * dt; z.z += z.vel[2] * dt;
        z.ph += dt * 14;
        if (z.vel[1] < 0) {
          const hit = this.world.raycast([z.x, z.y + 1, z.z], [0, -1, 0], 1.0 - z.vel[1] * dt + 0.05);
          if (hit) {
            z.y = hit.point[1];
            if (z.vel[1] < -15) { this.kill(z, [z.vel[0] * 0.3, 4, z.vel[2] * 0.3], 'fall'); continue; }
            const r = g.roofs.find((rr) => rr.box === hit.box);
            z.st = r ? 'roof' : hit.point[1] > this.groundAt(z.x, z.z) + 2 ? 'roof' : 'walk'; z.roof = r || null;
          }
        }
        if (z.y < WATER - 30) z.alive = false;
      }
    }
    for (const z of L) if (z.alive && !z.keep && z.st !== 'grab' && Math.abs(z.x - hp[0]) + Math.abs(z.z - hp[2]) > 760) z.alive = false;
    let w = 0;
    for (let i = 0; i < L.length; i++) if (L[i].alive) L[w++] = L[i]; else if (L[i].pile) this.leavePile(L[i]);
    L.length = w;
  }

  walk(z, idx, dt, g) {
    const H = g.heli, hp = H.pos;
    z.think -= dt;
    const dxh = hp[0] - z.x, dzh = hp[2] - z.z, dh = Math.hypot(dxh, dzh);
    // screamers spot you and shriek
    if (z.type === 'screamer' && !z.screamed && !H.dead && dh < 75 && hp[1] - z.y < 60) {
      z.screamed = true; z.cd = 2;
      this.events.push({ type: 'scream', z });
      for (const o of this.list) if (o.alive && o.st === 'walk' && Math.hypot(o.x - z.x, o.z - z.z) < 180) { o.tgt = null; o.angry = 12; }
    }
    if (z.angry > 0) z.angry -= dt;
    const low = !H.dead && g.heliAlt < 22 && dh < 70;
    let dirx = 0, dirz = 0;
    const tg = z.tgt;
    const lured = g.lure && (!g.lureR || Math.abs(g.lure[0] - z.x) + Math.abs(g.lure[1] - z.z) < g.lureR * 1.4);
    if (lured && !tg) {
      const dx = g.lure[0] - z.x, dz = g.lure[1] - z.z, d = Math.hypot(dx, dz) || 1;
      if (d > 4) { dirx = dx / d; dirz = dz / d; }
    } else if ((low || z.angry > 0) && !(tg && tg.sticky)) {
      // go for the helicopter: get under it and start a heap
      if (dh > 2.5) { dirx = dxh / dh; dirz = dzh / dh; }
      const p = this.piles.get('heli');
      if (p && dh < 4.5) { this.joinPile(z, p); return; }
    } else if (tg && tg.kind === 'chase') {
      if (!tg.alive) { z.tgt = null; return; }
      const gx = tg.x - z.x, gz = tg.z - z.z, gd = Math.hypot(gx, gz) || 1;
      // a target up on a roof: pile up the wall under it
      if (tg.roof) { z.tgt = tg.roof; return; }
      if (gd < 1.6 + (tg.r || 0)) { if (z.cd <= 0) { z.cd = 1.2; this.events.push({ type: 'hitTarget', tgt: tg, z, dmg: 6 }); } }
      else if (gd > 30 && tg.field) this.followField(z, this.pointField(tg.field, tg.x, tg.z), (x, y) => { dirx = x; dirz = y; }, tg.x, tg.z);
      else { dirx = gx / gd; dirz = gz / gd; }
    } else if (tg && tg.kind === 'roof') {
      if (!tg.active || (tg.count <= 0 && !tg.team)) { z.tgt = null; return; }
      const pk = `roof${tg.box.id}`, pl = this.piles.get(pk);
      if (pl) {
        // there's already a pile: everyone heads for the bottom of it and climbs on
        const fx = pl.x + pl.nx * (pl.h * 0.9 + 0.8), fz = pl.z + pl.nz * (pl.h * 0.9 + 0.8), fd = Math.hypot(fx - z.x, fz - z.z);
        if (fd < 2.6 + pl.h * 0.25) { this.joinPile(z, pl); return; }
        if (fd < 14) { dirx = (fx - z.x) / fd; dirz = (fz - z.z) / fd; }
        else this.followField(z, this.pointField(`foot${tg.box.id}`, pl.x + pl.nx * 3, pl.z + pl.nz * 3, 5), (x, y) => { dirx = x; dirz = y; }, fx, fz);
      }
      const f = pl ? null : this.roofField(tg), c = cellOf(z.x, z.z);
      if (pl) { /* steering set above */ } else if (c >= 0 && fv(f, c) === 0) {
        // at the wall: join (or start) the pile against it
        const b = tg.box, cx = clamp(z.x, b.min[0], b.max[0]), cz = clamp(z.z, b.min[2], b.max[2]);
        let nx = z.x - cx, nz = z.z - cz; const nd = Math.hypot(nx, nz);
        if (nd < 3) {
          nx = nd > 1e-3 ? nx / nd : 0; nz = nd > 1e-3 ? nz / nd : 1;
          const key = `roof${b.id}`;
          let p = this.piles.get(key);
          if (!p) { p = this.pile(key, cx + nx * 0.4, this.groundAt(cx + nx, cz + nz), cz + nz * 0.4, nx, nz, tg.top - this.groundAt(cx + nx, cz + nz)); p.roof = tg; }
          this.joinPile(z, p);
          return;
        }
        const d = Math.hypot(cx - z.x, cz - z.z) || 1; dirx = (cx - z.x) / d; dirz = (cz - z.z) / d;
      } else this.followField(z, f, (x, y) => { dirx = x; dirz = y; }, tg.x, tg.z);
    } else if (dh < 160) { dirx = dxh / dh * 0.5; dirz = dzh / dh * 0.5; }      // drift towards the noise
    else if (z.think <= 0) { z.think = 3 + Math.random() * 4; z.wx = (Math.random() - 0.5) * 2; z.wz = (Math.random() - 0.5) * 2; }
    else { dirx = (z.wx || 0) * 0.3; dirz = (z.wz || 0) * 0.3; }
    // keep apart
    let px = 0, pz = 0;
    const c = cellOf(z.x, z.z);
    if (c >= 0) {
      const i = c % NX, k = (c - i) / NX;
      for (let kk = k - 1; kk <= k + 1; kk++) for (let ii = i - 1; ii <= i + 1; ii++) {
        if (ii < 0 || kk < 0 || ii >= NX || kk >= NZ) continue;
        for (let j = this.head[(kk * NX + ii) & (HB - 1)]; j >= 0; j = this.next[j]) {
          if (j === idx) continue;
          const o = this.list[j], ox = z.x - o.x, oz = z.z - o.z, d2 = ox * ox + oz * oz, rr = 0.42 * (z.s + o.s);
          if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k2 = (rr - d) / d; px += ox * k2; pz += oz * k2; }
        }
      }
    }
    const sp = z.spd * (z.angry > 0 && z.type !== 'crawler' ? 1.6 : 1) * (low ? 1.15 : 1);
    z.dx += (dirx - z.dx) * Math.min(1, dt * 5); z.dz += (dirz - z.dz) * Math.min(1, dt * 5);
    const mx = z.dx * sp * dt + px * Math.min(1, dt * 8), mz = z.dz * sp * dt + pz * Math.min(1, dt * 8);
    if (!this.stuck(z.x + mx * 3, z.z)) z.x += mx;
    if (!this.stuck(z.x, z.z + mz * 3)) z.z += mz;
    if (Math.abs(mx) + Math.abs(mz) > 1e-4) z.yaw = Math.atan2(-z.dx, -z.dz);
    z.ph += dt * sp * 2.4 / z.s;
    z.y = this.groundAt(z.x, z.z);
    this.tryGrab(z, H, -1, false);
  }
  // quick: open squares are always fine; in a square next to a wall (or water), check exactly
  stuck(x, z) { const c = cellOf(x, z); if (c < 0) return true; if (!this.isBlocked(c)) return false; const gy = this.T.heightAt(x, z); return gy < WATER + 0.3 || World_pointInside(this.world, [x, gy + 2, z]); }
  // the far-off ones: wander, drift towards noise, never through walls
  shuffle(z, dt, g) {
    const hp = g.heli.pos, dx = hp[0] - z.x, dz = hp[2] - z.z, d = Math.hypot(dx, dz);
    z.think -= dt;
    if (g.lure && (!g.lureR || Math.abs(g.lure[0] - z.x) + Math.abs(g.lure[1] - z.z) < g.lureR * 1.4)) { const lx = g.lure[0] - z.x, lz = g.lure[1] - z.z, ld = Math.hypot(lx, lz) || 1; z.wx = lx / ld; z.wz = lz / ld; }
    else if (z.think <= 0) {
      z.think = 3 + Math.random() * 5;
      // most of them drift slowly towards the noise of the helicopter
      if (d < 420 && Math.random() < 0.6) { z.wx = dx / d; z.wz = dz / d; } else { const a = Math.random() * 6.28; z.wx = Math.cos(a) * 0.5; z.wz = Math.sin(a) * 0.5; }
    }
    const sp = z.spd * 0.8, mx = (z.wx || 0) * sp * dt, mz = (z.wz || 0) * sp * dt;
    if (!this.stuck(z.x + mx * 2, z.z)) z.x += mx; else z.wx = -(z.wx || 0);
    if (!this.stuck(z.x, z.z + mz * 2)) z.z += mz; else z.wz = -(z.wz || 0);
    if (Math.abs(mx) + Math.abs(mz) > 1e-4) z.yaw = Math.atan2(-(z.wx || 0), -(z.wz || 0));
    z.ph += dt * sp * 2.4 / z.s;
    z.y = this.groundAt(z.x, z.z);
  }
  // keep the streets full: as many zombies round you as the place deserves (dens(x, z) = zombies per square metre)
  populate(dt, hp, dens, cap, mix) {
    this.popT -= dt;
    if (this.popT > 0) return;
    this.popT = 0.25;
    // how busy is it round here? (sampled in a ring)
    let tot = 0;
    for (let k = 0; k < 12; k++) { const a = k * 0.5236, r = 120 + (k % 3) * 140; tot += dens(hp[0] + Math.cos(a) * r, hp[2] + Math.sin(a) * r); }
    const want = Math.min(cap, (tot / 12) * Math.PI * 450 * 450);
    let n = 0; for (const z of this.list) if (z.alive && !z.ev && !z.keep) n++;
    let budget = Math.min(160, Math.ceil((want - n) / 3));
    for (let tries = 0; budget > 0 && tries < budget * 4; tries++) {
      const a = Math.random() * 6.28, r = (Math.random() < 0.2 ? 90 : 200) + Math.sqrt(Math.random()) * 270, x = hp[0] + Math.cos(a) * r, z = hp[2] + Math.sin(a) * r;
      if (Math.abs(x) > WORLD - 10 || Math.abs(z) > WORLD - 10) continue;
      if (Math.random() * (dens(x, z) + 1e-6) < 0.00025 && Math.random() < 0.7) continue;      // spawn where it's busy
      if (this.blockedAt(x, z)) continue;
      this.spawn(mix(), x, z);
      budget--;
    }
  }
  followField(z, f, set, fx, fz) {
    const c = cellOf(z.x, z.z);
    if (c < 0 || fv(f, c) >= 65535) { if (fx != null) { const dx = fx - z.x, dz = fz - z.z, d = Math.hypot(dx, dz) || 1; set(dx / d, dz / d); } return; }
    const i = c % NX, k = (c - i) / NX;
    let best = fv(f, c), bi = -1;
    for (let n = 0; n < 8; n++) {
      const ii = i + N8[n][0], kk = k + N8[n][1];
      if (ii < 0 || kk < 0 || ii >= NX || kk >= NZ) continue;
      const cc = kk * NX + ii, v = fv(f, cc) + (n >= 4 ? 0.4 : 0);
      if (n >= 4 && (this.isBlocked(k * NX + ii) || this.isBlocked(kk * NX + i))) continue;
      if (v < best) { best = v; bi = cc; }
    }
    if (bi >= 0) {
      const tx = GX0 + ((bi % NX) + 0.5) * CELL + z.side * 1.1, tz = GZ0 + (Math.floor(bi / NX) + 0.5) * CELL + z.side * 1.1;
      const ddx = tx - z.x, ddz = tz - z.z, dd = Math.hypot(ddx, ddz) || 1;
      set(ddx / dd, ddz / dd);
    }
  }

  // jump for the skids (or reach them from the top of the heap)
  tryGrab(z, H, n, fromPile) {
    if (H.dead || z.type === 'crawler') return false;
    const skidY = H.pos[1] - 1.9, dx = H.pos[0] - z.x, dz = H.pos[2] - z.z;
    const reach = fromPile ? 3.2 : 2.4;
    if (dx * dx + dz * dz > (fromPile ? 30 : 14) || skidY - (z.y + 1.7 * z.s) > reach || skidY - z.y < -0.5) return false;
    if (n < 0) { n = 0; for (const o of this.list) if (o.alive && o.st === 'grab') n++; }
    if (n >= 6 || (!fromPile && Math.random() > 0.08)) return false;
    const used = new Set(this.list.filter((o) => o.alive && o.st === 'grab').map((o) => o.slot));
    let s = 0; while (used.has(s)) s++;
    this.leavePile(z);
    z.st = 'grab'; z.slot = s; z.grip = 0.6 + Math.random() * 0.6; z.cd = 0.5;
    this.events.push({ type: 'grab', z });
    return true;
  }

  hitRay(o, d, maxT) {
    let best = null, bt = maxT;
    for (const z of this.list) {
      if (!z.alive) continue;
      const crawl = z.type === 'crawler' && z.st === 'walk';
      const r = 0.55 * z.s, cy = z.y + (crawl ? 0.35 : 1.0) * z.s;
      const ox = z.x - o[0], oy = cy - o[1], oz = z.z - o[2];
      const tc = ox * d[0] + oy * d[1] + oz * d[2];
      if (tc < 0 || tc - r > bt) continue;
      const px = ox - d[0] * tc, py = (oy - d[1] * tc) / (crawl ? 0.8 : 1.8), pz = oz - d[2] * tc;
      const dd = px * px + py * py + pz * pz;
      if (dd > r * r * (crawl ? 2.2 : 1)) continue;
      const t = tc - Math.sqrt(Math.max(0, r * r - dd));
      if (t < bt) { bt = t; best = { z, t }; }
    }
    return best;
  }

  damage(z, dmg, push, cause) {
    if (!z.alive) return false;
    if (z.type === 'riot' && SMALL_ARMS.has(cause)) dmg *= 0.4;
    z.hp -= dmg; z.hitT = 0.1;
    if (z.hp <= 0) { this.kill(z, push, cause); return true; }
    return false;
  }

  kill(z, push = [0, 2, 0], cause = '') {
    if (!z.alive) return;
    z.alive = false;
    if (z.st === 'grab') this.events.push({ type: 'shook' });
    this.leavePile(z);
    const parts = this.parts(z, [], 1);
    for (const p of parts) {
      const v = [push[0] + (Math.random() - 0.5) * 5, push[1] + Math.random() * 4, push[2] + (Math.random() - 0.5) * 5];
      this.fx.spawnPiece(p.pos, p.size, v, p.col, 2 + Math.random() * 1.2);
    }
    for (let i = 0; i < 5; i++) {
      const s = 0.12 * z.s * (0.5 + Math.random());
      this.fx.spawnPiece([z.x, z.y + z.s, z.z], [s, s, s], [push[0] * 0.5 + (Math.random() - 0.5) * 6, 2 + Math.random() * 4, push[2] * 0.5 + (Math.random() - 0.5) * 6], [0.32, 0.06, 0.05], 1.2);
    }
    this.events.push({ type: 'kill', z, cause });
  }

  blast(pos, r, dmg, force, cause = 'blast') {
    let n = 0;
    for (const z of this.list) {
      if (!z.alive) continue;
      const dx = z.x - pos[0], dy = z.y + z.s - pos[1], dz = z.z - pos[2], d = Math.hypot(dx, dy, dz);
      if (d > r + z.s * 0.5) continue;
      const k = 1 - clamp(d / (r + 0.01), 0, 0.85), dl = d || 1;
      const push = [(dx / dl) * force * k, force * 0.7 * k + 3, (dz / dl) * force * k];
      if (this.damage(z, dmg * k, push, cause)) n++;
      else if (z.st !== 'grab' && z.type !== 'brute') { this.leavePile(z); z.st = 'fall'; z.vel = push; }
    }
    return n;
  }

  // the shapes a zombie is made of: [{ pos, rot, size, col, em, mesh }]
  parts(z, out, lod = 1) {
    const s = z.s, c = Math.cos(z.yaw), sn = Math.sin(z.yaw);
    const flash = z.hitT > 0;
    const tint = (col) => flash ? [Math.min(1, col[0] + 0.5), Math.min(1, col[1] + 0.4), Math.min(1, col[2] + 0.4)] : col;
    const crawl = z.type === 'crawler' && (z.st === 'walk' || z.st === 'roof');
    // a lying / climbing body: tip the whole thing over around the hips (tilt forward, roll sideways), then sink it so it
    // rests on what's under it
    const tl0 = z.st === 'pile' || z.st === 'fall' ? z.tilt || 0 : 0, rl0 = z.st === 'pile' ? z.roll || 0 : 0;
    const ct = Math.cos(tl0), stl = Math.sin(tl0), cr = Math.cos(rl0), sr = Math.sin(rl0), sink = 0.8 * Math.abs(stl) * 0.85;
    const P = (lx, ly, lz, rx, sx, sy, sz, col, em = 0, mesh = 'box') => {
      if (tl0 || rl0) {
        let y = ly - 0.9, x = lx;
        const x2 = x * cr - y * sr, y2 = x * sr + y * cr; x = x2; y = y2;
        const y3 = y * ct + lz * stl, z3 = -y * stl + lz * ct;
        lx = x; ly = y3 + 0.9 - sink; lz = z3;
        out.push({ pos: [z.x + (lx * c + lz * sn) * s, z.y + ly * s, z.z + (-lx * sn + lz * c) * s], rot: [rx - tl0, z.yaw, rl0], size: [sx * s, sy * s, sz * s], col: tint(col), em, mesh });
        return;
      }
      out.push({ pos: [z.x + (lx * c + lz * sn) * s, z.y + ly * s, z.z + (-lx * sn + lz * c) * s], rot: [rx, z.yaw, 0], size: [sx * s, sy * s, sz * s], col: tint(col), em, mesh });
    };
    const st = z.st, ph = z.ph, run = z.type === 'runner' || z.angry > 0;
    if (lod === 0) {
      if (crawl) { P(0, 0.25, 0, -1.4, 0.5, 1.1, 0.3, z.shirt); return out; }
      P(0, 0.42, 0, 0, 0.42, 0.84, 0.24, z.pants);
      P(0, 1.3, 0, 0, 0.5, 0.95, 0.3, z.shirt);
      return out;
    }
    if (crawl) {
      // dragging itself along on its arms
      const sw = Math.sin(ph * 1.2);
      P(0, 0.28, 0.25, -1.45, 0.48, 0.7, 0.28, z.shirt);
      P(0, 0.3, -0.25, -1.3, 0.3, 0.33, 0.3, z.skin, 0, 'sphere');
      for (const sd of [-1, 1]) P(sd * 0.28, 0.18, -0.45 - sd * sw * 0.25, -0.2, 0.14, 0.14, 0.62, z.skin, 0, 'cyl');
      P(0, 0.15, 0.85, -1.5, 0.4, 0.5, 0.22, z.pants);
      return out;
    }
    let lean = (run ? -0.45 : -0.18) - z.hunch, armA = -0.1 + Math.sin(ph * 0.5) * 0.12, legA = Math.sin(ph) * (run ? 0.9 : 0.55);
    if (st === 'pile') { lean = (z.tilt || 0) < 0.5 ? 0.25 + Math.sin(ph) * 0.15 : Math.sin(ph) * 0.08; armA = (z.tilt || 0) < 0.5 ? 2.4 + Math.sin(ph * 1.3) * 0.4 : 1.2 + Math.sin(ph * 1.3 + z.id) * 0.6; legA = Math.sin(ph + z.id) * 0.5; }
    else if (st === 'grab') { lean = 0; armA = 1.5; legA = Math.sin(ph) * 0.5; }
    else if (st === 'fall' || st === 'mag') { lean = Math.sin(ph) * 0.4; armA = 1 + Math.sin(ph * 1.3) * 1.2; legA = Math.sin(ph) * 1; }
    else if (z.type === 'screamer' && z.screamed && z.cd > 0.5) { lean = 0.4; armA = 0.8; }
    for (const sd of [-1, 1]) {
      const a = legA * sd;
      P(sd * 0.13, 0.85 - 0.425 * Math.cos(a), -0.425 * Math.sin(a), a, 0.22, 0.88, 0.22, z.pants, 0, 'cylY');
      P(sd * 0.13, 0.85 - 0.85 * Math.cos(a) + 0.05, -0.85 * Math.sin(a) - 0.06, 0, 0.22, 0.1, 0.34, [0.12, 0.1, 0.09]);
    }
    const fat = z.type === 'brute' ? 1.4 : z.type === 'bloater' ? 1.2 : 1;
    const tw = (run ? 0.44 : 0.48) * fat, td = 0.28 * fat, tl = Math.sin(lean);
    P(0, 1.18, -0.33 * tl, lean, tw, 0.66, td, z.shirt);
    P(0, 1.48, -0.5 * tl, lean, tw * 1.05, 0.16, td * 1.1, z.shirt.map((v) => v * 0.8));
    P(0, 0.88, -0.2 * tl, lean, tw * 0.92, 0.12, td * 0.95, z.pants.map((v) => v * 0.8));
    if (z.torn) P(0.08, 1.12, -0.33 * tl - 0.15 * fat, lean, 0.2, 0.25, 0.02, [0.35, 0.08, 0.06]);
    if (z.type === 'bloater') {
      // the swollen belly, with glowing boils
      P(0, 1.1, -0.33 * tl - 0.14, lean, 0.74, 0.78, 0.7, z.skin, 0, 'sphere');
      P(0.18, 1.2, -0.33 * tl - 0.47, lean, 0.12, 0.12, 0.08, [0.85, 0.9, 0.3], 0.5, 'sphere');
      P(-0.2, 0.98, -0.33 * tl - 0.45, lean, 0.1, 0.1, 0.07, [0.85, 0.9, 0.3], 0.5, 'sphere');
    }
    if (z.type === 'riot') {
      // vest, helmet with a visor
      P(0, 1.22, -0.33 * tl, lean, tw * 1.12, 0.52, td * 1.3, [0.05, 0.05, 0.06]);
      P(0, 1.3, -0.33 * tl - td * 0.66, lean, tw * 0.7, 0.07, 0.02, [0.9, 0.9, 0.85]);
      P(0, 1.73, -0.62 * tl - 0.05, lean * 0.6 + 0.2, 0.38, 0.32, 0.38, [0.07, 0.09, 0.15], 0, 'sphere');
      P(0, 1.67, -0.62 * tl - 0.22, lean * 0.6 + 0.2, 0.3, 0.16, 0.03, [0.25, 0.3, 0.35]);
    }
    P(0, 1.67, -0.62 * tl - 0.05, lean * 0.6 + 0.2, 0.3, 0.34, 0.3, z.skin, 0, 'sphere');
    P(0, 1.6, -0.62 * tl - 0.2, lean * 0.6 + 0.2, z.type === 'screamer' && z.screamed ? 0.2 : 0.16, z.type === 'screamer' && z.screamed ? 0.14 : 0.06, 0.06, [0.2, 0.05, 0.04]);
    for (const dx of [-0.065, 0.065]) P(dx, 1.7, -0.62 * tl - 0.19, lean * 0.6, 0.06, 0.05, 0.04, [0.85, 0.82, 0.55], 0.25);
    for (const sd of [-1, 1]) {
      const a = armA + (st === 'walk' ? Math.sin(ph + sd) * 0.15 : Math.sin(ph * 2 + sd) * 0.2) * sd;
      const sx = sd * (tw / 2 + 0.07), sy = 1.42 - 0.1 * (1 - Math.cos(lean)), sz = -0.45 * tl;
      P(sx, sy + Math.sin(a) * 0.31, sz - Math.cos(a) * 0.31, a, 0.15, 0.15, 0.66, z.skin, 0, 'cyl');
      P(sx, sy + Math.sin(a) * 0.66, sz - Math.cos(a) * 0.66, a, 0.16, 0.16, 0.16, z.skin.map((v) => v * 0.85), 0, 'sphere');
      P(sx, sy + Math.sin(a) * 0.12, sz - Math.cos(a) * 0.12, a, tw * 0.36, 0.2, 0.22, z.shirt);
    }
    return out;
  }

  fill(r, batches, cam, fwd, kf) {
    const MAX = { box: 30000, sphere: 5000, cyl: 6000, cylY: 6000 };
    if (!this.datas) this.datas = { box: new Float32Array(INST_FLOATS * MAX.box), sphere: new Float32Array(INST_FLOATS * MAX.sphere), cyl: new Float32Array(INST_FLOATS * MAX.cyl), cylY: new Float32Array(INST_FLOATS * MAX.cylY) };
    const m = this.m, tmp = [], N = { box: 0, sphere: 0, cyl: 0, cylY: 0 };
    const put = (p) => {
      const mesh = p.mesh || 'box', D = this.datas[mesh], n = N[mesh];
      if (n >= MAX[mesh]) return;
      compose(m, p.pos, p.rot, p.size);
      const o = n * INST_FLOATS;
      for (let k = 0; k < 16; k++) D[o + k] = m[k];
      D[o + 16] = p.size[0]; D[o + 17] = p.size[1]; D[o + 18] = p.size[2]; D[o + 19] = mesh === 'box' ? 1 : 0;
      D[o + 20] = p.col[0]; D[o + 21] = p.col[1]; D[o + 22] = p.col[2]; D[o + 23] = 1;
      D[o + 24] = 0; D[o + 25] = 0; D[o + 26] = p.em || 0; D[o + 27] = 0;
      D[o + 28] = 0; D[o + 29] = 0.8; D[o + 30] = 0; D[o + 31] = 0;
      N[mesh] = n + 1;
    };
    for (const z of this.list) {
      if (!z.alive) continue;
      const dx = z.x - cam[0], dy = z.y + z.s - cam[1], dz = z.z - cam[2], d2 = dx * dx + dy * dy + dz * dz;
      const al = dx * fwd[0] + dy * fwd[1] + dz * fwd[2], rr = 2 * z.s;
      if (al < -rr) continue;
      if (Math.sqrt(Math.max(0, d2 - al * al)) > al * kf + rr) continue;
      if (d2 > 600 * 600) continue;
      if (d2 > 170 * 170) {
        // in the distance: one box
        const crawl = z.type === 'crawler' && z.st === 'walk';
        put({ pos: [z.x, z.y + (crawl ? 0.25 : 0.85) * z.s, z.z], rot: [0, z.yaw, 0], size: crawl ? [0.5, 0.5, 1.2] : [0.5 * z.s, 1.75 * z.s, 0.32 * z.s], col: z.shirt, mesh: 'box' });
        continue;
      }
      tmp.length = 0;
      this.parts(z, tmp, d2 > 55 * 55 ? 0 : 1);
      for (const p of tmp) put(p);
    }
    // the piles: bodies that didn't make it (and the ones underneath) fill out the heap between the climbers
    for (const p of this.piles.values()) {
      if (p.h < 0.6 || !p.members.length) continue;
      const dx = p.x - cam[0], dz = p.z - cam[2];
      if (dx * dx + dz * dz > 260 * 260) continue;
      const wall = p.nx || p.nz, nF = Math.min(170, Math.round(p.members.length * 2 + p.h * 6));
      for (let k = 0; k < nF; k++) {
        const r1 = hash(k * 7.1 + p.x), r2 = hash(k * 3.7 + p.z), r3 = hash(k * 1.3 + 5), u = (k + 0.5) / nF;
        const y = p.h * (1 - Math.sqrt(1 - u * 0.97)) * 0.96, rem = p.h - y;
        let x, z, yaw;
        if (wall) { const out = 0.35 + rem * 0.72 - r3 * 0.4, lat = (r1 - 0.5) * 2 * (0.45 + rem * 0.57); x = p.x + p.nx * out - p.nz * lat; z = p.z + p.nz * out + p.nx * lat; yaw = Math.atan2(p.nx, p.nz) + (r2 - 0.5) * 2.4; }
        else { const a = r1 * 6.28, rr = 0.25 + rem * 0.85 - r3 * 0.3; x = p.x + Math.cos(a) * rr; z = p.z + Math.sin(a) * rr; yaw = a + (r2 - 0.5) * 2; }
        const by = p.y + y + 0.15, sh = SHIRT[Math.floor(r2 * SHIRT.length)], sk = SKINS[Math.floor(r3 * SKINS.length)], pa = PANTS[Math.floor(r1 * PANTS.length)];
        const fx = Math.sin(yaw), fz = Math.cos(yaw), pitch = 1.2 + (r3 - 0.5) * 0.6, rl = (r1 - 0.5) * 1.6;
        put({ pos: [x, by, z], rot: [pitch, yaw, rl], size: [0.5, 0.75, 0.3], col: sh, mesh: 'box' });
        put({ pos: [x - fx * 0.55, by - 0.05, z - fz * 0.55], rot: [pitch, yaw, rl], size: [0.4, 0.8, 0.26], col: pa, mesh: 'box' });
        put({ pos: [x + fx * 0.48, by + 0.05, z + fz * 0.48], rot: [0, yaw, 0], size: [0.28, 0.3, 0.28], col: sk, mesh: 'sphere' });
        if (r2 > 0.4) put({ pos: [x + fx * 0.3 + fz * 0.3, by + 0.12, z + fz * 0.3 - fx * 0.3], rot: [1.2, yaw + 0.6, 0], size: [0.14, 0.14, 0.6], col: sk, mesh: 'cyl' });
      }
    }
    // (a friend's view: the far-off crowd the host told us about)
    if (this.farCrowd) for (let i = 0; i < this.farCrowd.length; i += 3) {
      const x = this.farCrowd[i], z = this.farCrowd[i + 1], y = this.groundAt(x, z), sh = SHIRT[this.farCrowd[i + 2] % SHIRT.length];
      put({ pos: [x, y + 0.85, z], rot: [0, (i * 0.37) % 6.28, 0], size: [0.5, 1.75, 0.32], col: sh, mesh: 'box' });
    }
    let total = 0;
    for (const k of Object.keys(N)) { r.fillBatch(batches[k], this.datas[k], N[k], N[k]); total += N[k]; }
    return total;
  }
}
// the boxes only (not the ground) — "is there a building here?"
function World_pointInside(world, p) { return Object.getPrototypeOf(Object.getPrototypeOf(world)).pointInside.call(world, p); }
