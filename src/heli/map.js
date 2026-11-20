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
const LEAFC = [[0.2, 0.32, 0.11], [0.26, 0.36, 0.13], [0.22, 0.34, 0.14], [0.3, 0.38, 0.12], [0.18, 0.28, 0.1], [0.5, 0.36, 0.12]];
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
    this.stampWater();
  }
  // a rectangle of town ground, and water depth stamped where we've dug rivers and ponds
  rect(x, z, rx, rz, fade = 20) {
    const S = this.size, D = this.data, k = this.span / S;
    const i0 = Math.max(0, Math.floor(this.tx(x - rx - fade))), i1 = Math.min(S - 1, Math.ceil(this.tx(x + rx + fade)));
    const j0 = Math.max(0, Math.floor(this.tx(z - rz - fade))), j1 = Math.min(S - 1, Math.ceil(this.tx(z + rz + fade)));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = this.x0 + (i + 0.5) * k, pz = this.z0 + (j + 0.5) * k, d = Math.max(Math.abs(px - x) - rx, Math.abs(pz - z) - rz);
      const v = Math.round((1 - smooth(0, fade, d)) * 255), o = (j * S + i) * 4 + 1;
      if (v > D[o]) D[o] = v;
    }
  }
  water(x, z, rx, rz, depth, fade = 30) { (this.wet = this.wet || []).push([x, z, rx, rz, depth, fade]); }
  stampWater() {
    const S = this.size, D = this.data, k = this.span / S;
    for (const [x, z, rx, rz, depth, fade] of this.wet || []) {
      const i0 = Math.max(0, Math.floor(this.tx(x - rx))), i1 = Math.min(S - 1, Math.ceil(this.tx(x + rx)));
      const j0 = Math.max(0, Math.floor(this.tx(z - rz))), j1 = Math.min(S - 1, Math.ceil(this.tx(z + rz)));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = this.x0 + (i + 0.5) * k, pz = this.z0 + (j + 0.5) * k, d = Math.min(rx - Math.abs(px - x), rz - Math.abs(pz - z));
        const v = Math.round(Math.min(1, depth * smooth(0, fade, d) / 32) * 255), o = (j * S + i) * 4;
        D[o + 3] = Math.max(D[o + 3], v); D[o + 1] = 0; D[o + 2] = 0;
      }
    }
  }
  at(x, z) {
    const S = this.size, i = Math.max(0, Math.min(S - 1, Math.floor(this.tx(x)))), j = Math.max(0, Math.min(S - 1, Math.floor(this.tx(z)))), o = (j * S + i) * 4;
    return { road: this.data[o] / 255 * 16, town: this.data[o + 1] / 255, forest: this.data[o + 2] / 255 };
  }
}

export function buildWorld(seed = 1337) {
  const R = rng(seed * 7 + 3);
  const TOWN_NAMES = ['MILLBROOK', 'ASHFORD', 'PINE HOLLOW', 'REDWATER', 'STONEBRIDGE', 'FAIRVIEW', 'GREYMOOR', 'HOLLIS', 'KESTREL', 'LOWFIELD', 'MARSH END', 'NORTHGATE', 'OAKRIDGE', 'PRESTON', 'QUARRY HILL', 'ROOKWOOD', 'SALTWELL', 'THORNBURY', 'UPTON', 'WILLOW CREEK', 'BRAMBLE', 'CEDAR FALLS', 'DUNMORE', 'ELMSTEAD', 'FOXLEY', 'GLENWOOD'];
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
  const wet = (x, z, m) => (ground.wet || []).some(([wx, wz, rx, rz]) => Math.abs(x - wx) < rx + m && Math.abs(z - wz) < rz + m);
  const free = (x, z, r, gap) => Math.abs(x) < TH - 300 - r && Math.abs(z) < TH - 300 - r && !wet(x, z, r + 60) && spots.every((s) => Math.hypot(s.x - x, s.z - z) > s.r + r + gap);
  const best = (n, gen) => { let b = null, bs = Infinity; for (let i = 0; i < n; i++) { const [x, z, r] = gen(); const sc = rough(x, z, r); if (sc < bs) { bs = sc; b = [x, z, sc]; } } return b; };
  // THE CITY: an island 660 m x 2 km between two wide rivers and a bay, with a borough across the east river.
  const CITY_R = 330, IW = 330, IL = 1000;
  const cx = -350 + (R() - 0.5) * 240, cz = 120 + (R() - 0.5) * 240, cityY = 8;
  const RIV = { e: [cx + IW + 240, 228], w: [cx - IW - 254, 242] };       // centre x, half width (the inner edge is the seawall)
  T.rect(cx, cz, IW + 40, IL + 40, cityY, 220);
  T.rect(RIV.e[0], cz - 230, RIV.e[1], IL + 330, WATER - 10, 10);
  T.rect(RIV.w[0], cz - 230, RIV.w[1], IL + 330, WATER - 10, 10);
  T.rect(cx - 10, cz - IL - 252, IW + 506, 240, WATER - 10, 10);
  for (const [x, rx] of [RIV.e, RIV.w]) ground.water(x, cz - 230, rx, IL + 330, 10);
  ground.water(cx - 10, cz - IL - 252, IW + 506, 240, 10);
  const boro = { x: RIV.e[0] + RIV.e[1] + 360, z: cz - 360, rx: 300, rz: 380 };
  T.rect(boro.x, boro.z, boro.rx + 30, boro.rz + 30, cityY, 50);
  const westEnd = { x: RIV.w[0] - RIV.w[1] - 200, z: cz + 260 };
  T.rect(westEnd.x, westEnd.z, 170, 50, cityY, 60);
  spots.push({ x: cx, z: cz, r: IL + 120, kind: 'city', y: cityY });
  spots.push({ x: boro.x, z: boro.z, r: 470, kind: 'borough', y: cityY });
  spots.push({ x: westEnd.x, z: westEnd.z, r: 120, kind: 'bridgehead', y: cityY });
  spots.push({ x: cx, z: cz + IL + 120, r: 60, kind: 'bridgehead', y: cityY });
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
  const nodes = spots.filter((s) => s.kind !== 'city').map((s, i) => ({ ...s, i }));
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
    for (let i = 0; i < pts.length - 1; i++) {
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
  // A building: shopfronts at street level, then the body in one to four tiers (each set back from the one below, with a
  // cornice on top), then a crown: a slanted glass top, an art deco needle, a pyramid, a penthouse with antennas, or a
  // plain roof with water tanks and air-con units. Walk-ups get fire escapes down the front.
  //   style: 'glass' (curtain wall), 'deco' (limestone piers), 'office' (ribbon windows), 'brick' (walk-up), 'brown' (brownstone)
  const GLASS = [[0.3, 0.45, 0.55], [0.25, 0.4, 0.38], [0.45, 0.38, 0.28], [0.5, 0.55, 0.6], [0.2, 0.28, 0.4], [0.35, 0.48, 0.5]];
  const STONE = [[0.78, 0.74, 0.66], [0.7, 0.66, 0.58], [0.82, 0.8, 0.74], [0.62, 0.58, 0.52]];
  const BRICK = [[0.55, 0.3, 0.22], [0.48, 0.26, 0.2], [0.6, 0.38, 0.28], [0.42, 0.3, 0.26], [0.66, 0.5, 0.38], [0.5, 0.42, 0.36]];
  const OFFICE = [[0.62, 0.6, 0.56], [0.45, 0.47, 0.5], [0.7, 0.66, 0.58], [0.55, 0.54, 0.5]];
  const pick = (a) => a[Math.floor(R() * a.length)];
  function tower(x0, z0, x1, z1, base, h, o = {}) {
    const style = o.style || 'office', front = o.front || 'z0';
    const col = style === 'glass' ? pick(GLASS) : style === 'deco' ? pick(STONE) : style === 'brick' || style === 'brown' ? (style === 'brown' ? [0.42, 0.28, 0.2] : pick(BRICK)) : pick(OFFICE);
    const tex = { glass: 2, deco: 17, office: 6, brick: 13, brown: 13 }[style];
    const dark = col.map((v) => v * 0.62);
    const SF = 4.6;
    // street level: shops (or a glass lobby)
    add([x0, base, z0], [x1, base + SF, z1], { color: style === 'glass' ? [0.55, 0.55, 0.56] : style === 'brown' ? [0.36, 0.25, 0.18] : col.map((v) => v * 0.9), tex: 18 });
    add([x0 - 0.35, base + SF, z0 - 0.35], [x1 + 0.35, base + SF + 0.45, z1 + 0.35], { color: dark, tex: 3 });
    // the tiers
    const body = h - SF;
    const tiers = style === 'deco' ? (h > 140 ? 4 : h > 70 ? 3 : 2) : style === 'glass' ? (h > 160 ? 2 : 1) : style === 'office' ? (h > 90 ? 2 : 1) : 1;
    const split = { 1: [1], 2: [0.62, 0.38], 3: [0.5, 0.3, 0.2], 4: [0.44, 0.26, 0.18, 0.12] }[tiers];
    let y = base + SF + 0.45, ix0 = x0, iz0 = z0, ix1 = x1, iz1 = z1, topBox = null;
    for (let t = 0; t < tiers; t++) {
      const th = Math.max(4, body * split[t] - (t === 0 ? 0.45 : 0));
      if (t > 0) {
        const inset = Math.min((ix1 - ix0) * 0.16, (iz1 - iz0) * 0.16, 7);
        ix0 += inset; iz0 += inset; ix1 -= inset; iz1 -= inset;
      }
      topBox = add([ix0, y, iz0], [ix1, y + th, iz1], { color: col, tex });
      y += th;
      // a cornice on each tier
      const cor = style === 'glass' ? 0.15 : 0.5;
      add([ix0 - cor, y, iz0 - cor], [ix1 + cor, y + (style === 'glass' ? 0.6 : 1.0), iz1 + cor], { color: style === 'glass' ? [0.2, 0.21, 0.23] : dark, tex: style === 'glass' ? 5 : 3, mat: style === 'glass' ? 'metal' : undefined });
      if (style === 'deco' && t < tiers - 1) for (const [px, pz] of [[ix0, iz0], [ix1, iz0], [ix0, iz1], [ix1, iz1]]) at(px, y, pz, 1.6, 2.4, 1.6, { color: dark, tex: 3 });
    }
    y += style === 'glass' ? 0.6 : 1.0;
    const top = y, cx0 = (ix0 + ix1) / 2, cz0 = (iz0 + iz1) / 2, w = ix1 - ix0, d = iz1 - iz0;
    // the crown
    const cr = R();
    if (style === 'deco' && h > 90) {
      at(cx0, top, cz0, w * 0.55, h * 0.06, d * 0.55, { color: col, tex: 17 });
      rot(cx0, top + h * 0.06, cz0, [Math.PI, 0, 0], w * 0.45, h * 0.08, d * 0.45, { color: cr < 0.5 ? [0.75, 0.76, 0.78] : [0.62, 0.5, 0.28], shape: { taper: [0.08, 0.08] }, mat: 'metal', solid: false });
      at(cx0, top + h * 0.14, cz0, 0.7, h * 0.12, 0.7, { color: [0.75, 0.76, 0.78], mat: 'metal', solid: false });
      at(cx0, top + h * 0.26, cz0, 0.9, 0.9, 0.9, { color: [1, 0.15, 0.1], emissive: 1, shape: 'sphere', noShadow: true, solid: false });
    } else if (style === 'glass' && cr < 0.45 && h > 60) {
      // a slanted glass top
      const sl = Math.min(w, d) * 0.5, ang = Math.atan2(sl, w);
      rot(cx0, top + sl / 2 - 0.5, cz0, [0, 0, ang], Math.hypot(w, sl) * 0.98, 0.5, d, { color: col, tex: 2, solid: false });
      add([ix0, top, iz0], [ix1, top + sl * 0.45, iz1], { color: [0.15, 0.16, 0.18], tex: 5, mat: 'metal', hidden: true });
    } else if (cr < 0.7 && h > 50) {
      // penthouse and antennas
      at(cx0, top, cz0, w * 0.45, 5, d * 0.45, { color: [0.3, 0.31, 0.33], tex: 5, mat: 'metal' });
      at(cx0 + w * 0.12, top + 5, cz0, 0.5, h * (0.08 + R() * 0.12), 0.5, { color: [0.7, 0.7, 0.72], mat: 'metal', solid: false });
      at(cx0 - w * 0.1, top + 5, cz0 + d * 0.1, 0.35, h * 0.06, 0.35, { color: [0.7, 0.7, 0.72], mat: 'metal', solid: false });
    } else if (style === 'glass' || style === 'office') {
      at(cx0, top, cz0, w * 0.5, 3.5, d * 0.4, { color: [0.36, 0.37, 0.39], tex: 5, mat: 'metal' });
    }
    // roof clutter: stair hut (your team's roof door), air-con, water tanks on the old buildings
    const hx = ix0 + 2.4, hz = iz0 + 2.4;
    at(hx, top, hz, 3, 3, 3, { color: dark, tex: 3 });
    at(hx + 1.52, top, hz, 0.06, 2.2, 1.1, { color: [0.25, 0.2, 0.15], solid: false, noShadow: true });
    for (let k = 0; k < (w > 20 ? 3 : 1); k++) if (R() < 0.7) at(ix1 - 2.6 - k * 3.2, top, iz1 - 3 - R() * (d - 6) * 0.5, 2.2, 1.3, 1.6, { color: [0.62, 0.62, 0.6], tex: 5, mat: 'metal' });
    if ((style === 'brick' || style === 'brown' || style === 'deco') && R() < 0.55 && w > 9) {
      const wx = ix1 - 3.5, wz = iz1 - 3.5;
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) at(wx + dx * 1.1, top, wz + dz * 1.1, 0.2, 2.8, 0.2, { color: [0.25, 0.2, 0.15] });
      at(wx, top + 2.8, wz, 3.2, 3.4, 3.2, { color: [0.42, 0.3, 0.2], shape: 'cylY', tex: 12 });
      rot(wx, top + 6.2, wz, [Math.PI, 0, 0], 3.3, 1.2, 3.3, { color: [0.3, 0.24, 0.2], shape: { taper: [0.1, 0.1] }, solid: false });
    }
    // fire escapes down the front of the walk-ups
    const fz = front === 'z0' ? z0 : z1, fs = front === 'z0' ? -1 : 1;
    if ((style === 'brick' || style === 'brown') && h > 12 && x1 - x0 > 8 && R() < 0.7) {
      const fx = x0 + (x1 - x0) * (0.3 + R() * 0.4), floors = Math.floor((h - SF) / 3.6);
      for (let f = 1; f < floors; f++) {
        const fy = base + SF + f * 3.6 - 0.4;
        at(fx, fy, fz + fs * 0.75, 5, 0.12, 1.4, { color: [0.08, 0.08, 0.09], mat: 'metal', solid: false, noShadow: false });
        at(fx, fy + 0.5, fz + fs * 1.42, 5, 0.9, 0.05, { color: [0.08, 0.08, 0.09], mat: 'metal', solid: false, noShadow: true });
        rot(fx + (f % 2 ? -0.8 : 0.8), fy - 1.75, fz + fs * 0.75, [0, 0, (f % 2 ? 1 : -1) * 0.95], 4.2, 0.1, 1.0, { color: [0.08, 0.08, 0.09], mat: 'metal', solid: false, noShadow: true });
      }
    }
    // signs and billboards
    if (o.neon && h > 14) {
      const nc = pick(NEON), len = Math.min(h * 0.5, 18);
      const side = R() < 0.5, px = side ? x0 - 0.3 : x0 + (x1 - x0) * (0.2 + R() * 0.6), pz = side ? z0 + (z1 - z0) * (0.2 + R() * 0.6) : fz + fs * 0.3;
      at(px, base + SF + 1, pz, side ? 0.35 : 2.2, len, side ? 2.2 : 0.35, { color: [0.08, 0.08, 0.1], noShadow: true, solid: false });
      for (let k = 0; k < Math.floor(len / 2.2); k++) at(side ? px - 0.2 : px, base + SF + 1.6 + k * 2.2, side ? pz : pz + fs * 0.2, side ? 0.08 : 1.5, 1.3, side ? 1.5 : 0.08, { color: nc, emissive: 1, noShadow: true, solid: false });
    }
    if (o.billboard) {
      const bw = Math.min(x1 - x0 - 2, 16), by = base + SF + 6 + R() * Math.min(20, h * 0.3);
      at((x0 + x1) / 2, by, fz + fs * 0.4, bw, 7, 0.3, { color: pick(NEON).map((v) => v * 0.9), emissive: 0.75, noShadow: true, solid: false });
      at((x0 + x1) / 2, by - 0.4, fz + fs * 0.25, bw + 0.6, 7.8, 0.2, { color: [0.06, 0.06, 0.07], noShadow: true, solid: false });
    }
    const rec = { box: topBox, top, x: cx0, z: cz0, sx: w, sz: d, h: top - base, base, door: [(x0 + x1) / 2, base, fz + fs * 0.5], stair: [hx, top, hz] };
    if (top - base > 7 && w >= 12 && d >= 12) roofs.push(rec);
    const types = Object.keys(LOOT_TYPES);
    if (o.kind || (top - base < 70 && R() < (o.lootChance ?? 0.14))) {
      const type = o.kind || (top - base > 40 ? (R() < 0.5 ? 'hospital' : 'flats') : types[Math.floor(R() * types.length)]);
      rec.loot = type; rec.floors = Math.max(1, Math.round((top - base) / 3.6));
      const L = LOOT_TYPES[type];
      at((x0 + x1) / 2, base + 3.4, fz + fs * 0.32, Math.min(x1 - x0 - 2, 7), 1.1, 0.2, { color: L.col, emissive: 0.85, noShadow: true, solid: false });
      loot.push(rec);
    }
    return rec;
  }
  // (towns and villages) a small building of a random kind
  function building(x0, z0, x1, z1, base, h, dc, kind) {
    const st = h > 40 ? pick(['glass', 'office', 'deco']) : pick(['brick', 'brick', 'office', 'deco']);
    return tower(x0, z0, x1, z1, base, Math.max(h, 7), { style: st, kind, neon: h > 18 && R() < 0.3 });
  }
  const house = (x, y, z, yaw = 0) => {
    const sx = 9, sz = 8, hh = 4 + R() * 2.5, col = HOUSES[Math.floor(R() * HOUSES.length)], rc = ROOFS[Math.floor(R() * ROOFS.length)];
    at(x, y - 0.6, z, sx, hh + 0.6, sz, { color: col, tex: 10 });
    const half = sx / 2 + 0.4, rise = 2.2, sl = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (const sd of [-1, 1]) rot(x + sd * half / 2, y + hh + rise / 2 - 0.15, z, [0, 0, -sd * ang], sl, 0.22, sz + 0.8, { color: rc, shape: 0.05, solid: false });
    at(x + 2.2, y + hh - 0.2, z + 1.5, 0.9, 2.2, 0.9, { color: [0.45, 0.3, 0.25], tex: 13 });          // chimney
    if (R() < 0.5) tree(x + 7, z + 6, 0.9);
  };

  // a line of something between two points (cables, ramps): a box stretched along it
  const seg = (a, b, w, hgt, o) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
    const yaw = Math.atan2(dx, dz), pitch = -Math.asin(dy / L);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2, hx = Math.abs(dx) / 2 + w, hz = Math.abs(dz) / 2 + w, hy = Math.abs(dy) / 2 + hgt;
    const bx = add([mx - hx, my - hy, mz - hz], [mx + hx, my + hy, mz + hz], { solid: false, noBullet: true, ...o });
    bx.scale = [w, hgt, L]; compose(bx.model, [mx, my, mz], [pitch, yaw, 0], bx.scale);
    return bx;
  };
  const jam = (x0, z0, x1, z1, y, n, yawBase) => {
    for (let k = 0; k < n; k++) {
      const t = R(), x = x0 + (x1 - x0) * t + (R() - 0.5) * 3, z = z0 + (z1 - z0) * t + (R() - 0.5) * 3;
      if (R() < 0.18) { rot(x, y, z, [0, yawBase + (R() - 0.5) * 0.4, 0], 2.1, 1.0, 4.6, { color: [0.95, 0.75, 0.08], shape: 0.2, mat: 'paint' }); continue; }   // a cab
      car(x, y, z, yawBase + (R() - 0.5) * 0.6, R() < 0.1);
    }
  };

  // the small cities: a looser grid of towers
  const city = (cx, cz, CR, Y, tallMul) => {
    const lines = [];
    { let p = -CR + 6, n = 0; while (p < CR) { lines.push(p); p += (n % 4 === 3 ? 26 : 14) / 2 + 36 + (n % 4 === 2 ? 26 : 14) / 2; n++; } }
    const sw = (k) => (k % 4 === 3 ? 26 : 14);
    add([cx - CR, Y - 1, cz - CR], [cx + CR, Y + 0.02, cz + CR], { color: [0.17, 0.17, 0.18], tex: 7, noShadow: true });
    ground.town(cx, cz, CR, 40);
    for (let i = 0; i < lines.length - 1; i++) for (let j = 0; j < lines.length - 1; j++) {
      const x0 = cx + lines[i] + sw(i) / 2, x1 = cx + lines[i + 1] - sw(i + 1) / 2, z0 = cz + lines[j] + sw(j) / 2, z1 = cz + lines[j + 1] - sw(j + 1) / 2;
      if (x1 - x0 < 10 || z1 - z0 < 10) continue;
      const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0, dc = Math.hypot(bx - cx, bz - cz) / CR;
      if (dc > 0.98) continue;
      add([x0, Y, z0], [x1, Y + 0.18, z1], { color: [0.5, 0.49, 0.46], tex: 4 });
      const base = Y + 0.18, r = R();
      if (r < 0.1 && dc > 0.2) { for (let t = 0; t < 5; t++) tree(x0 + 3 + R() * (W - 6), z0 + 3 + R() * (D - 6), 0.9); open.push([bx, bz, base]); continue; }
      const tall = 1 - dc, h = 12 + R() * 14 + tall * tall * (40 + R() * 60) * tallMul;
      const parts = R() < 0.55 ? [[x0, z0, bx - 1.5, z1], [bx + 1.5, z0, x1, z1]] : [[x0, z0, x1, z1]];
      for (const [a0, b0, a1, b1] of parts) tower(a0 + 0.5, b0 + 0.5, a1 - 0.5, b1 - 0.5, base, h * (0.8 + R() * 0.4), { style: h > 45 ? pick(['glass', 'office', 'deco']) : pick(['brick', 'office', 'brick']), neon: R() < 0.25 });
      if (R() < 0.5) car(x0 - sw(i) / 2 + (R() < 0.5 ? -3 : 3), Y, bz + (R() - 0.5) * D * 0.7, (R() - 0.5) * 0.6, R() < 0.18);
    }
  };

  // ---- THE CITY: a Manhattan grid. Avenues (20 m) run the length of the island, streets (12 m) cross it.
  // Downtown and Midtown are forests of skyscrapers (up to 300 m), the park is in the middle, walk-ups everywhere else.
  const bridges = [], grids = { a: [[0, 0, 1, 1], [0, 0, 1, 1]], b: [[0, 0, 0, 0], [0, 0, 0, 0]] };
  function metropolis() {
    const Y = cityY, AV = 20, BW = 86, ST = 12, BD = 46, P = BD + ST;
    const nx = 6, nz = Math.floor((2 * IL - ST) / P);
    const zMid = cz + 60, zDown = cz - IL + 300, park = [cz + 380, cz + 820];
    ground.rect(cx, cz, IW, IL, 30);
    // the streets (the park's left as grass)
    const STR = { color: [1, 1, 1], tex: 63, noShadow: true };
    add([cx - IW, Y - 1, cz - IL], [cx + IW, Y + 0.02, park[0] - 6], STR);
    add([cx - IW, Y - 1, park[1] + 6], [cx + IW, Y + 0.02, cz + IL], STR);
    add([cx - IW, Y - 1, park[0] - 6], [cx - IW + BW + AV * 1.5, Y + 0.02, park[1] + 6], STR);
    add([cx + IW - BW - AV * 1.5, Y - 1, park[0] - 6], [cx + IW, Y + 0.02, park[1] + 6], STR);
    grids.a[0] = [cx - IW, cz - IL, BW + AV, P]; grids.b[0] = [AV, ST, 0, 0];
    // the avenue out of the top of the island to the road north
    ground.road(cx - 2, cz + IL - 4, cx - 2, cz + IL + 150); T.road(cx - 2, cz + IL - 4, Y, cx - 2, cz + IL + 150, Y, 7, 20);
    // a promenade with railings, lamps and benches all round the edge, on a stone seawall that drops into the river
    const SW = [0.5, 0.48, 0.44];
    for (const sx of [-1, 1]) {
      at(cx + sx * (IW + 4), Y - 0.6, cz - 4, 8, 0.8, 2 * IL + 8, { color: [0.6, 0.58, 0.54], tex: 4 });
      at(cx + sx * (IW + 9.2), WATER - 12, cz - 6, 2.4, Y + 12.2, 2 * IL + 14, { color: SW, tex: 3 });
      at(cx + sx * (IW + 7.9), Y + 0.2, cz - 4, 0.12, 1.1, 2 * IL + 8, { color: [0.12, 0.13, 0.14], mat: 'metal', solid: false, noShadow: true });
      for (let z = cz - IL + 20; z < cz + IL; z += 30) {
        at(cx + sx * (IW + 7), Y + 0.2, z, 0.16, 4.5, 0.16, { color: [0.13, 0.14, 0.15], mat: 'metal' });
        at(cx + sx * (IW + 6.5), Y + 4.6, z, 1.1, 0.2, 0.35, { color: [1, 0.88, 0.6], emissive: 0.9, noShadow: true, solid: false });
        if ((z / 30) % 2 < 1) at(cx + sx * (IW + 1.2), Y + 0.2, z + 15, 0.6, 0.5, 2.2, { color: [0.35, 0.24, 0.15], tex: 12 });
      }
    }
    at(cx, Y - 0.6, cz - IL - 4, 2 * IW + 16, 0.8, 8, { color: [0.6, 0.58, 0.54], tex: 4 });
    at(cx, WATER - 12, cz - IL - 9.2, 2 * IW + 21, Y + 12.2, 2.4, { color: SW, tex: 3 });
    at(cx, Y + 0.2, cz - IL - 7.9, 2 * IW + 16, 1.1, 0.12, { color: [0.12, 0.13, 0.14], mat: 'metal', solid: false, noShadow: true });
    // the bridges come in here (keep these blocks clear)
    const bz = [cz - IL + 420, cz + 260];
    let spire = null;
    const spireJ = Math.round((zMid - 120 - (cz - IL + ST)) / P), spireI = 3;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x0 = cx - IW + AV + i * (BW + AV), x1 = x0 + BW, z0 = cz - IL + ST + j * P, z1 = z0 + BD;
      const bx = (x0 + x1) / 2, bzz = (z0 + z1) / 2;
      if (z1 > park[0] && z0 < park[1] && i >= 1 && i <= 4) continue;                    // the park
      add([x0, Y, z0], [x1, Y + 0.2, z1], { color: [0.52, 0.51, 0.48], tex: 4 });          // the sidewalk
      const base = Y + 0.2;
      // street furniture: lamps at the corners
      at(x0 + 0.6, base, z0 + 0.6, 0.18, 7, 0.18, { color: [0.15, 0.16, 0.17], mat: 'metal' });
      at(x0 + 0.6, base + 7, z0 + 0.6, 0.6, 0.25, 0.6, { color: [1, 0.85, 0.55], emissive: 0.9, noShadow: true, solid: false });
      if (i === spireI && j === spireJ) { spire = buildSpire({ add, at, R }, bx, bzz, base, BD); continue; }
      if (i === spireI && j === spireJ - 1) { for (let t = 0; t < 6; t++) tree(x0 + 4 + R() * (BW - 8), z0 + 4 + R() * (BD - 8), 0.8); open.push([bx, bzz, base]); continue; }   // a plaza under the pad
      const edge = i === 0 || i === nx - 1;
      if (edge && bz.some((z) => Math.abs(bzz - z) < P * 0.6)) { open.push([bx, bzz, base]); continue; }                   // under a bridge ramp
      const sky = 290 * Math.exp(-(((bzz - zMid) / 230) ** 2)) + 250 * Math.exp(-(((bzz - zDown) / 190) ** 2));
      const avenue = 1 - Math.abs(i - 2.5) / 2.5;
      const timesSq = Math.abs(bzz - (zMid + 160)) < 70 && (i === 2 || i === 3);
      if (R() < 0.04) { car(bx - 20, base, bzz, 0, true); for (let t = 0; t < 8; t++) car(x0 + 6 + R() * (BW - 12), base, z0 + 6 + R() * (BD - 12), R() * 6, R() < 0.2); open.push([bx, bzz, base]); continue; }   // a parking lot
      if (R() < 0.3 + 0.55 * (sky / 290)) {
        // towers: one whole-block tower, or two
        const h = 40 + sky * (0.45 + R() * 0.7) * (0.75 + avenue * 0.35) + R() * 30;
        const st = h > 150 ? pick(['glass', 'glass', 'deco', 'deco', 'office']) : pick(['glass', 'office', 'deco', 'office']);
        if (R() < 0.5) tower(x0 + 1, z0 + 1, x1 - 1, z1 - 1, base, h, { style: st, neon: timesSq || R() < 0.15, billboard: timesSq, lootChance: 0.08 });
        else {
          const mid = x0 + BW * (0.4 + R() * 0.2);
          tower(x0 + 1, z0 + 1, mid - 1.5, z1 - 1, base, h, { style: st, neon: timesSq, billboard: timesSq && R() < 0.6, lootChance: 0.08 });
          tower(mid + 1.5, z0 + 1, x1 - 1, z1 - 1, base, Math.max(25, h * (0.4 + R() * 0.5)), { style: pick(['office', 'brick', 'deco']), neon: timesSq || R() < 0.2, billboard: timesSq, lootChance: 0.1 });
        }
      } else {
        // walk-ups: a row of narrow buildings along each street face, yards behind
        const uptown = bzz > park[1];
        for (const side of [0, 1]) {
          let x = x0 + 0.5;
          while (x < x1 - 6) {
            const w = Math.min(x1 - 0.5 - x, 9 + R() * 9), h = (uptown ? 16 : 14) + R() * (uptown ? 26 : 22);
            const za = side ? z1 - 20 : z0 + 0.5, zb = side ? z1 - 0.5 : z0 + 20;
            tower(x, za, x + w - 0.6, zb, base, h, { style: R() < 0.8 ? 'brick' : pick(['office', 'deco']), front: side ? 'z1' : 'z0', neon: timesSq || R() < 0.1, billboard: timesSq && R() < 0.3, lootChance: 0.07 });
            x += w;
          }
        }
      }
    }
    // traffic: jammed avenues and streets, with the odd burning wreck
    for (let i = 0; i <= nx; i++) { const ax = cx - IW + AV / 2 + i * (BW + AV); for (let k = 0; k < 14; k++) { const z = cz - IL + R() * 2 * IL; if (z > park[0] - 10 && z < park[1] + 10 && i >= 1 && i <= 5) continue; jam(ax - 4, z, ax + 4, z + 30 + R() * 50, Y, 3 + Math.floor(R() * 5), 0); } }
    for (let j = 0; j < nz; j += 2) { const sz = cz - IL + ST / 2 + j * P; jam(cx - IW + R() * 400, sz - 2, cx - IW + R() * 600, sz + 2, Y, 2 + Math.floor(R() * 3), Math.PI / 2); }
    // the park: lawns, lots of trees, a lake and a reservoir (dug into the ground: the sea level water shows through)
    const px0 = cx - IW + AV + (BW + AV), px1 = cx - IW + AV + 4 * (BW + AV) + BW;
    ground.rect((px0 + px1) / 2, (park[0] + park[1]) / 2, (px1 - px0) / 2 - 4, (park[1] - park[0]) / 2 - 4, 4);
    // (undo the town ground in the park so the grass shows)
    { const S = ground.size, D = ground.data, k = ground.span / S;
      for (let j = Math.floor(ground.tx(park[0])); j <= Math.ceil(ground.tx(park[1])); j++) for (let i = Math.floor(ground.tx(px0)); i <= Math.ceil(ground.tx(px1)); i++) { const o = (j * S + i) * 4; D[o + 1] = 0; } }
    const lake = [(px0 + px1) / 2 + 40, park[0] + 300, 70, 55];
    T.rect(lake[0], lake[1], lake[2], lake[3], WATER - 4, 14);
    ground.water(lake[0], lake[1], lake[2] + 6, lake[3] + 6, 4, 12);
    for (let k = 0; k < 260; k++) {
      const x = px0 + 6 + R() * (px1 - px0 - 12), z = park[0] + 6 + R() * (park[1] - park[0] - 12);
      if (Math.abs(x - lake[0]) < lake[2] + 14 && Math.abs(z - lake[1]) < lake[3] + 14) continue;
      tree(x, z, 1 + R() * 0.5);
    }
    open.push([(px0 + px1) / 2, park[0] + 100, Y], [(px0 + px1) / 2 - 60, park[1] - 80, Y]);
    // the bridges: east to the borough, west to the mainland
    bridges.push(bridge(cx + IW + 4, RIV.e[0] + RIV.e[1] + 120, bz[0], Y, 1));
    bridges.push(bridge(cx - IW - 4, RIV.w[0] - RIV.w[1] - 120, bz[1], Y, -1));
    { const x0 = RIV.w[0] - RIV.w[1] - 270; ground.road(x0 + 10, bz[1], x0 - 90, bz[1]); T.road(x0 + 10, bz[1], Y, x0 - 90, bz[1], Y, 7, 18); }
    // piers and the odd ship on the rivers
    for (let k = 0; k < 8; k++) { const sx = k % 2 ? 1 : -1, z = cz - IL + 150 + k * 230; if (bz.some((b) => Math.abs(b - z) < 60)) continue; at(cx + sx * (IW + 30), WATER - 3, z, 50, 4.5, 14, { color: [0.4, 0.38, 0.35], tex: 12 }); }
    for (let k = 0; k < 3; k++) { const sx = k % 2 ? 1 : -1, x = sx > 0 ? RIV.e[0] : RIV.w[0], z = cz - IL - 100 + k * 600; ship(x + (R() - 0.5) * 60, z, R() < 0.5); }
    return spire;
  }
  function ship(x, z, fire) {
    const L = 90, W = 16, col = pick([[0.6, 0.15, 0.12], [0.15, 0.2, 0.3], [0.2, 0.22, 0.24]]);
    at(x, WATER - 4, z, W, 9, L, { color: col, tex: 5, mat: 'paint' });
    rot(x, WATER - 4, z + L / 2 + 4, [Math.PI, 0, 0], W, 9, 10, { color: col, shape: { taper: [0.05, 1] }, mat: 'paint' });
    at(x, WATER + 5, z - L * 0.32, W - 2, 12, 16, { color: [0.85, 0.85, 0.82], tex: 6 });
    at(x, WATER + 17, z - L * 0.32, 4, 8, 4, { color: [0.2, 0.2, 0.22], shape: 'cylY' });
    for (let k = 0; k < 6; k++) at(x + (k % 2 ? -3.4 : 3.4), WATER + 5, z - 10 + Math.floor(k / 2) * 14, 6, 2.6 * (1 + Math.floor(R() * 2)), 12.2, { color: [R(), R() * 0.6, 0.3], tex: 14 });
    if (fire) burning.push([x, WATER + 8, z]);
  }

  // A suspension bridge across a river, along x from xa (island side) to xb, dir = +1 east, -1 west.
  // Ramps climb from the street to the deck, two stone towers with arches stand in the water, the main cables sag between
  // them and hang the deck on suspenders. Jammed with abandoned cars (and, sometimes, people).
  function bridge(xa, xb, z, Y, dir) {
    const D = Y + 26, W = 24, len = Math.abs(xb - xa), sx = Math.sign(xb - xa);
    const X = (t) => xa + sx * t;
    const RAMP = 150;
    const STONE = [0.62, 0.56, 0.48], STEEL = [0.32, 0.34, 0.36];
    // ramps: sloped deck pieces you see, stepped hidden boxes you land on
    const ramp = (x0, x1) => {
      const up = Math.sign(x1 - x0);
      seg([x0, Y + 0.1, z], [x1, D, z], W / 2, 0.6, { color: [0.2, 0.2, 0.21], tex: 7 });
      const n = 12;
      for (let k = 0; k < n; k++) {
        const a = x0 + (x1 - x0) * (k / n), b = x0 + (x1 - x0) * ((k + 1) / n), h = Y + (D - Y) * ((k + 0.5) / n);
        add([Math.min(a, b), Y, z - W / 2], [Math.max(a, b), h, z + W / 2], { hidden: true, color: [0.3, 0.3, 0.3] });
      }
      for (let k = 1; k < 6; k++) at(x0 + (x1 - x0) * (k / 6), Y, z, 5, (D - Y) * (k / 6) - 0.4, W - 6, { color: STONE, tex: 3 });   // arches under the ramp
      void up;
    };
    ramp(X(-RAMP), X(0));
    ramp(xb + sx * RAMP, xb);
    // the deck over the water
    const deck = add([Math.min(X(0), xb), D - 1.2, z - W / 2], [Math.max(X(0), xb), D, z + W / 2], { color: [0.19, 0.19, 0.2], tex: 7, tag: 'deck' });
    for (const s of [-1, 1]) {
      add([Math.min(X(0), xb), D - 3.6, z + s * W / 2 - 0.8], [Math.max(X(0), xb), D + 1.4, z + s * W / 2], { color: STEEL, tex: 5, mat: 'metal', solid: false });   // the stiffening truss
    }
    // towers
    const t1 = 95, t2 = len - 95, TH2 = D + 72;
    for (const tt of [t1, t2]) {
      const tx = X(tt);
      at(tx, WATER - 10, z, 16, D - WATER + 6, W + 12, { color: STONE, tex: 3 });                              // the pier
      for (const s of [-1, 1]) at(tx, D, z + s * (W / 2 + 2), 9, TH2 - D, 6, { color: STONE, tex: 17 });        // the legs
      at(tx, D + 30, z, 9, 6, W + 10, { color: STONE, tex: 3 });                                                 // gothic arch beams
      at(tx, TH2 - 8, z, 9, 8, W + 10, { color: STONE, tex: 3 });
      at(tx, TH2, z, 10, 2, W + 14, { color: STONE.map((v) => v * 0.85), tex: 3 });
      for (const s of [-1, 1]) at(tx, TH2 + 2, z + s * (W / 2 + 2), 2, 4, 2, { color: [1, 0.2, 0.1], emissive: 1, noShadow: true, solid: false });
    }
    // main cables (one each side): anchorage -> tower -> sag -> tower -> anchorage, with suspenders down to the deck
    for (const s of [-1, 1]) {
      const cz2 = z + s * (W / 2 + 2);
      const cy = (t) => {
        if (t <= t1) return D + 3 + (TH2 - D - 3) * (t / t1) ** 1.6;
        if (t >= t2) return D + 3 + (TH2 - D - 3) * ((len - t) / (len - t2)) ** 1.6;
        const u = (t - t1) / (t2 - t1) * 2 - 1;
        return D + 4 + (TH2 - D - 4) * u * u;
      };
      const N = 26;
      for (let k = 0; k < N; k++) {
        const a = (k / N) * len, b = ((k + 1) / N) * len;
        seg([X(a), cy(a), cz2], [X(b), cy(b), cz2], 0.45, 0.45, { color: [0.6, 0.6, 0.58], mat: 'metal' });
      }
      for (let t = 8; t < len - 4; t += 8) {
        if (Math.abs(t - t1) < 6 || Math.abs(t - t2) < 6) continue;
        at(X(t), D, cz2, 0.12, cy(t) - D, 0.12, { color: [0.55, 0.55, 0.55], solid: false, noShadow: true, noBullet: true });
      }
      for (let t = 10; t < len; t += 20) at(X(t), D, z + s * (W / 2 - 1), 0.2, 6, 0.2, { color: [0.15, 0.16, 0.17], mat: 'metal', solid: false }), at(X(t), D + 6, z + s * (W / 2 - 1), 0.6, 0.25, 0.6, { color: [1, 0.85, 0.55], emissive: 0.8, noShadow: true, solid: false });
    }
    // abandoned traffic
    jam(X(10), z - 6, X(len - 10), z - 2, D, 26, Math.PI / 2);
    jam(X(10), z + 2, X(len - 10), z + 6, D, 22, Math.PI / 2);
    const rec = { box: deck, top: D, x: X(len / 2), z, sx: len, sz: W, h: D - WATER, base: WATER, bridge: true, xa: X(0), xb, dir };
    return rec;
  }

  // the borough over the east river: brownstones in long rows, trees on the streets, a few taller buildings
  function borough() {
    const Y = cityY, { x: bx0, z: bz0, rx, rz } = boro;
    add([bx0 - rx, Y - 1, bz0 - rz], [bx0 + rx, Y + 0.02, bz0 + rz], { color: [1, 1, 1], tex: 64, noShadow: true });
    ground.rect(bx0, bz0, rx, rz, 30);
    const BW = 70, BD = 40, AV = 16, ST = 12;
    grids.a[1] = [bx0 - rx, bz0 - rz, BW + AV, BD + ST]; grids.b[1] = [AV, ST, 0, 0];
    for (let x0 = bx0 - rx + AV; x0 + BW < bx0 + rx; x0 += BW + AV) for (let z0 = bz0 - rz + ST; z0 + BD < bz0 + rz; z0 += BD + ST) {
      const x1 = x0 + BW, z1 = z0 + BD;
      if (bridges.some((b) => Math.abs((z0 + z1) / 2 - b.z) < 40 && Math.min(x1, b.xb + b.dir * 175) > Math.max(x0, b.xb - b.dir * 5) - 0 && Math.max(x0, x1) > Math.min(b.xb, b.xb + b.dir * 175) && Math.min(x0, x1) < Math.max(b.xb, b.xb + b.dir * 175))) { open.push([(x0 + x1) / 2, (z0 + z1) / 2, Y]); continue; }
      add([x0, Y, z0], [x1, Y + 0.2, z1], { color: [0.52, 0.51, 0.48], tex: 4 });
      const base = Y + 0.2;
      if (R() < 0.08) { for (let t = 0; t < 7; t++) tree(x0 + 4 + R() * (BW - 8), z0 + 4 + R() * (BD - 8), 1); open.push([(x0 + x1) / 2, (z0 + z1) / 2, base]); continue; }
      if (R() < 0.12) { tower(x0 + 1, z0 + 1, x1 - 1, z1 - 1, base, 30 + R() * 50, { style: pick(['office', 'brick', 'deco']), lootChance: 0.2 }); continue; }
      for (const side of [0, 1]) {
        let x = x0 + 0.5;
        while (x < x1 - 6) {
          const w = Math.min(x1 - 0.5 - x, 7 + R() * 4);
          const za = side ? z1 - 16 : z0 + 0.5, zb = side ? z1 - 0.5 : z0 + 16;
          tower(x, za, x + w - 0.4, zb, base, 12 + R() * 7, { style: R() < 0.7 ? 'brown' : 'brick', front: side ? 'z1' : 'z0', lootChance: 0.05 });
          // the stoop
          at(x + w / 2, base, side ? z1 + 0.2 : z0 - 1.8, 2, 1.2, 2, { color: [0.36, 0.25, 0.18], tex: 3 });
          x += w;
        }
        for (let t = x0 + 6; t < x1; t += 14) tree(t, side ? z1 + 4 : z0 - 4, 0.8);
      }
    }
    for (let k = 0; k < 40; k++) car(bx0 - rx + R() * 2 * rx, Y, bz0 - rz + ST / 2 + Math.floor(R() * 10) * (BD + ST), Math.PI / 2 + (R() - 0.5) * 0.4, R() < 0.1);
  }

  let spire = null;
  const cities = [];
  for (const s of spots) {
    if (s.kind === 'city') { spire = metropolis(); cities.push(s); continue; }
    if (s.kind === 'borough') { borough(); cities.push(s); continue; }
    if (s.kind === 'bridgehead') { ground.town(s.x, s.z, s.r * 0.7, 20); continue; }
    if (s.kind === 'small') { city(s.x, s.z, 150, s.y, 0.35); cities.push(s); continue; }
    const t = s, y = t.y;
    towns.push({ x: t.x, z: t.z, y, r: t.r, kind: t.kind, name: TOWN_NAMES.splice(Math.floor(R() * TOWN_NAMES.length), 1)[0] || 'NOWHERE' });
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
    if (!clear(x, z, 20) || !offRoad(x, z, 14) || wet(x, z, 30)) continue;
    const y = T.heightAt(x, z); T.flatten(x, z, 14, y, 14); ground.town(x, z, 12, 10); gasStation(x, y, z); open.push([x, z, y]); gs++;
  }
  // farms: a barn, a silo and a farmhouse out in the fields
  for (let n = 0, tries = 0; n < 34 && tries < 600; tries++) {
    const x = (R() - 0.5) * 2 * (TH - 300), z = (R() - 0.5) * 2 * (TH - 300);
    if (wet(x, z, 40) || T.forest(x, z) > 0.25 || T.natural(x, z) > 100 || T.natural(x, z) < WATER + 3 || rough(x, z, 30) > 9 || inSpot(x, z, 60) || !offRoad(x, z, 22)) continue;
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
  // telephone poles along the country roads, with the wires sagging between them
  { let carry = 0, prev = null;
    for (const r of roads) {
      const dx = r[2] - r[0], dz = r[3] - r[1], L = Math.hypot(dx, dz);
      if (L < 1) continue;
      const nx = -dz / L, nz = dx / L;
      for (let t = carry; t < L; t += 48) {
        const x = r[0] + dx * (t / L) + nx * 9, z = r[1] + dz * (t / L) + nz * 9;
        if (inSpot(x, z, -20) || wet(x, z, 4)) { prev = null; continue; }
        const y = T.heightAt(x, z);
        at(x, y - 0.5, z, 0.32, 9.5, 0.32, { color: [0.3, 0.23, 0.16], shape: 'cylY', tex: 62 });
        rot(x, y + 8.4, z, [0, Math.atan2(dx, dz) + Math.PI / 2, 0], 2.4, 0.15, 0.15, { color: [0.28, 0.22, 0.16], solid: false });
        if (prev && Math.hypot(prev[0] - x, prev[2] - z) < 70) for (const o of [-0.9, 0.9]) seg([prev[0] + Math.cos(Math.atan2(dx, dz)) * o, prev[1] + 8.5, prev[2] - Math.sin(Math.atan2(dx, dz)) * o], [x + Math.cos(Math.atan2(dx, dz)) * o, y + 8.5, z - Math.sin(Math.atan2(dx, dz)) * o], 0.02, 0.02, { color: [0.08, 0.08, 0.08], noShadow: true });
        prev = [x, y, z];
      }
      carry = 0;
    }
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

  return { world, terrain: T, ground, roofs, burning, open, loot, roads, towns, cities, city: { x: cx, z: cz, r: CITY_R, y: cityY, iw: IW, il: IL }, boro, bridges, grids, spire, fobs: spire ? [spire] : [] };
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
