// DEAD AIR: the open world, made from a seed: 6.4 km of procedural land (terrain.js) with forests (trees.js), and on it
//   THE CITY      in the flattest valley near the middle: narrow streets between tall blocks (close quarters), and the
//                 one base, THE SPIRE: a huge tower with a landing bay jutting out of its side, high above the streets
//   2 SMALL CITIES further out, lower and looser
//   TOWNS         a crossroads with shops, houses, a gas station and a church
//   VILLAGES      a few houses and a shop along the road
//   FARMS, GAS STATIONS on the roads, wrecks, and roads winding between all of it (round the hills, over the rivers)
// Some buildings are worth raiding (shops, police, pharmacies...): send your team in from the roof or the street.
import { makeBox } from '../world.js';
import { compose } from '../math.js';
import { Terrain, GeoWorld, rng, smooth, WATER, HALF as TH } from './terrain.js';

export const WORLD = TH - 60;               // how far you can fly
export const HANGAR = [5600, 0, 0];         // the upgrade hangar scene, off the map
export const HALF = 0;                      // (unused now; kept for old imports)

const FACADES = [
  { tex: 13, col: [0.55, 0.32, 0.24] }, { tex: 13, col: [0.45, 0.28, 0.22] }, { tex: 6, col: [0.62, 0.6, 0.56] },
  { tex: 6, col: [0.45, 0.47, 0.5] }, { tex: 3, col: [0.55, 0.54, 0.5] }, { tex: 2, col: [0.4, 0.55, 0.62] }, { tex: 6, col: [0.7, 0.66, 0.58] },
];
const HOUSES = [[0.85, 0.8, 0.7], [0.7, 0.75, 0.82], [0.88, 0.78, 0.6], [0.75, 0.82, 0.72], [0.9, 0.88, 0.85], [0.8, 0.62, 0.55]];
const ROOFS = [[0.35, 0.18, 0.14], [0.22, 0.22, 0.25], [0.4, 0.3, 0.22]];
const CARS = [[0.6, 0.1, 0.08], [0.15, 0.25, 0.5], [0.75, 0.75, 0.72], [0.12, 0.12, 0.13], [0.5, 0.48, 0.3], [0.2, 0.4, 0.3], [0.85, 0.7, 0.15]];
const LEAFC = [[0.2, 0.32, 0.11], [0.26, 0.36, 0.13], [0.36, 0.38, 0.13], [0.5, 0.36, 0.12]];
const NEON = [[1, 0.2, 0.6], [0.2, 0.9, 1], [1, 0.85, 0.2], [0.4, 1, 0.4], [0.7, 0.35, 1], [1, 0.45, 0.15]];

// what you can find in a building, by type: [name, sign colour, loot weights]
export const LOOT_TYPES = {
  pharmacy: { n: 'PHARMACY', col: [0.2, 1, 0.4], loot: { medkit: 5, scrap: 2, survivor: 1 } },
  police: { n: 'POLICE STATION', col: [0.3, 0.5, 1], loot: { weapon: 4, armor: 3, ammo: 4, scrap: 2 } },
  gas: { n: 'GAS STATION', col: [1, 0.55, 0.1], loot: { fuel: 6, scrap: 2 } },
  hardware: { n: 'HARDWARE STORE', col: [1, 0.85, 0.2], loot: { scrap: 6, armor: 1 } },
  market: { n: 'SUPERMARKET', col: [1, 0.3, 0.3], loot: { scrap: 4, medkit: 1, survivor: 2 } },
  flats: { n: 'APARTMENTS', col: [0.8, 0.8, 0.8], loot: { survivor: 4, scrap: 3, medkit: 1 } },
  hospital: { n: 'HOSPITAL', col: [1, 1, 1], loot: { medkit: 6, survivor: 3, scrap: 2 } },
  gunshop: { n: 'GUN SHOP', col: [0.9, 0.2, 0.2], loot: { weapon: 5, ammo: 5 } },
};

// the ground map: what's where on the land, as a texture for the terrain shader (and for placing trees).
//   r = distance to the nearest road (0..16 m), g = town ground, b = how wooded, a = water depth (0..32 m)
export class Ground {
  constructor(T, size = 2048) {
    this.T = T; this.size = size; this.span = TH * 2; this.x0 = -TH; this.z0 = -TH;
    this.data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) this.data[i * 4] = 255;
  }
  tx(x) { return (x - this.x0) / this.span * this.size; }
  // stamp a road segment's distance field
  road(ax, az, bx, bz) {
    const S = this.size, D = this.data, k = this.span / S, m = 17;
    const i0 = Math.max(0, Math.floor(this.tx(Math.min(ax, bx) - m))), i1 = Math.min(S - 1, Math.ceil(this.tx(Math.max(ax, bx) + m)));
    const j0 = Math.max(0, Math.floor(this.tx(Math.min(az, bz) - m))), j1 = Math.min(S - 1, Math.ceil(this.tx(Math.max(az, bz) + m)));
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = this.x0 + (i + 0.5) * k, pz = this.z0 + (j + 0.5) * k;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
      const d = Math.hypot(px - ax - dx * t, pz - az - dz * t), v = Math.min(255, Math.round(d / 16 * 255)), o = (j * S + i) * 4;
      if (v < D[o]) D[o] = v;
    }
  }
  // town ground: a rounded square (r) fading out over `fade` metres
  town(x, z, r, fade = 20) {
    const S = this.size, D = this.data, k = this.span / S, m = r + fade;
    const i0 = Math.max(0, Math.floor(this.tx(x - m))), i1 = Math.min(S - 1, Math.ceil(this.tx(x + m)));
    const j0 = Math.max(0, Math.floor(this.tx(z - m))), j1 = Math.min(S - 1, Math.ceil(this.tx(z + m)));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = this.x0 + (i + 0.5) * k, pz = this.z0 + (j + 0.5) * k;
      const d = Math.max(Math.abs(px - x), Math.abs(pz - z)) * 0.7 + Math.hypot(px - x, pz - z) * 0.3;
      const v = Math.round((1 - smooth(r, r + fade, d)) * 255), o = (j * S + i) * 4 + 1;
      if (v > D[o]) D[o] = v;
    }
  }
  // the woods and the water: worked out on a coarse grid and blended up
  nature() {
    const S = this.size, D = this.data, C = 512, step = this.span / C, T = this.T;
    const f = new Float32Array((C + 1) * (C + 1)), w = new Float32Array((C + 1) * (C + 1));
    this.heights = new Float32Array((C + 1) * (C + 1)); this.hC = C;
    for (let j = 0; j <= C; j++) for (let i = 0; i <= C; i++) {
      const x = this.x0 + i * step, z = this.z0 + j * step, h = T.natural(x, z);
      f[j * (C + 1) + i] = T.forest(x, z); w[j * (C + 1) + i] = Math.max(0, WATER - h); this.heights[j * (C + 1) + i] = h;
    }
    const r = C / S;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const u = (i + 0.5) * r, v = (j + 0.5) * r, a = Math.min(C - 1, Math.floor(u)), b = Math.min(C - 1, Math.floor(v)), fu = u - a, fv = v - b;
      const q = (A) => { const o = b * (C + 1) + a; return (A[o] * (1 - fu) + A[o + 1] * fu) * (1 - fv) + (A[o + C + 1] * (1 - fu) + A[o + C + 2] * fu) * fv; };
      const o = (j * S + i) * 4;
      D[o + 2] = Math.round(q(f) * 255 * (1 - D[o + 1] / 255));
      D[o + 3] = Math.min(255, Math.round(q(w) / 32 * 255));
    }
  }
  at(x, z) {
    const S = this.size, i = Math.max(0, Math.min(S - 1, Math.floor(this.tx(x)))), j = Math.max(0, Math.min(S - 1, Math.floor(this.tx(z)))), o = (j * S + i) * 4;
    return { road: this.data[o] / 255 * 16, town: this.data[o + 1] / 255, forest: this.data[o + 2] / 255 };
  }
}

export function buildWorld(seed = 1337) {
  const R = rng(seed * 7 + 3);
  const T = new Terrain(seed);
  const world = new GeoWorld(T);
  const ground = new Ground(T);
  const roofs = [], burning = [], open = [], loot = [], roads = [], towns = [];
  const add = (min, max, o = {}) => world.add(makeBox(min, max, { grid: false, edges: false, ...o }));
  const at = (x, y, z, sx, sy, sz, o) => add([x - sx / 2, y, z - sz / 2], [x + sx / 2, y + sy, z + sz / 2], o);
  const rot = (x, y, z, r, sx, sy, sz, o = {}) => {
    const c = Math.cos(r[1]), s = Math.sin(r[1]);
    const b = at(x, y, z, Math.abs(c) * sx + Math.abs(s) * sz, sy, Math.abs(s) * sx + Math.abs(c) * sz, o);
    b.scale = [sx, sy, sz]; compose(b.model, b.center, r, b.scale);
    return b;
  };
  const car = (x, y, z, yaw, burn) => {
    const col = burn ? [0.08, 0.07, 0.06] : CARS[Math.floor(R() * CARS.length)], c = Math.cos(yaw), s = Math.sin(yaw);
    rot(x, y, z, [0, yaw, 0], 1.9, 0.75, 4.3, { color: col, shape: 0.2, mat: 'paint' });
    rot(x + 0.3 * s, y + 0.75, z + 0.3 * c, [0, yaw, 0], 1.7, 0.6, 2.1, { color: burn ? col : [0.1, 0.13, 0.16], shape: 0.15, mat: 'glass', solid: false });
    if (burn) burning.push([x, y + 1.2, z]);
  };
  const tree = (x, z, big = 1) => {
    const y = T.heightAt(x, z), th = (3 + R() * 2) * big;
    at(x, y - 0.3, z, 0.45 * big, th + 0.3, 0.45 * big, { color: [0.3, 0.22, 0.15], shape: 'cylY', tex: 62 });
    at(x, y + th - 0.8 * big, z, (4 + R() * 2) * big, (4 + R() * 1.5) * big, (4 + R() * 2) * big, { color: LEAFC[Math.floor(R() * LEAFC.length)], shape: 'blob', tex: 61, solid: false });
  };
  const flatTarget = (x, z) => Math.max(T.natural(x, z), WATER + 6);
  // how flat and dry a patch of land is (lower = better for building on)
  const rough = (x, z, r) => {
    let lo = Infinity, hi = -Infinity;
    for (let a = 0; a < 8; a++) for (const f of [0.5, 1]) { const h = T.natural(x + Math.cos(a * 0.785) * r * f, z + Math.sin(a * 0.785) * r * f); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    const c = T.natural(x, z);
    return (hi - lo) + (lo < WATER + 3 ? 60 : 0) + (c > 110 ? 80 : 0);
  };

  // ---- where everything goes
  const spots = [];      // { x, z, r, kind }
  const free = (x, z, r, gap) => Math.abs(x) < TH - 300 - r && Math.abs(z) < TH - 300 - r && spots.every((s) => Math.hypot(s.x - x, s.z - z) > s.r + r + gap);
  const best = (n, gen) => { let b = null, bs = Infinity; for (let i = 0; i < n; i++) { const [x, z, r] = gen(); const sc = rough(x, z, r); if (sc < bs) { bs = sc; b = [x, z, sc]; } } return b; };
  // the city near the middle
  const CITY_R = 290;
  const cb = best(60, () => [(R() - 0.5) * 900, (R() - 0.5) * 900, CITY_R]);
  const cx = cb[0], cz = cb[1], cityY = flatTarget(cx, cz);
  T.flatten(cx, cz, CITY_R, cityY, 150);
  spots.push({ x: cx, z: cz, r: CITY_R + 80, kind: 'city', y: cityY });
  // two small cities further out
  for (let n = 0; n < 2; n++) {
    let b = null;
    for (let tries = 0; tries < 6 && !b; tries++) {
      b = best(50, () => { const a = (n * Math.PI) + (R() - 0.5) * 2.2, d = 1500 + R() * 1000; return [cx + Math.cos(a) * d, cz + Math.sin(a) * d, 170]; });
      if (b && (!free(b[0], b[1], 170, 400) || b[2] > 40)) b = null;
    }
    if (!b) continue;
    const y = flatTarget(b[0], b[1]);
    T.flatten(b[0], b[1], 160, y, 110);
    spots.push({ x: b[0], z: b[1], r: 170, kind: 'small', y });
  }
  // towns and villages
  const place = (count, r, gap, kind) => {
    for (let n = 0, tries = 0; n < count && tries < count * 40; tries++) {
      const x = (R() - 0.5) * 2 * (TH - 400), z = (R() - 0.5) * 2 * (TH - 400);
      if (!free(x, z, r, gap) || rough(x, z, r) > 26) continue;
      const y = flatTarget(x, z);
      T.flatten(x, z, r, y, r * 0.9);
      spots.push({ x, z, r, kind, y }); n++;
    }
  };
  place(8, 70, 420, 'town');
  place(14, 42, 260, 'village');

  // ---- roads: join everything up (a spanning tree, plus a few loops), each one winding round the hills
  const nodes = spots.map((s, i) => ({ ...s, i }));
  const edges = [], inTree = new Set([0]);
  while (inTree.size < nodes.length) {
    let bd = Infinity, be = null;
    for (const a of inTree) for (const b of nodes) if (!inTree.has(b.i)) { const d = Math.hypot(nodes[a].x - b.x, nodes[a].z - b.z); if (d < bd) { bd = d; be = [a, b.i]; } }
    inTree.add(be[1]); edges.push(be);
  }
  for (const a of nodes) {
    const near = nodes.filter((b) => b.i !== a.i && !edges.some((e) => (e[0] === a.i && e[1] === b.i) || (e[1] === a.i && e[0] === b.i))).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
    if (near && Math.hypot(near.x - a.x, near.z - a.z) < 1100 && R() < 0.45) edges.push([a.i, near.i]);
  }
  const inSpot = (x, z, m = 0) => spots.find((s) => Math.hypot(s.x - x, s.z - z) < s.r * 0.85 + m);
  const route = (A, B) => {
    // start and finish at the edge of each place, then step across the land, picking the gentlest way that still heads there
    const ang = Math.atan2(B.z - A.z, B.x - A.x);
    let x = A.x + Math.cos(ang) * A.r * 0.8, z = A.z + Math.sin(ang) * A.r * 0.8;
    const ex = B.x - Math.cos(ang) * B.r * 0.8, ez = B.z - Math.sin(ang) * B.r * 0.8;
    const pts = [[A.x, A.z], [x, z]];
    let heading = ang;
    for (let s = 0; s < 120; s++) {
      const d = Math.hypot(ex - x, ez - z);
      if (d < 70) break;
      const want = Math.atan2(ez - z, ex - x), h0 = T.natural(x, z);
      let bc = Infinity, bh = want;
      for (let k = -5; k <= 5; k++) {
        const a = want + k * 0.13, nx = x + Math.cos(a) * 55, nz = z + Math.sin(a) * 55, h = T.natural(nx, nz);
        const turn = Math.abs(((a - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const c = Math.abs(h - h0) * 2.2 + Math.abs(k) * 1.2 + turn * 8 + (h < WATER + 1 ? 30 : 0) + (h > 120 ? 40 : 0) + (inSpot(nx, nz) && inSpot(nx, nz) !== B && inSpot(nx, nz) !== A ? 50 : 0);
        if (c < bc) { bc = c; bh = a; }
      }
      heading = bh; x += Math.cos(bh) * 55; z += Math.sin(bh) * 55;
      pts.push([x, z]);
    }
    pts.push([ex, ez], [B.x, B.z]);
    // smooth the bends
    for (let it = 0; it < 2; it++) for (let i = 2; i < pts.length - 2; i++) { pts[i][0] = (pts[i - 1][0] + pts[i][0] * 2 + pts[i + 1][0]) / 4; pts[i][1] = (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4; }
    // heights: follow the land but never steeper than about 1 in 9; held up out of the water (a causeway)
    const hs = pts.map(([px, pz], i) => (i === 0 ? A.y : i === pts.length - 1 ? B.y : Math.max(WATER + 1.6, T.natural(px, pz))));
    for (let it = 0; it < 3; it++) for (let i = 1; i < hs.length - 1; i++) hs[i] = Math.max(WATER + 1.6, (hs[i - 1] + hs[i] * 2 + hs[i + 1]) / 4);
    for (let i = 1; i < pts.length - 2; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      T.road(ax, az, hs[i], bx, bz, hs[i + 1], 5.5, 15);
      roads.push([ax, az, bx, bz, hs[i], hs[i + 1]]);
      ground.road(ax, az, bx, bz);
    }
    return { pts, hs };
  };
  const routes = edges.map(([a, b]) => route(nodes[a], nodes[b]));

  // water: one big sheet at sea level shows wherever the land dips below it
  add([-TH, WATER - 40, -TH], [TH, WATER, TH], { color: [0.16, 0.27, 0.3], tex: 15, noShadow: true, noBullet: true });

  // ---- buildings
  function building(x0, z0, x1, z1, base, h, dc, kind) {
    const sx = x1 - x0, sz = z1 - z0, bx = (x0 + x1) / 2, bz = (z0 + z1) / 2;
    const f = FACADES[Math.floor(R() * FACADES.length)];
    const b = add([x0, base, z0], [x1, base + h, z1], { color: f.col, tex: f.tex });
    const top = base + h, pc = f.col.map((v) => v * 0.8);
    at(bx, top, z0 + 0.2, sx, 0.8, 0.4, { color: pc, tex: 3 });
    at(bx, top, z1 - 0.2, sx, 0.8, 0.4, { color: pc, tex: 3 });
    at(x0 + 0.2, top, bz, 0.4, 0.8, sz - 0.8, { color: pc, tex: 3 });
    at(x1 - 0.2, top, bz, 0.4, 0.8, sz - 0.8, { color: pc, tex: 3 });
    // a stair hut (the roof door your team goes in by) and some clutter
    const hx = x0 + 2.4, hz = z0 + 2.4;
    at(hx, top, hz, 3, 3, 3, { color: pc, tex: 3 });
    at(hx + 1.52, top, hz, 0.06, 2.2, 1.1, { color: [0.25, 0.2, 0.15], solid: false, noShadow: true });
    if (R() < 0.6) at(x1 - 2.6, top, bz + (R() - 0.5) * sz * 0.4, 2.2, 1.3, 1.6, { color: [0.62, 0.62, 0.6], tex: 5, mat: 'metal' });
    if (h > 26 && R() < 0.3) {
      const wx = x1 - 3.5, wz = z1 - 3.5;
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) at(wx + dx * 1.1, top, wz + dz * 1.1, 0.2, 2.6, 0.2, { color: [0.25, 0.2, 0.15] });
      at(wx, top + 2.6, wz, 3.2, 3, 3.2, { color: [0.42, 0.3, 0.2], shape: 'cylY', tex: 12 });
    }
    if (h > 18 && R() < 0.4) {
      const nc = NEON[Math.floor(R() * NEON.length)], len = Math.min(h * 0.5, 16), side = R() < 0.5;
      const px = side ? x0 - 0.25 : bx + (R() - 0.5) * sx * 0.4, pz = side ? bz + (R() - 0.5) * sz * 0.4 : z0 - 0.25;
      at(px, top - len - 2, pz, side ? 0.35 : 2.2, len, side ? 2.2 : 0.35, { color: [0.08, 0.08, 0.1], noShadow: true, solid: false });
      for (let k = 0; k < Math.floor(len / 2.2); k++) at(side ? px - 0.2 : px, top - len - 1.4 + k * 2.2, side ? pz : pz - 0.2, side ? 0.08 : 1.5, 1.3, side ? 1.5 : 0.08, { color: nc, emissive: 1, noShadow: true, solid: false });
    }
    const rec = { box: b, top, x: bx, z: bz, sx, sz, h, base, door: [bx, base, z0 - 0.5], stair: [hx, top, hz] };
    if (h > 7 && sx >= 12 && sz >= 12) roofs.push(rec);
    const types = Object.keys(LOOT_TYPES);
    if (kind || (h < 60 && R() < 0.14)) {
      const type = kind || (h > 40 ? (R() < 0.5 ? 'hospital' : 'flats') : types[Math.floor(R() * types.length)]);
      rec.loot = type; rec.floors = Math.max(1, Math.round(h / 3.6));
      const L = LOOT_TYPES[type];
      at(bx, base + 3.6, z0 - 0.3, Math.min(sx - 2, 7), 1.1, 0.2, { color: L.col, emissive: 0.85, noShadow: true, solid: false });
      loot.push(rec);
    }
    return rec;
  }
  const house = (x, y, z, yaw = 0) => {
    const sx = 9, sz = 8, hh = 4 + R() * 2.5, col = HOUSES[Math.floor(R() * HOUSES.length)], rc = ROOFS[Math.floor(R() * ROOFS.length)];
    at(x, y - 0.6, z, sx, hh + 0.6, sz, { color: col, tex: 10 });
    const half = sx / 2 + 0.4, rise = 2.2, sl = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (const sd of [-1, 1]) rot(x + sd * half / 2, y + hh + rise / 2 - 0.15, z, [0, 0, -sd * ang], sl, 0.22, sz + 0.8, { color: rc, shape: 0.05, solid: false });
    at(x + 2.2, y + hh - 0.2, z + 1.5, 0.9, 2.2, 0.9, { color: [0.45, 0.3, 0.25], tex: 13 });          // chimney
    if (R() < 0.5) tree(x + 7, z + 6, 0.9);
  };

  // a city block grid: narrow streets, an avenue every 4th, taller towards the middle
  const city = (cx, cz, CR, Y, tallMul, withSpire) => {
    const lines = [];
    { let p = -CR + 6, n = 0; while (p < CR) { lines.push(p); p += (n % 4 === 3 ? 26 : 14) / 2 + 36 + (n % 4 === 2 ? 26 : 14) / 2; n++; } }
    const sw = (k) => (k % 4 === 3 ? 26 : 14);
    add([cx - CR, Y - 1, cz - CR], [cx + CR, Y + 0.02, cz + CR], { color: [0.17, 0.17, 0.18], tex: 7, noShadow: true });
    ground.town(cx, cz, CR, 40);
    let sp = null;
    const midI = Math.floor(lines.length / 2) - 1;
    for (let i = 0; i < lines.length - 1; i++) for (let j = 0; j < lines.length - 1; j++) {
      const x0 = cx + lines[i] + sw(i) / 2, x1 = cx + lines[i + 1] - sw(i + 1) / 2, z0 = cz + lines[j] + sw(j) / 2, z1 = cz + lines[j + 1] - sw(j + 1) / 2;
      if (x1 - x0 < 10 || z1 - z0 < 10) continue;
      const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
      const dc = Math.hypot(bx - cx, bz - cz) / CR;
      if (dc > 0.98) continue;
      add([x0, Y, z0], [x1, Y + 0.18, z1], { color: [0.5, 0.49, 0.46], tex: 4 });
      const base = Y + 0.18;
      if (withSpire && i === midI && j === midI) { sp = buildSpire({ add, at, R }, bx, bz, base, Math.min(W, D)); continue; }
      const r = R();
      if (r < 0.08 && dc > 0.2) { for (let t = 0; t < 5; t++) tree(x0 + 3 + R() * (W - 6), z0 + 3 + R() * (D - 6), 0.9); open.push([bx, bz, base]); continue; }
      if (r < 0.13) { for (let c = 0; c < 6; c++) car(x0 + 5 + (c % 3) * ((W - 10) / 2), base, z0 + 6 + Math.floor(c / 3) * (D - 12), (R() - 0.5) * 0.3, R() < 0.12); open.push([bx, bz, base]); continue; }
      const tall = 1 - dc;
      const parts = R() < 0.55 ? (R() < 0.5 ? [[x0, z0, bx - 1.5, z1], [bx + 1.5, z0, x1, z1]] : [[x0, z0, x1, bz - 1.5], [x0, bz + 1.5, x1, z1]]) : [[x0, z0, x1, z1]];
      for (const [a0, b0, a1, b1] of parts) building(a0 + 0.5, b0 + 0.5, a1 - 0.5, b1 - 0.5, base, 10 + R() * 14 + tall * tall * (40 + R() * 60) * tallMul, dc);
      if (R() < 0.5) car(x0 - sw(i) / 2 + (R() < 0.5 ? -3 : 3), Y, bz + (R() - 0.5) * D * 0.7, (R() - 0.5) * 0.6, R() < 0.18);
      at(x0 + 0.6, base, z0 + 0.6, 0.18, 6.5, 0.18, { color: [0.2, 0.2, 0.22], mat: 'metal' });
      at(x0 + 0.6, base + 6.5, z0 + 0.6, 0.55, 0.22, 0.55, { color: [1, 0.85, 0.55], emissive: R() < 0.5 ? 0.9 : 0, noShadow: true });
    }
    return sp;
  };

  let spire = null;
  const cities = [];
  for (const s of spots) {
    if (s.kind === 'city') { spire = city(s.x, s.z, CITY_R, s.y, 1, true); cities.push(s); continue; }
    if (s.kind === 'small') { city(s.x, s.z, 150, s.y, 0.35, false); cities.push(s); continue; }
    const t = s, y = t.y;
    towns.push({ x: t.x, z: t.z, y, r: t.r, kind: t.kind });
    ground.town(t.x, t.z, t.r * 0.75, t.r * 0.4);
    open.push([t.x, t.z, y]);
    if (t.kind === 'town') {
      ground.road(t.x - 60, t.z, t.x + 60, t.z); ground.road(t.x, t.z - 60, t.x, t.z + 60);
      const lots = [];
      for (const qx of [-1, 1]) for (const qz of [-1, 1]) for (const k of [0, 1]) lots.push([t.x + qx * (13 + k * 22), t.z + qz * 14], [t.x + qx * 14, t.z + qz * 36]);
      const kinds = ['gas', 'market', 'pharmacy', 'police', 'hardware', 'gunshop'];
      for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
      lots.forEach(([x, z], n) => {
        if (n < 4) {
          const kind = kinds[n];
          if (kind === 'gas') gasStation(x, y, z);
          else building(x - 9, z - 7, x + 9, z + 7, y, 4 + Math.floor(R() * 3) * 3.6, 1, kind);
          return;
        }
        if (R() < 0.15) { tree(x, z, 1.2); return; }
        house(x, y, z);
      });
      const ch = [t.x - 30, t.z + 40];
      at(ch[0], y - 0.5, ch[1], 10, 9.5, 16, { color: [0.7, 0.68, 0.62], tex: 3 });
      at(ch[0], y - 0.5, ch[1] - 9, 5, 20.5, 5, { color: [0.7, 0.68, 0.62], tex: 3 });
      at(ch[0], y + 20, ch[1] - 9, 3.4, 5, 3.4, { color: [0.3, 0.3, 0.32], shape: { taper: [1, 1] } });
      for (let n = 0; n < 4; n++) car(t.x + (R() - 0.5) * 80, y, t.z + (R() < 0.5 ? -1 : 1) * 2.5, Math.PI / 2 + (R() - 0.5) * 0.5, R() < 0.2);
    } else {
      // a village: a row of houses either side of the road through it, and one shop
      const a = R() * Math.PI, c = Math.cos(a), sn = Math.sin(a);
      ground.road(t.x - c * 45, t.z - sn * 45, t.x + c * 45, t.z + sn * 45);
      for (let k = -2; k <= 2; k++) for (const side of [-1, 1]) {
        const x = t.x + c * k * 16 - sn * side * 13, z = t.z + sn * k * 16 + c * side * 13;
        if (k === 0 && side === 1) { building(x - 8, z - 6, x + 8, z + 6, y, 4 + Math.floor(R() * 2) * 3.6, 1, ['market', 'pharmacy', 'hardware'][Math.floor(R() * 3)]); continue; }
        if (R() < 0.75) house(x, y, z); else tree(x, z, 1.1);
      }
      if (R() < 0.6) car(t.x + c * (R() - 0.5) * 50, y, t.z + sn * (R() - 0.5) * 50, Math.PI / 2 - a, R() < 0.3);
    }
  }
  function gasStation(x, y, z) {
    at(x, y - 0.3, z, 14, 0.5, 10, { color: [0.4, 0.4, 0.42], tex: 4 });
    for (const [dx, dz] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) at(x + dx, y, z + dz, 0.4, 5, 0.4, { color: [0.85, 0.85, 0.85], mat: 'paint' });
    at(x, y + 5, z, 14, 0.6, 9, { color: [0.9, 0.9, 0.88], mat: 'paint' });
    at(x, y + 5.6, z, 14.2, 0.5, 9.2, { color: [1, 0.55, 0.1], emissive: 0.6 });
    for (const dx of [-2.5, 2.5]) at(x + dx, y, z, 0.8, 1.6, 0.6, { color: [0.85, 0.2, 0.15], mat: 'paint' });
    building(x - 7, z + 6, x + 7, z + 14, y, 4, 1, 'gas');
  }

  // ---- out on the roads: gas stations, farms, wrecks
  const clear = (x, z, r) => !inSpot(x, z, r + 20) && world.boxes.length && T.slopeAt(x, z) < 0.12 && T.heightAt(x, z) > WATER + 2;
  const offRoad = (x, z, m) => { for (const r of roads) { const dx = r[2] - r[0], dz = r[3] - r[1], L = dx * dx + dz * dz || 1, tt = Math.max(0, Math.min(1, ((x - r[0]) * dx + (z - r[1]) * dz) / L)); if (Math.hypot(x - r[0] - dx * tt, z - r[1] - dz * tt) < m) return false; } return true; };
  // gas stations beside the roads
  let gs = 0;
  for (const rt of routes) {
    if (rt.pts.length < 14 || gs >= 9 || R() < 0.35) continue;
    const i = Math.floor(rt.pts.length / 2), [px, pz] = rt.pts[i], [qx, qz] = rt.pts[i + 1], a = Math.atan2(qz - pz, qx - px);
    const x = px - Math.sin(a) * 22, z = pz + Math.cos(a) * 22;
    if (!clear(x, z, 20) || !offRoad(x, z, 14)) continue;
    const y = T.heightAt(x, z); T.flatten(x, z, 14, y, 14); ground.town(x, z, 12, 10); gasStation(x, y, z); open.push([x, z, y]); gs++;
  }
  // farms: a barn, a silo and a farmhouse out in the fields
  for (let n = 0, tries = 0; n < 34 && tries < 600; tries++) {
    const x = (R() - 0.5) * 2 * (TH - 300), z = (R() - 0.5) * 2 * (TH - 300);
    if (T.forest(x, z) > 0.25 || T.natural(x, z) > 100 || T.natural(x, z) < WATER + 3 || rough(x, z, 30) > 9 || inSpot(x, z, 60) || !offRoad(x, z, 22)) continue;
    const y = T.natural(x, z);
    T.flatten(x, z, 22, y, 22); ground.town(x, z, 18, 14);
    const b = at(x, y - 0.5, z, 16, 8.5, 12, { color: [0.55, 0.18, 0.12], tex: 12 });
    roofs.push({ box: b, top: y + 8, x, z, sx: 16, sz: 12, h: 8, base: y, farm: true, door: [x, y, z - 6.5], stair: [x - 6, y + 8, z - 4] });
    at(x + 12, y - 0.5, z - 4, 4, 12.5, 4, { color: [0.7, 0.7, 0.66], shape: 'cylY', mat: 'paint' });
    at(x + 12, y + 12, z - 4, 4.1, 1.6, 4.1, { color: [0.55, 0.55, 0.52], shape: 'sphere', mat: 'metal' });
    house(x - 4, y, z + 16);
    open.push([x, z + 22, y]);
    n++;
  }
  for (const r of roads) if (R() < 0.12) {
    const t = R(), x = r[0] + (r[2] - r[0]) * t + (R() - 0.5) * 5, z = r[1] + (r[3] - r[1]) * t + (R() - 0.5) * 5;
    if (inSpot(x, z, 0)) continue;
    car(x, T.heightAt(x, z), z, Math.atan2(r[2] - r[0], r[3] - r[1]) + (R() - 0.5) * 0.8, R() < 0.25);
  }
  ground.nature();

  // ---- the upgrade hangar scene (off the map)
  const [hx, , hz] = HANGAR;
  add([hx - 40, -1, hz - 40], [hx + 40, 0.1, hz + 40], { color: [0.36, 0.36, 0.38], tex: 3 });
  add([hx - 20, 0.1, hz - 20], [hx + 20, 0.12, hz + 20], { color: [0.22, 0.24, 0.26], noShadow: true, solid: false });
  add([hx - 21, 0.1, hz + 18], [hx + 21, 18, hz + 20], { color: [0.4, 0.42, 0.44], tex: 5, mat: 'metal' });
  add([hx - 21, 0.1, hz - 22], [hx - 19, 18, hz + 20], { color: [0.4, 0.42, 0.44], tex: 5, mat: 'metal' });
  add([hx + 19, 0.1, hz - 22], [hx + 21, 18, hz + 20], { color: [0.4, 0.42, 0.44], tex: 5, mat: 'metal' });
  for (const z of [-16, -6, 4, 14]) add([hx - 21, 17, hz + z - 0.4], [hx + 21, 18, hz + z + 0.4], { color: [0.3, 0.31, 0.33], mat: 'metal' });
  for (const x of [-12, 0, 12]) add([hx + x - 0.4, 16.6, hz - 20], [hx + x + 0.4, 17, hz + 18], { color: [1, 0.96, 0.85], emissive: 1, noShadow: true, solid: false });
  for (let s = 0; s < 4; s++) at(hx - 16 + s * 2.4, 0.1, hz + 16, 2, 1.2, 1.6, { color: [0.55, 0.42, 0.22], tex: 12 });
  at(hx + 15, 0.1, hz + 14, 3, 1.1, 1.2, { color: [0.75, 0.15, 0.1], mat: 'paint', shape: 0.08 });
  for (let s = -9; s <= 9; s++) for (const zz of [-19.6, 19.6]) at(hx + s * 2, 0.12, hz + zz, 1, 0.02, 0.4, { color: s % 2 ? [0.95, 0.75, 0.1] : [0.08, 0.08, 0.08], noShadow: true, solid: false });

  return { world, terrain: T, ground, roofs, burning, open, loot, roads, towns, cities, city: { x: cx, z: cz, r: CITY_R, y: cityY }, spire, fobs: spire ? [spire] : [] };
}

// THE SPIRE: a tower 170 m tall with a landing bay cut into one side 70 m up, the pad sticking out over the street.
// Zombies can't get up there (they pile up at the bottom and the guns on the bay pick them off).
function buildSpire({ add, at }, x, z, base, w) {
  const S = Math.min(w - 2, 34), H = 172, BAY = 72, BH = 15, DEP = 16;
  const x0 = x - S / 2, x1 = x + S / 2, z0 = z - S / 2, z1 = z + S / 2;
  const CON = [0.42, 0.43, 0.45], DK = [0.22, 0.23, 0.25];
  // the tower, in pieces so there's a hole for the bay on the south face (-z)
  add([x0, base, z0], [x1, base + BAY, z1], { color: CON, tex: 6 });
  add([x0, base + BAY, z0 + DEP], [x1, base + BAY + BH, z1], { color: DK, tex: 5, mat: 'metal' });
  add([x0, base + BAY, z0], [x0 + 2, base + BAY + BH, z0 + DEP], { color: CON, tex: 3 });
  add([x1 - 2, base + BAY, z0], [x1, base + BAY + BH, z0 + DEP], { color: CON, tex: 3 });
  add([x0, base + BAY + BH, z0], [x1, base + H, z1], { color: CON, tex: 6 });
  // setbacks and a crown on top
  add([x0 + 3, base + H, z0 + 3], [x1 - 3, base + H + 14, z1 - 3], { color: DK, tex: 2 });
  at(x, base + H + 14, z, 1, 26, 1, { color: [0.6, 0.6, 0.62], mat: 'metal' });
  at(x, base + H + 40, z, 1.4, 1.4, 1.4, { color: [1, 0.15, 0.1], emissive: 1, shape: 'sphere', noShadow: true });
  // vertical light strips up the corners
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) at(px, base + 4, pz, 0.6, H - 6, 0.6, { color: [1, 0.75, 0.35], emissive: 0.7, noShadow: true, solid: false });
  // the bay floor and the pad sticking out
  const PAD_OUT = 22;
  const floorY = base + BAY;
  add([x0 + 2, floorY - 0.6, z0 - PAD_OUT], [x1 - 2, floorY + 0.3, z0 + DEP], { color: [0.2, 0.2, 0.22], tex: 7 });
  const pad = add([x - 11, floorY + 0.3, z0 - PAD_OUT + 2], [x + 11, floorY + 0.55, z0 - PAD_OUT + 24], { color: [0.16, 0.16, 0.18], tex: 7, tag: 'pad' });
  const pc = [x, floorY + 0.55, z0 - PAD_OUT + 13];
  // support struts under the pad
  for (const sx of [-12, 12]) add([x + sx - 0.8, floorY - 14, z0 - 2], [x + sx + 0.8, floorY - 0.6, z0], { color: DK, mat: 'metal' });
  for (const sx of [-12, 12]) add([x + sx - 0.6, floorY - 3, z0 - PAD_OUT + 1], [x + sx + 0.6, floorY - 0.6, z0], { color: DK, mat: 'metal' });
  // markings: the H, a yellow ring, edge lights
  add([pc[0] - 10, pc[1], pc[2] - 10], [pc[0] + 10, pc[1] + 0.02, pc[2] + 10], { color: [0.95, 0.75, 0.15], solid: false, noShadow: true });
  add([pc[0] - 9.4, pc[1], pc[2] - 9.4], [pc[0] + 9.4, pc[1] + 0.04, pc[2] + 9.4], { color: [0.16, 0.16, 0.18], solid: false, noShadow: true });
  for (const [a, b] of [[[-4, -5], [-2.6, 5]], [[2.6, -5], [4, 5]], [[-2.6, -0.7], [2.6, 0.7]]]) add([pc[0] + a[0], pc[1] + 0.04, pc[2] + a[1]], [pc[0] + b[0], pc[1] + 0.06, pc[2] + b[1]], { color: [0.95, 0.95, 0.92], solid: false, noShadow: true });
  for (let k = 0; k < 12; k++) {
    const ex = x - 15 + (k % 6) * 6, ez = k < 6 ? z0 - PAD_OUT + 0.3 : z0 - PAD_OUT + 0.3;
    at(k < 6 ? ex : x0 + 2.4, floorY + 0.3, k < 6 ? ez : z0 - PAD_OUT + 4 + (k - 6) * 3.4, 0.3, 0.25, 0.3, { color: [0.3, 1, 0.4], emissive: 1, noShadow: true, solid: false });
  }
  // railings on the open sides
  for (const sx of [x0 + 2, x1 - 2]) add([sx - 0.1, floorY + 0.3, z0 - PAD_OUT], [sx + 0.1, floorY + 1.4, z0], { color: [0.9, 0.75, 0.15], mat: 'paint', solid: false });
  // inside the bay: fuel tanks, crates, a crane and lights
  for (const fx of [x0 + 5, x0 + 9]) at(fx, floorY + 0.3, z0 + DEP - 3, 3, 4.5, 3, { color: [0.75, 0.22, 0.12], shape: 'cylY', mat: 'paint' });
  for (let k = 0; k < 4; k++) at(x1 - 5 - (k % 2) * 2.2, floorY + 0.3 + Math.floor(k / 2) * 1.3, z0 + DEP - 3, 2, 1.3, 1.6, { color: [0.5, 0.4, 0.22], tex: 12 });
  at(x1 - 4, floorY + 0.3, z0 + 3, 0.8, 12, 0.8, { color: [0.9, 0.75, 0.15], mat: 'paint' });
  at(x1 - 4, floorY + 12, z0 - 6, 1, 1, 20, { color: [0.9, 0.75, 0.15], mat: 'paint' });
  for (const lx of [x - 8, x, x + 8]) at(lx, floorY + BH - 0.6, z0 + DEP / 2, 0.6, 0.3, DEP - 2, { color: [1, 0.95, 0.85], emissive: 1, noShadow: true, solid: false });
  // a big lit sign
  at(x, floorY + BH + 4, z0 - 0.3, 22, 4, 0.3, { color: [0.12, 0.12, 0.14], mat: 'metal', solid: false });
  at(x, floorY + BH + 4.4, z0 - 0.5, 20, 3.2, 0.1, { color: [1, 0.78, 0.2], emissive: 0.9, noShadow: true, solid: false });
  const turrets = [[x0 + 4, z0 - PAD_OUT + 3], [x1 - 4, z0 - PAD_OUT + 3]].map(([tx, tz]) => {
    at(tx, floorY + 0.3, tz, 2, 1.4, 2, { color: [0.3, 0.32, 0.3], mat: 'metal' });
    return { pos: [tx, floorY + 2.4, tz], yaw: Math.PI, cd: 0, flash: 0 };
  });
  return { id: 'spire', name: 'THE SPIRE', pos: [x, base, z], pad, padAt: pc, hp: 1, max: 1, turrets, foot: [x, base, z0 - 3], top: base + H };
}
