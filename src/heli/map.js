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
export const HANGAR = [7200, 0, 0];         // the upgrade hangar scene, off the map
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
  school: { n: 'SCHOOL', col: [1, 0.9, 0.4], loot: { survivor: 5, medkit: 1, scrap: 1 }, only: true },
  armory: { n: 'ARMY ARMOURY', col: [0.55, 0.8, 0.3], loot: { weapon: 6, armor: 5, ammo: 6, scrap: 3 }, only: true },
};

// the ground map: what's where on the land, as a texture for the terrain shader (and for placing trees).
//   r = distance to the nearest road (0..16 m), g = town ground, b = how wooded, a = water depth (0..32 m)
export class Ground {
  constructor(T, size = 3072) {
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
    const S = this.size, D = this.data, C = 768, step = this.span / C, T = this.T;
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
    // where we dug rivers and bays: the real depth, read off the finished land
    const S = this.size, D = this.data, k = this.span / S, T = this.T;
    for (const [x, z, rx, rz] of this.wet || []) {
      const i0 = Math.max(0, Math.floor(this.tx(x - rx))), i1 = Math.min(S - 1, Math.ceil(this.tx(x + rx)));
      const j0 = Math.max(0, Math.floor(this.tx(z - rz))), j1 = Math.min(S - 1, Math.ceil(this.tx(z + rz)));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const o = (j * S + i) * 4;
        const h = T.heightAt(this.x0 + (i + 0.5) * k, this.z0 + (j + 0.5) * k);
        if (h >= WATER) continue;
        D[o + 3] = Math.max(D[o + 3], Math.round(Math.min(1, (WATER - h) / 32) * 255)); D[o + 1] = 0; D[o + 2] = 0;
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
  // lowlands round the city (the mountains back off), then the island itself and the docks past its top end
  T.rect(cx, cz + 150, IW + 320, IL + 420, cityY + 5, 650);
  T.rect(cx, cz, IW + 40, IL + 40, cityY, 220);
  T.rect(cx, cz + IL + 185, IW + 20, 165, cityY, 240);                // the docks and yards past the top of the island
  // the rivers: the inner bank is the island's seawall, the outer bank wanders in and out, and past the south end of
  // the island they swing away from each other and wind off across the country like proper rivers (no square moat)
  const BZ = [cz - IL + 420, cz + 260];                                  // where the two bridges cross
  const wob = (a, b) => T.noise(a, b, 3) - 0.5;
  const rivers = [];
  for (const [sx, base] of [[1, 228], [-1, 242]]) {
    const wall = cx + sx * (IW + 6), pts = [];
    for (let z = cz - IL - 320; z <= cz + IL + 40; z += 60) {
      const calm = Math.min(...BZ.map((b) => Math.min(1, Math.abs(z - b) / 160)));
      const hw = base - 12 + wob(sx * 13.7 + z / 300, 4.1) * 110 * calm;
      pts.push([wall + sx * hw, z, hw]);
    }
    // swing away from the island, then meander, getting narrower, until the hills at the edge of the world
    let [x, z, hw] = pts[pts.length - 1], a = Math.atan2(1, sx * 0.25);
    const aim = Math.atan2(1, sx * 1.1);
    for (let k = 0; k < 70; k++) {
      a += (aim - a) * 0.1 + wob(k * 0.29 + sx * 40, 7.7) * 0.85;
      hw = Math.max(42, hw * 0.93);
      x += Math.cos(a) * 70; z += Math.sin(a) * 70;
      if (Math.abs(x) > TH - 260 || Math.abs(z) > TH - 260) break;
      pts.push([x, z, hw]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az, ra] = pts[i], [bx, bz, rb] = pts[i + 1];
      T.channel(ax, az, bx, bz, ra, rb, WATER - 11, WATER - 1.2, 34);
      ground.water((ax + bx) / 2, (az + bz) / 2, Math.abs(bx - ax) / 2 + Math.max(ra, rb) + 10, Math.abs(bz - az) / 2 + Math.max(ra, rb) + 10, 10);
    }
    rivers.push(pts);
  }
  // the harbour at the north end: a ragged bay made of overlapping round bites
  const bay = [];
  for (let k = 0; k < 11; k++) {
    const x = cx - 1000 + k * 200 + (R() - 0.5) * 70, z = cz - IL - 300 - Math.abs(k - 5) * 22 + (R() - 0.5) * 120, r = 190 + R() * 140;
    bay.push([x, z, r]);
    T.disc(x, z, r, WATER - 12, 70);
    ground.water(x, z, r + 30, r + 30, 12);
  }
  for (let k = 0; k < 14; k++) {
    // little coves round the rim so the shore isn't a row of circles
    const [bx, bz, br] = bay[Math.floor(R() * bay.length)], a = -Math.PI * R(), r = 50 + R() * 90;
    const x = bx + Math.cos(a) * br * 0.95, z = bz + Math.sin(a) * br * 0.95;
    if (Math.abs(x - cx) < IW + 80 && z > cz - IL - 120) continue;
    T.disc(x, z, r, WATER - 6, 40);
    ground.water(x, z, r + 30, r + 30, 6);
  }
  // put the island's straight seawall sides back (the rivers' banks blend into them), and dry ground for the borough
  T.rect(cx, cz - 3, IW + 6, IL + 3, cityY, 1);
  const boro = { x: RIV.e[0] + RIV.e[1] + 360, z: cz - 360, rx: 300, rz: 380 };
  T.rect(boro.x, boro.z, boro.rx + 30, boro.rz + 30, cityY, 160);
  const westEnd = { x: RIV.w[0] - RIV.w[1] - 200, z: cz + 260 };
  T.rect(westEnd.x, westEnd.z, 170, 50, cityY, 90);
  spots.push({ x: cx, z: cz, r: IL + 120, kind: 'city', y: cityY });
  spots.push({ x: cx, z: cz + IL + 185, r: 240, kind: 'port', y: cityY });
  spots.push({ x: boro.x, z: boro.z, r: 470, kind: 'borough', y: cityY });
  spots.push({ x: westEnd.x, z: westEnd.z, r: 120, kind: 'bridgehead', y: cityY });
  spots.push({ x: cx, z: cz + IL + 120, r: 60, kind: 'bridgehead', y: cityY });
  // two small cities further out
  for (let n = 0; n < 4; n++) {
    let b = null;
    for (let tries = 0; tries < 16 && !b; tries++) {
      b = best(50, () => { const a = (n * Math.PI * 2 / 4) + (R() - 0.5) * 1.3, d = 1800 + R() * 2600; return [cx + Math.cos(a) * d, cz + Math.sin(a) * d, 250]; });
      if (b && (!free(b[0], b[1], 250, 400) || b[2] > 50)) b = null;
    }
    if (!b) continue;
    const y = flatTarget(b[0], b[1]);
    T.flatten(b[0], b[1], 275, y, 150);
    spots.push({ x: b[0], z: b[1], r: 260, kind: 'small', y });
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
  // FORT CALDER: the old army base, far out on flat ground. Overrun. Take it back and it's a second base.
  { let b = null;
    for (let tries = 0; tries < 8 && !b; tries++) {
      b = best(60, () => { const a = R() * Math.PI * 2, d = 2000 + R() * 1500; return [cx + Math.cos(a) * d, cz + Math.sin(a) * d, 140]; });
      if (b && (!free(b[0], b[1], 140, 250) || b[2] > (tries > 4 ? 70 : 40))) b = null;
    }
    if (b) { const y = flatTarget(b[0], b[1]); T.flatten(b[0], b[1], 150, y, 120); spots.push({ x: b[0], z: b[1], r: 140, kind: 'fort', y }); }
  }
  // THE AIRFIELD: a long runway (east-west) on the flattest ground round the city, for the planes
  { let bestA = null, bs = Infinity;
    for (let t = 0; t < 400; t++) {
      const a = Math.random() * 0 + R() * Math.PI * 2, d = 1300 + R() * 1900, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!free(x, z, 480, 120)) continue;
      let lo = Infinity, hi = -Infinity, wetN = 0;
      for (let i = -8; i <= 8; i++) for (const dz of [-90, 0, 90]) { const h = T.natural(x + i * 56, z + dz); lo = Math.min(lo, h); hi = Math.max(hi, h); if (h < WATER + 2) wetN++; }
      const sc = hi - lo + wetN * 50;
      if (sc < bs) { bs = sc; bestA = [x, z]; }
    }
    if (bestA) {
      const [x, z] = bestA; let sum = 0; for (let i = -8; i <= 8; i++) sum += T.natural(x + i * 56, z);
      const y = Math.max(WATER + 6, sum / 17);
      T.rect(x, z + 40, 480, 170, y, 160);
      spots.push({ x, z, r: 500, kind: 'airfield', y });
    }
  }
  // ST MARY'S: a big hospital out of town, where everyone went when it started
  { let b = null;
    for (let tries = 0; tries < 24 && !b; tries++) {
      b = best(40, () => { const a = R() * Math.PI * 2, d = 1100 + R() * 1600; return [cx + Math.cos(a) * d, cz + Math.sin(a) * d, 80]; });
      if (b && (!free(b[0], b[1], 80, tries > 12 ? 100 : 200) || b[2] > (tries > 12 ? 60 : 40))) b = null;
    }
    if (b) { const y = flatTarget(b[0], b[1]); T.flatten(b[0], b[1], 90, y, 80); spots.push({ x: b[0], z: b[1], r: 80, kind: 'hospital', y }); }
  }
  // HALDEN BIOLAB, where the giants were made, and the three places they made their own
  { const far = (b, d) => spots.every((q) => !['lab', 'quarry', 'chem', 'nest'].includes(q.kind) || Math.hypot(q.x - b[0], q.z - b[1]) > d);
    for (const [kind, r, d0, d1] of [['lab', 110, 1600, 3000], ['quarry', 95, 1800, 3800], ['chem', 90, 1800, 3800], ['nest', 70, 1800, 3800]]) {
      let b = null;
      for (let tries = 0; tries < 30 && !b; tries++) {
        b = best(30, () => { const a = R() * Math.PI * 2, d = d0 + R() * (d1 - d0); return [cx + Math.cos(a) * d, cz + Math.sin(a) * d, r]; });
        if (b && (!free(b[0], b[1], r, tries > 15 ? 80 : 200) || !far(b, tries > 20 ? 700 : 1300) || b[2] > (tries > 15 ? 70 : 40))) b = null;
      }
      if (!b) continue;
      const y = flatTarget(b[0], b[1]);
      if (kind === 'quarry') { T.flatten(b[0], b[1], r + 30, y + 4, 60); T.flatten(b[0], b[1], 62, y - 12, 22); }
      else T.flatten(b[0], b[1], r, y, r * 0.8);
      spots.push({ x: b[0], z: b[1], r, kind, y: kind === 'quarry' ? y - 12 : y });
    }
  }
  // three radio masts up on the high ground, spread out
  { const masts = [];
    for (let tries = 0; tries < 4000 && masts.length < 3; tries++) {
      // the longer it takes to find a hilltop, the less fussy it gets
      const lax = Math.min(3, Math.floor(tries / 700));
      const x = (R() - 0.5) * 2 * (TH - 700), z = (R() - 0.5) * 2 * (TH - 700), h = T.natural(x, z);
      if (h < 70 - lax * 15 || h > 190 || rough(x, z, 14) > 14 + lax * 6 || masts.some((m) => Math.hypot(m.x - x, m.z - z) < 2200 - lax * 400) || !free(x, z, 20, 120 - lax * 30)) continue;
      masts.push({ x, z }); T.flatten(x, z, 16, h, 18);
      spots.push({ x, z, r: 20, kind: 'mast', y: h });
    }
  }
  place(20, 112, 440, 'town');
  place(38, 64, 280, 'village');
  for (const q of spots) if (q.kind === 'village') q.axis = R() < 0.5 ? 0 : 1;

  // ---- roads: join everything up (a spanning tree, plus a few loops), each one winding round the hills
  const LAIR = new Set(['quarry', 'chem', 'nest']);
  const nodes = spots.filter((s) => s.kind !== 'city' && s.kind !== 'mast' && !LAIR.has(s.kind)).map((s, i) => ({ ...s, i }));
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
  const inSpot = (x, z, m = 0) => spots.find((s) => Math.hypot(s.x - x, s.z - z) < s.r * (LAIR.has(s.kind) ? 1.3 : 0.85) + m);
  // towns and villages: a road leaves along one of their own streets (so it lines up with the houses), not at any angle
  const streetDir = (S, ang) => {
    if (S.kind !== 'town' && S.kind !== 'village' && S.kind !== 'small') return ang;
    const opts = S.kind !== 'village' ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : S.axis ? [Math.PI / 2, -Math.PI / 2] : [0, Math.PI];
    let best = opts[0], bd = 9;
    for (const o of opts) { const d = Math.abs(((o - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (d < bd) { bd = d; best = o; } }
    return best;
  };
  const streetEnd = (S) => (S.kind === 'town' || S.kind === 'village' ? S.r * 0.98 : S.kind === 'small' ? S.r * 1.05 : S.r * 0.8);
  const route = (A, B) => {
    // start and finish at the edge of each place, then step across the land, picking the gentlest way that still heads there
    const ang = Math.atan2(B.z - A.z, B.x - A.x), aOut = streetDir(A, ang), aIn = streetDir(B, ang + Math.PI);
    let x = A.x + Math.cos(aOut) * streetEnd(A), z = A.z + Math.sin(aOut) * streetEnd(A);
    const ex = B.x + Math.cos(aIn) * streetEnd(B), ez = B.z + Math.sin(aIn) * streetEnd(B);
    const pts = [[A.x, A.z], [x, z]];
    // a short straight bit out of town before it starts winding
    if (aOut !== ang) { x += Math.cos(aOut) * 40; z += Math.sin(aOut) * 40; pts.push([x, z]); }
    let heading = aOut;
    for (let s = 0; s < 120; s++) {
      const d = Math.hypot(ex - x, ez - z);
      if (d < 70) break;
      // coming into a town or village: line up with its street first
      if (aIn !== ang + Math.PI && d < 160) { pts.push([ex + Math.cos(aIn) * 40, ez + Math.sin(aIn) * 40]); break; }
      const want = Math.atan2(ez - z, ex - x), h0 = T.natural(x, z);
      let bc = Infinity, bh = want;
      for (let k = -5; k <= 5; k++) {
        const a = want + k * 0.13, nx = x + Math.cos(a) * 55, nz = z + Math.sin(a) * 55, h = Math.min(T.natural(nx, nz), T.heightAt(nx, nz));
        const turn = Math.abs(((a - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const c = Math.abs(h - h0) * 2.2 + Math.abs(k) * 1.2 + turn * 8 + (h < WATER + 1 ? 140 : 0) + (h > 120 ? 40 : 0) + (inSpot(nx, nz, 15) && inSpot(nx, nz, 15) !== B && inSpot(nx, nz, 15) !== A ? (LAIR.has(inSpot(nx, nz, 15).kind) || inSpot(nx, nz, 15).kind === 'town' || inSpot(nx, nz, 15).kind === 'village' ? 400 : 60) : 0);
        if (c < bc) { bc = c; bh = a; }
      }
      heading = bh; x += Math.cos(bh) * 55; z += Math.sin(bh) * 55;
      pts.push([x, z]);
    }
    pts.push([ex, ez], [B.x, B.z]);
    // smooth the bends
    const fixed = (i) => i <= 2 || i >= pts.length - 3;
    for (let it = 0; it < 2; it++) for (let i = 2; i < pts.length - 2; i++) if (!fixed(i)) { pts[i][0] = (pts[i - 1][0] + pts[i][0] * 2 + pts[i + 1][0]) / 4; pts[i][1] = (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4; }
    // heights: follow the land but never steeper than about 1 in 9; held up out of the water (a causeway)
    // heights: the ground as it really is now (towns and farms are flattened), smoothed a little, but never far above
    // or below it, so the road sits on the land instead of riding along on a bank
    const inA = (px, pz) => Math.hypot(px - A.x, pz - A.z) < A.r * 1.02, inB = (px, pz) => Math.hypot(px - B.x, pz - B.z) < B.r * 1.02;
    const gr = pts.map(([px, pz], i) => (i === 0 || inA(px, pz) ? A.y : i === pts.length - 1 || inB(px, pz) ? B.y : Math.max(WATER + 1.6, T.heightAt(px, pz))));
    const lock = pts.map(([px, pz], i) => i === 0 || i === pts.length - 1 || inA(px, pz) || inB(px, pz));
    const hs = gr.slice();
    for (let it = 0; it < 3; it++) for (let i = 1; i < hs.length - 1; i++) if (!lock[i]) hs[i] = Math.max(WATER + 1.6, (hs[i - 1] + hs[i] * 2 + hs[i + 1]) / 4);
    for (let i = 0; i < hs.length; i++) if (!lock[i]) hs[i] = Math.max(gr[i] - 2.5, Math.min(gr[i] + 2, hs[i]));
    // over water the road goes on a bridge (a deck on piers), not a dam across the river
    const DECK = WATER + 6.5;
    const wetPt = pts.map(([px, pz], i) => i > 0 && i < pts.length - 1 && Math.min(T.heightAt(px, pz), T.natural(px, pz)) < WATER + 0.6);
    const wetSeg = (i) => { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; for (let f = 0.1; f < 1; f += 0.2) if (Math.min(T.heightAt(ax + (bx - ax) * f, az + (bz - az) * f), T.natural(ax + (bx - ax) * f, az + (bz - az) * f)) < WATER + 0.3) return true; return false; };
    const bridgeSeg = pts.slice(0, -1).map((_, i) => wetSeg(i));
    for (let i = 0; i < pts.length; i++) if (wetPt[i] || bridgeSeg[i] || (i > 0 && bridgeSeg[i - 1])) hs[i] = DECK;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      roads.push([ax, az, bx, bz, hs[i], hs[i + 1]]);
      if (bridgeSeg[i]) { roadBridge(ax, az, bx, bz, DECK); continue; }
      T.road(ax, az, hs[i], bx, bz, hs[i + 1], 5.5, 15);
      ground.road(ax, az, bx, bz);
    }
    return { pts, hs };
  };
  // a plain road bridge: concrete deck with railings and a pier every 30 m
  function roadBridge(ax, az, bx, bz, Y) {
    const L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    rot(mx, Y - 1.3, mz, [0, yaw, 0], 12.5, 1.3, L + 1.5, { color: [0.24, 0.24, 0.25], tex: 7 });
    rot(mx, Y - 2.4, mz, [0, yaw, 0], 9, 1.1, L + 1.5, { color: [0.55, 0.54, 0.5], tex: 3, solid: false });
    for (const side of [-1, 1]) rot(mx + uz * side * 6.1, Y, mz - ux * side * 6.1, [0, yaw, 0], 0.4, 1.1, L + 1.5, { color: [0.62, 0.61, 0.57], tex: 3 });
    for (let t = 15; t < L; t += 30) {
      const px = ax + ux * t, pz = az + uz * t, gy = Math.min(T.heightAt(px, pz), WATER - 1);
      at(px, gy - 2, pz, 3.2, Y - 2.4 - gy + 2, 3.2, { color: [0.5, 0.49, 0.46], tex: 3, shape: 'cylY' });
    }
  }
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
    const types = Object.keys(LOOT_TYPES).filter((k) => !LOOT_TYPES[k].only);
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
  // a house facing `yaw` (its front door is on its local -z side): walls, a gabled roof, door, windows, chimney, sometimes a garage
  const house = (x, y, z, yaw = 0) => {
    const sx = 9 + Math.floor(R() * 2) * 2, sz = 8, hh = 4 + R() * 2.5, col = HOUSES[Math.floor(R() * HOUSES.length)], rc = ROOFS[Math.floor(R() * ROOFS.length)];
    const c = Math.cos(yaw), s2 = Math.sin(yaw), W = (lx, lz) => [x + lx * c + lz * s2, z - lx * s2 + lz * c];
    rot(x, y - 0.6, z, [0, yaw, 0], sx, hh + 0.6, sz, { color: col, tex: 10 });
    const half = sx / 2 + 0.4, rise = 2.2 + sx * 0.05, sl = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (const sd of [-1, 1]) { const [px, pz] = W(sd * half / 2, 0); rot(px, y + hh + rise / 2 - 0.15, pz, [0, yaw, -sd * ang], sl, 0.22, sz + 0.8, { color: rc, shape: 0.05, solid: false }); }
    for (const sd of [-1, 1]) { const [px, pz] = W(sd * (sx / 2 - 0.05), 0); rot(px, y + hh - 0.1, pz, [0, yaw, 0], 0.12, rise * 0.95, sz * 0.2, { color: col, solid: false, noShadow: true }); }
    const [dx, dz] = W(-sx * 0.15, -sz / 2 - 0.04); rot(dx, y, dz, [0, yaw, 0], 1.2, 2.2, 0.1, { color: [0.35, 0.22, 0.14], solid: false, noShadow: true });
    for (const lx of [-sx * 0.36, sx * 0.2]) { const [wx, wz] = W(lx, -sz / 2 - 0.04); rot(wx, y + 1.1, wz, [0, yaw, 0], 1.6, 1.3, 0.08, { color: [0.2, 0.26, 0.3], mat: 'glass', solid: false, noShadow: true }); }
    const [cx2, cz2] = W(sx * 0.25, 1.5); at(cx2, y + hh - 0.2, cz2, 0.9, 2.2, 0.9, { color: [0.45, 0.3, 0.25], tex: 13 });   // chimney
    if (R() < 0.3) { const [gx, gz] = W(sx / 2 + 2.6, 0.5); rot(gx, y - 0.3, gz, [0, yaw, 0], 4.2, 3, 6, { color: col.map((v) => v * 0.9), tex: 10 }); }
    else if (R() < 0.5) { const [tx, tz] = W(sx / 2 + 3, sz / 2 + 2); tree(tx, tz, 0.9); }
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
  // a small city: a proper street grid (avenues one way, streets the other, painted by the street shader), blocks with
  // pavements, the tallest buildings in the middle; the grid stops in a rough circle so it doesn't look stamped out
  const city = (cx, cz, CR, Y, tallMul) => {
    const gi = 2 + Math.min(1, smallN++), AV = 18, ST = 12, BW = 52, BD = 40, PX = BW + AV, PZ = BD + ST;
    const x0 = cx - Math.round(CR / PX) * PX - AV / 2, z0 = cz - Math.round(CR / PZ) * PZ - ST / 2;
    grids.a[gi] = [x0, z0, PX, PZ]; grids.b[gi] = [AV, ST, 0, 0];
    const keep = [];
    for (let x = x0 + AV; x + BW < cx + CR + PX; x += PX) for (let z = z0 + ST; z + BD < cz + CR + PZ; z += PZ) {
      const bx = x + BW / 2, bz = z + BD / 2, dc = Math.hypot(bx - cx, (bz - cz) * 1.1) / CR + (T.noise(bx / 90, bz / 90, 2) - 0.5) * 0.35;
      if (dc < 1) keep.push([x, z, bx, bz, dc]);
    }
    // street tarmac under each block and its half of the streets round it, then town ground fading out
    for (const [x, z] of keep) add([x - AV - 0.5, Y - 1, z - ST - 0.5], [x + BW + AV + 0.5, Y + 0.02, z + BD + ST + 0.5], { color: [1, 1, 1], tex: 64 + gi, noShadow: true });
    ground.town(cx, cz, CR * 0.95, 60);
    for (const [x, z, bx, bz, dc] of keep) {
      const x1 = x + BW, z1 = z + BD;
      add([x, Y, z], [x1, Y + 0.18, z1], { color: [0.52, 0.51, 0.48], tex: 4 });
      const base = Y + 0.18, r = R();
      if (r < 0.09 && dc > 0.25) { for (let t = 0; t < 6; t++) tree(x + 4 + R() * (BW - 8), z + 4 + R() * (BD - 8), 0.9); open.push([bx, bz, base]); continue; }
      if (r < 0.15 && dc > 0.5) {
        // a car park
        for (let c = 0; c < 10; c++) car(x + 5 + (c % 5) * 10, base, z + (c < 5 ? 8 : BD - 8), (c < 5 ? 0 : Math.PI) + (R() - 0.5) * 0.2, R() < 0.12);
        open.push([bx, bz, base]); continue;
      }
      const tall = Math.max(0, 1 - dc), h = 10 + R() * 12 + tall * tall * (40 + R() * 70) * tallMul;
      // split the block into 1-3 buildings along its length
      const n = h > 45 ? 1 : 1 + Math.floor(R() * 3);
      let a = x + 0.6;
      for (let q = 0; q < n; q++) {
        const b = q === n - 1 ? x1 - 0.6 : a + (BW - 1.2) / n * (0.8 + R() * 0.4);
        const hh = n === 1 ? h : h * (0.75 + R() * 0.5);
        tower(a, z + 0.6, b - 0.8, z1 - 0.6, base, hh, { style: hh > 45 ? pick(['glass', 'office', 'deco']) : pick(['brick', 'office', 'brick', 'brown']), neon: R() < 0.2 });
        a = b;
      }
      for (let t = x + 5; t < x1; t += 12) { tree(t, z - 2.2, 0.6); tree(t, z1 + 2.2, 0.6); }
      if (R() < 0.6) car(x - AV / 2 + (R() < 0.5 ? -3 : 3), Y, bz + (R() - 0.5) * BD * 0.7, (R() < 0.5 ? 0 : Math.PI) + (R() - 0.5) * 0.3, R() < 0.15);
      if (R() < 0.4) car(bx + (R() - 0.5) * BW * 0.7, Y, z - ST / 2 + (R() < 0.5 ? -2.5 : 2.5), Math.PI / 2 + (R() - 0.5) * 0.3, R() < 0.15);
    }
  };

  // ---- THE CITY: a Manhattan grid. Avenues (20 m) run the length of the island, streets (12 m) cross it.
  // Downtown and Midtown are forests of skyscrapers (up to 300 m), the park is in the middle, walk-ups everywhere else.
  const bridges = [], grids = { a: [[0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 1, 1]], b: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] };
  let smallN = 0, cityPark = null;
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
    const bz = BZ;
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
      if (i === spireI && j === spireJ - 1) { for (let t = 0; t < 6; t++) tree(x0 + 4 + R() * (BW - 8), z0 + 4 + R() * (BD - 8), 0.8); continue; }   // a plaza under the deck
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
    cityPark = [px0, park[0], px1, park[1]];
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
    waterfront(Y, bz);
    port(Y);
    for (let k = 0; k < 3; k++) { const sx = k % 2 ? 1 : -1, x = sx > 0 ? RIV.e[0] : RIV.w[0], z = cz - IL - 100 + k * 600; ship(x + (R() - 0.5) * 60, z, R() < 0.5); }
    return spire;
  }
  // ---- the island's edge: a granite cap and a slimy waterline on the seawall, bollards, ladders, trees on the
  // promenade, and proper piers sticking out into the rivers (sheds, a park, boats tied up alongside)
  function waterfront(Y, bz) {
    for (const sx of [-1, 1]) {
      at(cx + sx * (IW + 9.2), Y + 0.15, cz - 6, 2.8, 0.35, 2 * IL + 14, { color: [0.68, 0.66, 0.62], tex: 3 });
      at(cx + sx * (IW + 10.45), WATER - 1.4, cz - 6, 0.14, 2.2, 2 * IL + 14, { color: [0.14, 0.17, 0.11], solid: false, noShadow: true });
      for (let z = cz - IL + 12; z < cz + IL - 4; z += 15) {
        if (bz.some((b) => Math.abs(b - z) < 18)) continue;
        const k = Math.round((z - cz) / 15);
        if (k % 2 === 0) at(cx + sx * (IW + 9.4), Y + 0.5, z, 0.45, 0.7, 0.45, { color: [0.14, 0.14, 0.15], shape: 'cylY', mat: 'metal' });
        if (k % 4 === 1) at(cx + sx * (IW + 10.55), WATER - 1, z, 0.12, Y - WATER + 1.4, 0.7, { color: [0.16, 0.17, 0.18], mat: 'metal', solid: false });
        if (k % 2 === 1) tree(cx + sx * (IW + 4), z, 0.75);
      }
    }
    // the piers
    for (let k = 0; k < 16; k++) {
      const sx = k % 2 ? 1 : -1, z = cz - IL + 110 + Math.floor(k / 2) * 255 + (k % 2) * 120;
      if (z > cz + IL - 210 || bz.some((b) => Math.abs(b - z) < 95)) continue;
      const L = 70 + R() * 45, W = 16 + R() * 10, x0 = cx + sx * (IW + 10.4), xm = x0 + sx * L / 2;
      at(xm, Y - 1.4, z, L, 1.6, W, { color: [0.55, 0.53, 0.5], tex: 3 });
      for (let t = 8; t < L; t += 11) for (const sd of [-1, 1]) at(x0 + sx * t, WATER - 6, z + sd * (W / 2 - 1), 0.9, Y - 1.4 - WATER + 6, 0.9, { color: [0.22, 0.2, 0.17], shape: 'cylY' });
      for (const sd of [-1, 1]) at(xm, Y + 0.2, z + sd * (W / 2 - 0.15), L, 1.0, 0.1, { color: [0.12, 0.13, 0.14], mat: 'metal', solid: false, noShadow: true });
      const kind = R();
      if (kind < 0.5) {
        // a pier shed: a long tin warehouse with a pitched roof and big doors at the river end
        const sl = L - 12, sw = W - 4, sh = 7 + R() * 3, col = pick([[0.55, 0.6, 0.62], [0.62, 0.5, 0.4], [0.5, 0.55, 0.45], [0.7, 0.68, 0.6]]);
        const shed = at(xm + sx * 3, Y + 0.2, z, sl, sh, sw, { color: col, tex: 5, mat: 'metal' });
        const half = sw / 2 + 0.4, rise = 2.4, sln = Math.hypot(half, rise), ang = Math.atan2(rise, half);
        for (const sd of [-1, 1]) rot(xm + sx * 3, Y + 0.2 + sh + rise / 2 - 0.12, z + sd * half / 2, [sd * ang, 0, 0], sl + 0.8, 0.22, sln, { color: col.map((v) => v * 0.7), tex: 5, shape: 0.03, solid: false });
        at(x0 + sx * (L - 3.2), Y + 0.2, z, 0.3, sh * 0.72, sw * 0.5, { color: [0.12, 0.12, 0.13], solid: false });
        roofs.push({ box: shed, top: Y + 0.2 + sh, x: xm + sx * 3, z, sx: sl, sz: sw, h: sh, base: Y + 0.2 });
      } else if (kind < 0.78) {
        // a park on the pier: lawn, trees, benches
        at(xm, Y + 0.2, z, L - 6, 0.12, W - 4, { color: [0.2, 0.29, 0.13], tex: 61, solid: false, noShadow: true });
        for (let t = 0; t < 8; t++) tree(x0 + sx * (6 + R() * (L - 12)), z + (R() - 0.5) * (W - 6), 0.8);
        open.push([xm, z, Y + 0.2]);
      } else {
        for (let t = 0; t < 5; t++) car(x0 + sx * (8 + t * 9), Y + 0.2, z + (R() - 0.5) * 4, Math.PI / 2, R() < 0.1);
        open.push([xm + sx * 15, z, Y + 0.2]);
      }
      // a boat tied up alongside
      if (R() < 0.6) boat(xm + sx * (R() - 0.5) * L * 0.5, z + (R() < 0.5 ? -1 : 1) * (W / 2 + 4));
    }
  }
  function boat(x, z) {
    const col = pick([[0.85, 0.85, 0.82], [0.2, 0.3, 0.45], [0.6, 0.15, 0.12]]), L = 12 + R() * 8;
    at(x, WATER - 1, z, L, 2.4, 4, { color: col, shape: 0.5, mat: 'paint' });
    at(x - L * 0.1, WATER + 1.4, z, L * 0.4, 1.8, 3, { color: [0.9, 0.9, 0.88], tex: 6 });
    at(x - L * 0.1, WATER + 3.2, z, L * 0.3, 0.15, 2.6, { color: [0.2, 0.2, 0.22] });
  }
  // ---- the docks past the top of the island: container cranes on the river, stacks of containers, warehouses with
  // saw-tooth roofs, oil tanks and a rail yard, so the city doesn't just stop at a field
  function port(Y) {
    const z0 = cz + IL + 30, z1 = cz + IL + 330, xw = cx - IW + 12, xe = cx + IW - 12;
    ground.rect(cx, (z0 + z1) / 2, IW - 10, (z1 - z0) / 2, 25);
    const TAR = { color: [0.3, 0.3, 0.31], tex: 7, noShadow: true };
    add([xw - 10, Y - 1, z0 - 20], [cx - 14, Y + 0.03, z1], TAR);
    add([cx + 10, Y - 1, z0 - 20], [xe + 10, Y + 0.03, z1], TAR);
    const CON = [[0.75, 0.2, 0.15], [0.15, 0.35, 0.6], [0.2, 0.5, 0.3], [0.85, 0.6, 0.15], [0.55, 0.55, 0.55], [0.85, 0.85, 0.82], [0.4, 0.2, 0.35]];
    // the container yard (west), rows of stacks one to four high
    for (let z = z0 + 6; z < z0 + 170; z += 9) for (let x = xw + 8; x < cx - 30; x += 15) {
      if (R() < 0.18) continue;
      const n = 1 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) at(x, Y + k * 2.6, z, 12.2, 2.6, 2.5, { color: pick(CON), tex: 14 });
    }
    // the rail yard (west, further up): tracks and lines of box cars
    for (let r = 0; r < 5; r++) {
      const z = z0 + 195 + r * 9;
      for (const d of [-0.75, 0.75]) at((xw + cx - 20) / 2, Y + 0.03, z + d, cx - 20 - xw, 0.12, 0.1, { color: [0.35, 0.33, 0.3], mat: 'metal', solid: false, noShadow: true });
      let x = xw + 5 + R() * 20;
      while (x < cx - 40) { if (R() < 0.7) { at(x + 7, Y + 0.6, z, 14, 3.6, 3, { color: pick(CON).map((v) => v * 0.8), tex: 14 }); } x += 16; }
    }
    // warehouses (east): long sheds with saw-tooth roofs and loading doors
    for (let z = z0 + 6; z < z0 + 230;) {
      const d = 28 + R() * 20, w = Math.min(xe - cx - 26, 60 + R() * 40), x = cx + 18 + R() * 6, h = 9 + R() * 5;
      const col = pick([[0.62, 0.6, 0.55], [0.5, 0.52, 0.55], [0.6, 0.45, 0.35], [0.45, 0.5, 0.45]]);
      const b = add([x, Y, z], [x + w, Y + h, z + d], { color: col, tex: 5, mat: 'metal' });
      for (let t = 0; t < w - 4; t += 8) rot(x + t + 4, Y + h + 1.2, z + d / 2, [0, 0, -0.5], 8.8, 0.25, d, { color: col.map((v) => v * 0.75), tex: 5, solid: false });
      for (let t = 6; t < w - 6; t += 12) at(x + t, Y, z - 0.15, 5, 5, 0.3, { color: [0.2, 0.2, 0.22], solid: false });
      roofs.push({ box: b, top: Y + h, x: x + w / 2, z: z + d / 2, sx: w, sz: d, h, base: Y });
      z += d + 14;
    }
    // oil tanks
    for (let k = 0; k < 4; k++) {
      const x = cx + 35 + (k % 2) * 34, z = z0 + 255 + Math.floor(k / 2) * 32;
      at(x, Y, z, 24, 13, 24, { color: [0.86, 0.85, 0.82], shape: 'cylY', mat: 'paint' });
      at(x, Y + 13, z, 24.4, 0.6, 24.4, { color: [0.6, 0.6, 0.6], shape: 'cylY', mat: 'metal' });
    }
    // container cranes on both river edges, their booms out over the water
    for (const sx of [-1, 1]) for (const z of [cz + IL - 90, cz + IL - 170]) {
      const x = cx + sx * (IW + 4.5), col = sx > 0 ? [0.85, 0.32, 0.12] : [0.2, 0.42, 0.7];
      for (const lx of [-5.5, 5.5]) for (const lz of [-9, 9]) at(x + lx, Y, z + lz, 1.4, 38, 1.4, { color: col, mat: 'paint' });
      for (const lz of [-9, 9]) at(x + sx * 14, Y + 34, z + lz, 50 + 16, 2.2, 1.4, { color: col, mat: 'paint', solid: false });
      at(x - sx * 2, Y + 36, z, 10, 5, 8, { color: col.map((v) => v * 0.8), mat: 'paint' });
      for (const lx of [-5.5, 5.5]) at(x + lx, Y + 18, z, 1, 1.2, 18, { color: col, mat: 'paint', solid: false });
      seg([x - sx * 6, Y + 38, z], [x + sx * 4, Y + 52, z], 0.5, 0.5, { color: col });
      seg([x + sx * 4, Y + 52, z], [x + sx * 44, Y + 36.5, z], 0.25, 0.25, { color: [0.3, 0.3, 0.3] });
      at(x + sx * 25, Y + 6, z, 12.2, 2.6, 2.5, { color: pick(CON), tex: 14, solid: false });
      seg([x + sx * 25, Y + 8.6, z], [x + sx * 25, Y + 34, z], 0.06, 0.06, { color: [0.1, 0.1, 0.1] });
    }
    for (let k = 0; k < 6; k++) jam(xw + 20 + R() * 100, z0 + 175, xw + 60 + R() * 120, z0 + 185, Y, 2, Math.PI / 2 + (R() - 0.5));
    open.push([cx - 80, z0 + 150, Y], [cx + 60, z0 + 300, Y]);
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
    const BW = 70, BD = 40, AV = 16, ST = 12;
    // the tarmac stops one avenue / street past the last row of blocks (no empty strips round the edge)
    const nx = Math.floor((2 * rx - AV - BW) / (BW + AV)) + 1, nzb = Math.floor((2 * rz - ST - BD) / (BD + ST)) + 1;
    const xe = bx0 - rx + nx * (BW + AV) + AV, ze = bz0 - rz + nzb * (BD + ST) + ST;
    add([bx0 - rx, Y - 1, bz0 - rz], [xe, Y + 0.02, ze], { color: [1, 1, 1], tex: 64, noShadow: true });
    ground.rect((bx0 - rx + xe) / 2, (bz0 - rz + ze) / 2, (xe - bx0 + rx) / 2, (ze - bz0 + rz) / 2, 30);
    grids.a[1] = [bx0 - rx, bz0 - rz, BW + AV, BD + ST]; grids.b[1] = [AV, ST, 0, 0];
    for (let x0 = bx0 - rx + AV; x0 + BW < bx0 + rx; x0 += BW + AV) for (let z0 = bz0 - rz + ST; z0 + BD < bz0 + rz; z0 += BD + ST) {
      const x1 = x0 + BW, z1 = z0 + BD;
      if (bridges.some((b) => Math.abs((z0 + z1) / 2 - b.z) < 40 && Math.min(x1, b.xb + b.dir * 175) > Math.max(x0, b.xb - b.dir * 5) - 0 && Math.max(x0, x1) > Math.min(b.xb, b.xb + b.dir * 175) && Math.min(x0, x1) < Math.max(b.xb, b.xb + b.dir * 175))) { add([x0, Y, z0], [x1, Y + 0.2, z1], { color: [0.5, 0.49, 0.46], tex: 4 }); open.push([(x0 + x1) / 2, (z0 + z1) / 2, Y + 0.2]); continue; }
      add([x0, Y, z0], [x1, Y + 0.2, z1], { color: [0.52, 0.51, 0.48], tex: 4 });
      const base = Y + 0.2;
      const roll = R();
      if (roll < 0.08) { for (let t = 0; t < 7; t++) tree(x0 + 4 + R() * (BW - 8), z0 + 4 + R() * (BD - 8), 1); open.push([(x0 + x1) / 2, (z0 + z1) / 2, base]); continue; }
      if (roll < 0.13) {
        // a school: a brick block along one side and a playing field with a running track
        tower(x0 + 1, z0 + 1, x1 - 1, z0 + 15, base, 12 + R() * 4, { style: 'brick', kind: R() < 0.5 ? 'school' : undefined, lootChance: 0.2 });
        at((x0 + x1) / 2, base, (z0 + z1) / 2 + 7, BW - 6, 0.06, BD - 20, { color: [0.62, 0.3, 0.22], solid: false, noShadow: true });
        at((x0 + x1) / 2, base + 0.02, (z0 + z1) / 2 + 7, BW - 14, 0.06, BD - 26, { color: [0.3, 0.5, 0.22], tex: 61, solid: false, noShadow: true });
        for (const sd of [-1, 1]) at((x0 + x1) / 2 + sd * (BW / 2 - 10), base, (z0 + z1) / 2 + 7, 0.15, 2.4, 3, { color: [0.95, 0.95, 0.95], solid: false });
        open.push([(x0 + x1) / 2, (z0 + z1) / 2 + 7, base]); continue;
      }
      if (roll < 0.16) {
        // a church: nave, a tall square tower and a spire
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, col = [0.58, 0.55, 0.5];
        at(mx + 6, base, mz, 34, 14, 16, { color: col, tex: 17 });
        const half = 8.4, rise = 5, sl = Math.hypot(half, rise), ang = Math.atan2(rise, half);
        for (const sd of [-1, 1]) rot(mx + 6, base + 14 + rise / 2 - 0.2, mz + sd * half / 2, [sd * ang, 0, 0], 35, 0.3, sl, { color: [0.3, 0.3, 0.33], shape: 0.04, solid: false });
        at(mx - 15, base, mz, 9, 30, 9, { color: col, tex: 17 });
        at(mx - 15, base + 30, mz, 7, 16, 7, { color: [0.3, 0.32, 0.34], shape: { taper: [1, 1] } });
        for (let t = 0; t < 4; t++) tree(x0 + 4 + R() * 10, z0 + 4 + R() * (BD - 8), 0.8);
        continue;
      }
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
    // a riverside park along the bank, between the river and the first street
    for (let k = 0; k < 70; k++) {
      const x = bx0 - rx - 4 - R() * 55, z = bz0 - rz + R() * 2 * rz, h = T.heightAt(x, z);
      if (h < WATER + 1.5 || ground.at(x, z).road < 8 || bridges.some((b) => Math.abs(z - b.z) < 22)) continue;
      tree(x, z, 0.8 + R() * 0.4);
    }
    // the suburbs: streets of houses with gardens round the far sides, so it fades out into the country
    for (const [ax, az, bx, bz2, nx, nz] of [[xe + 24, bz0 - rz, xe + 24, ze, 1, 0], [bx0 - rx + 40, ze + 24, xe, ze + 24, 0, 1], [bx0 - rx + 40, bz0 - rz - 24, xe, bz0 - rz - 24, 0, -1]]) {
      const L = Math.hypot(bx - ax, bz2 - az), ux = (bx - ax) / L, uz = (bz2 - az) / L;
      for (let row = 0; row < 3; row++) for (let t = 6; t < L - 6; t += 13 + R() * 4) {
        const x = ax + ux * t + nx * row * 22, z = az + uz * t + nz * row * 22, y = T.heightAt(x, z);
        if (Math.abs(y - Y) > 5 || ground.at(x, z).road < 9 || T.slopeAt(x, z) > 0.25 || y < WATER + 2) continue;
        if (R() < 0.15) { tree(x, z, 1); continue; }
        house(x, y, z, 0);
      }
      ground.road(ax + nx * 11, az + nz * 11, bx + nx * 11, bz2 + nz * 11);
    }
  }

  let spire = null, fort = null, hospital = null, airfield = null, lab = null;
  const lairs = {};
  // THE AIRFIELD: a 1.3 km runway with markings and edge lights, a taxiway, an apron, two hangars, a control tower,
  // fuel tanks and a windsock. Planes start here, and land here to refuel, repair and rearm.
  function airfieldSite(s) {
    const { x, z, y } = s, L = 420, W = 24, ASP = [0.16, 0.16, 0.17], WH = [0.93, 0.93, 0.9];
    ground.town(x, z + 40, 700, 20);
    const rw = add([x - L, y - 0.5, z - W], [x + L, y + 0.12, z + W], { color: ASP, tex: 7, tag: 'pad' });
    // centre line, thresholds, touchdown marks
    for (let k = -L + 60; k < L - 60; k += 30) add([x + k, y + 0.12, z - 0.5], [x + k + 16, y + 0.15, z + 0.5], { color: WH, solid: false, noShadow: true });
    for (const sx of [-1, 1]) {
      for (let j = 0; j < 8; j++) { const zz = z - W + 3 + j * 5.6; add([x + sx * (L - 28) - 12, y + 0.12, zz], [x + sx * (L - 28) + 12, y + 0.15, zz + 2.6], { color: WH, solid: false, noShadow: true }); }
      for (const off of [150, 230]) for (const dz of [-9, 7]) add([x + sx * (L - off) - 14, y + 0.12, z + dz], [x + sx * (L - off) + 14, y + 0.15, z + dz + 2], { color: WH, solid: false, noShadow: true });
      at(x + sx * (L - 2), y + 0.1, z, 2, 0.3, W * 2, { color: [0.2, 1, 0.3], emissive: 0.8, solid: false, noShadow: true });
    }
    for (let k = -L; k <= L; k += 60) for (const sz of [-1, 1]) at(x + k, y + 0.1, z + sz * (W + 1), 0.35, 0.35, 0.35, { color: [1, 0.92, 0.6], emissive: 1, solid: false, noShadow: true });
    // a taxiway to the apron
    add([x - 260, y - 0.5, z + W], [x - 230, y + 0.1, z + 70], { color: ASP, tex: 7 });
    const apron = add([x - 330, y - 0.5, z + 70], [x + 70, y + 0.11, z + 150], { color: [0.4, 0.4, 0.39], tex: 4, tag: 'pad' });
    for (let k = 0; k < 5; k++) add([x - 300 + k * 70, y + 0.11, z + 74], [x - 299 + k * 70, y + 0.14, z + 140], { color: [0.95, 0.75, 0.15], solid: false, noShadow: true });
    // two hangars, doors open to the apron
    for (const hx of [x - 250, x - 150]) {
      const hx0 = hx - 38, hx1 = hx + 38, hz0 = z + 155, hz1 = z + 200, HH = 16, M = [0.5, 0.53, 0.56];
      add([hx0, y - 0.5, hz0], [hx0 + 1, y + HH, hz1], { color: M, tex: 5, mat: 'metal' });
      add([hx1 - 1, y - 0.5, hz0], [hx1, y + HH, hz1], { color: M, tex: 5, mat: 'metal' });
      add([hx0, y - 0.5, hz1 - 1], [hx1, y + HH, hz1], { color: M, tex: 5, mat: 'metal' });
      const rf = add([hx0 - 0.5, y + HH, hz0 - 0.5], [hx1 + 0.5, y + HH + 1.2, hz1 + 0.5], { color: [0.38, 0.4, 0.43], tex: 5, mat: 'metal' });
      roofs.push({ box: rf, top: y + HH + 1.2, x: hx, z: (hz0 + hz1) / 2, sx: hx1 - hx0, sz: hz1 - hz0, h: HH + 1.2, base: y, door: [hx, y, hz0], stair: [hx0 + 4, y + HH + 1, hz1 - 4] });
      for (const lx of [hx - 20, hx, hx + 20]) at(lx, y + HH - 0.6, (hz0 + hz1) / 2, 0.6, 0.3, 30, { color: [1, 0.96, 0.85], emissive: 1, noShadow: true, solid: false });
    }
    // the control tower
    tower(x + 10, z + 160, x + 26, z + 176, y, 18, { style: 'office', lootChance: 0 });
    at(x + 18, y + 18, z + 168, 18, 4, 18, { color: [0.15, 0.3, 0.38], mat: 'glass' });
    at(x + 18, y + 22, z + 168, 19, 0.6, 19, { color: [0.2, 0.2, 0.22], mat: 'metal' });
    at(x + 18, y + 22.6, z + 168, 0.3, 5, 0.3, { color: [0.6, 0.6, 0.62], mat: 'metal' });
    at(x + 18, y + 27.6, z + 168, 0.6, 0.6, 0.6, { color: [1, 0.15, 0.1], emissive: 1, shape: 'sphere', noShadow: true });
    // fuel farm, windsock, a couple of old wrecks
    for (let k = 0; k < 3; k++) at(x + 80 + k * 14, y - 0.5, z + 185, 10, 8, 10, { color: [0.82, 0.82, 0.8], shape: 'cylY', mat: 'paint' });
    at(x + 120, y - 0.5, z + 60, 0.2, 7, 0.2, { color: [0.7, 0.7, 0.7], mat: 'metal' });
    at(x + 120, y + 6, z + 61.2, 0.9, 0.9, 2.6, { color: [1, 0.45, 0.1], shape: { taper: [1, 0.4] }, solid: false });
    open.push([x - 100, z + 110, y], [x + 40, z + 110, y]);
    const spawn = [x - L + 40, y + 0.12, z];
    return { id: 'airfield', name: 'AIRFIELD', pos: [x, y, z], x, z, y, pad: rw, pads: [{ box: rw, at: spawn }, { box: apron, at: [x - 130, y + 0.11, z + 110] }], padAt: spawn, spawn, spawnYaw: -Math.PI / 2, hp: 1, max: 1, turrets: [], runway: { x0: x - L, x1: x + L, z0: z - W, z1: z + W, y } };
  }
  const cities = [], masts = [];
  // FORT CALDER: a walled army base. Barracks and an armoury to raid, hangars, fuel, watchtowers, and two pads
  function fortress(s) {
    const { x, z, y } = s, W = 112, WALL = [0.55, 0.54, 0.5], OL = [0.32, 0.35, 0.24];
    ground.town(x, z, W + 6, 16);
    for (const [ax, az, bx, bz] of [[-W, -W, W, -W], [-W, W, W, W], [-W, -W, -W, W], [W, -W, W, W]]) {
      // the wall, with the gate on the south side
      if (az === -W && bz === -W) {
        at(x - (W + 12) / 2 - 1, y - 0.5, z - W, W - 12, 6, 1.4, { color: WALL, tex: 3 });
        at(x + (W + 12) / 2 + 1, y - 0.5, z - W, W - 12, 6, 1.4, { color: WALL, tex: 3 });
        for (const sx of [-1, 1]) at(x + sx * 9, y - 0.5, z - W, 3, 8, 3, { color: WALL, tex: 3 });
        at(x - 4, y + 0.6, z - W - 4, 0.25, 0.25, 9, { color: [0.85, 0.2, 0.15], mat: 'paint', solid: false });          // a broken barrier arm
        continue;
      }
      at(x + (ax + bx) / 2, y - 0.5, z + (az + bz) / 2, Math.abs(bx - ax) + 1.4, 6, Math.abs(bz - az) + 1.4, { color: WALL, tex: 3 });
      // razor wire on top
      at(x + (ax + bx) / 2, y + 5.5, z + (az + bz) / 2, Math.abs(bx - ax) + 0.6, 0.6, Math.abs(bz - az) + 0.6, { color: [0.3, 0.3, 0.3], mat: 'metal', solid: false, noShadow: true });
    }
    // watchtowers on the corners
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = x + sx * (W - 3), tz = z + sz * (W - 3);
      for (const [lx, lz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) at(tx + lx, y - 0.5, tz + lz, 0.35, 11, 0.35, { color: [0.35, 0.28, 0.2], tex: 62 });
      at(tx, y + 10.5, tz, 5, 0.4, 5, { color: [0.4, 0.32, 0.22], tex: 12 });
      at(tx, y + 10.9, tz, 5, 1.1, 5, { color: OL, tex: 12, solid: false });
      at(tx, y + 13, tz, 5.6, 0.3, 5.6, { color: [0.25, 0.27, 0.2], mat: 'metal' });
      for (const [lx, lz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) at(tx + lx, y + 11, tz + lz, 0.2, 2, 0.2, { color: [0.3, 0.25, 0.18], solid: false });
    }
    // the parade ground, roads inside, a flagpole
    ground.road(x, z - W, x, z + W - 20); ground.road(x - W + 10, z, x + W - 10, z);
    at(x, y - 0.5, z - 30, 0.25, 16, 0.25, { color: [0.8, 0.8, 0.8], mat: 'metal' });
    at(x + 1.4, y + 13.5, z - 30, 2.6, 1.6, 0.05, { color: [0.15, 0.25, 0.5], solid: false, noShadow: true });
    // barracks (two you can raid), the armoury, the HQ
    const blds = [
      [x - 80, z - 80, x - 34, z - 62, 8, 'flats'], [x - 80, z - 50, x - 34, z - 32, 8, null], [x + 34, z - 80, x + 80, z - 62, 8, 'flats'],
      [x + 40, z - 40, x + 70, z - 18, 7.5, 'armory'], [x - 22, z + 60, x + 22, z + 90, 14, 'police'],
    ];
    for (const [ax, az, bx, bz, h, kind] of blds) tower(ax, az, bx, bz, y, h, { style: 'office', kind, lootChance: 0 });
    // two big aircraft hangars on the west side, doors open
    for (const hz of [z + 10, z + 52]) {
      const hx0 = x - 100, hx1 = x - 60, hz0 = hz - 16, hz1 = hz + 16, HH = 14, M = [0.42, 0.45, 0.4];
      add([hx0, y - 0.5, hz0], [hx0 + 1, y + HH, hz1], { color: M, tex: 5, mat: 'metal' });
      add([hx0, y - 0.5, hz0], [hx1, y + HH, hz0 + 1], { color: M, tex: 5, mat: 'metal' });
      add([hx0, y - 0.5, hz1 - 1], [hx1, y + HH, hz1], { color: M, tex: 5, mat: 'metal' });
      const rf = add([hx0 - 0.5, y + HH, hz0 - 0.5], [hx1 + 0.5, y + HH + 1, hz1 + 0.5], { color: [0.35, 0.38, 0.33], tex: 5, mat: 'metal' });
      roofs.push({ box: rf, top: y + HH + 1, x: (hx0 + hx1) / 2, z: hz, sx: hx1 - hx0, sz: hz1 - hz0, h: HH + 1, base: y, door: [hx1, y, hz], stair: [hx0 + 4, y + HH + 1, hz] });
      car((hx0 + hx1) / 2, y, hz - 6, Math.PI / 2, R() < 0.5);
      for (let k = 0; k < 4; k++) at(hx0 + 4 + k * 2.4, y, hz + 11, 2, 1.3, 1.6, { color: [0.45, 0.42, 0.25], tex: 12 });
    }
    // fuel tanks behind a berm, trucks, sandbags, a radar dish on the HQ
    for (let k = 0; k < 4; k++) at(x + 60 + (k % 2) * 14, y - 0.5, z + 50 + Math.floor(k / 2) * 14, 9, 7, 9, { color: [0.75, 0.76, 0.72], shape: 'cylY', mat: 'paint' });
    for (let k = 0; k < 6; k++) { rot(x + 20 + k * 6, y, z - 100 + 8, [0, 0.05 * k, 0], 2.4, 2.6, 6.5, { color: OL, shape: 0.1, mat: 'paint' }); }
    for (let k = 0; k < 10; k++) at(x - 20 + k * 4, y - 0.2, z - W + 6, 3.6, 1.2, 1.2, { color: [0.55, 0.5, 0.36], shape: 0.3 });
    at(x, y + 15, z + 75, 0.4, 3, 0.4, { color: [0.5, 0.5, 0.5], mat: 'metal' });
    rot(x, y + 18, z + 75, [0.5, 0, 0], 4.5, 0.3, 4.5, { color: [0.82, 0.82, 0.8], shape: 'cylY', mat: 'paint', solid: false });
    // the helipads: a FOB once it's yours
    const PADS = [[30, 30], [-10, 30]], pads = [];
    for (const [ox, oz] of PADS) {
      const c = [x + ox, y + 0.55, z + oz];
      const box = add([c[0] - 10, y - 0.5, c[2] - 10], [c[0] + 10, y + 0.55, c[2] + 10], { color: [0.24, 0.24, 0.25], tex: 7, tag: 'pad' });
      add([c[0] - 9, c[1], c[2] - 9], [c[0] + 9, c[1] + 0.02, c[2] + 9], { color: [0.95, 0.75, 0.15], solid: false, noShadow: true });
      add([c[0] - 8.4, c[1], c[2] - 8.4], [c[0] + 8.4, c[1] + 0.04, c[2] + 8.4], { color: [0.24, 0.24, 0.25], solid: false, noShadow: true });
      for (const [a, b] of [[[-4, -5], [-2.6, 5]], [[2.6, -5], [4, 5]], [[-2.6, -0.7], [2.6, 0.7]]]) add([c[0] + a[0], c[1] + 0.04, c[2] + a[1]], [c[0] + b[0], c[1] + 0.06, c[2] + b[1]], { color: [0.95, 0.95, 0.92], solid: false, noShadow: true });
      pads.push({ box, at: c });
    }
    open.push([x, z - 60, y], [x + 30, z + 10, y]);
    const turrets = [[x - W + 3, z - W + 3], [x + W - 3, z - W + 3], [x - W + 3, z + W - 3], [x + W - 3, z + W - 3]].map(([tx, tz]) => ({ pos: [tx, y + 12.6, tz], yaw: Math.PI, cd: 0, flash: 0, fort: true }));
    return { id: 'fort', name: 'FORT CALDER', pos: [x, y, z], x, z, y, r: W, pad: pads[0].box, pads, padAt: pads[0].at, hp: 1, max: 1, turrets, locked: true, foot: [x, y, z - W - 6] };
  }
  // ST MARY'S HOSPITAL: a big main block with a pad on the roof, two wings, an ambulance bay and a car park
  function hospitalSite(s) {
    const { x, z, y } = s;
    ground.town(x, z, 78, 16);
    const main = tower(x - 30, z - 18, x + 30, z + 18, y, 30, { style: 'office', kind: 'hospital', lootChance: 0 });
    for (const sx of [-1, 1]) tower(x + sx * 30 + (sx > 0 ? 0 : -26), z - 12, x + sx * 30 + (sx > 0 ? 26 : 0), z + 12, y, 15, { style: 'office', lootChance: 0 });
    // a red cross each side and a sign
    for (const sz of [-1, 1]) {
      at(x, y + 24, z + sz * 18.3, 7, 2, 0.2, { color: [0.95, 0.15, 0.12], emissive: 0.8, noShadow: true, solid: false });
      at(x, y + 24, z + sz * 18.3, 2, 7, 0.2, { color: [0.95, 0.15, 0.12], emissive: 0.8, noShadow: true, solid: false });
    }
    at(x, y + 31.2, z, 14, 0.06, 14, { color: [0.95, 0.15, 0.12], noShadow: true, solid: false });
    at(x, y + 31.24, z, 12.6, 0.06, 12.6, { color: [0.2, 0.2, 0.22], noShadow: true, solid: false });
    for (const [a, b] of [[[-3, -4], [-1.8, 4]], [[1.8, -4], [3, 4]], [[-1.8, -0.6], [1.8, 0.6]]]) add([x + a[0], y + 31.28, z + a[1]], [x + b[0], y + 31.32, z + b[1]], { color: [0.95, 0.95, 0.92], solid: false, noShadow: true });
    // the car park: ambulances and abandoned cars
    for (let k = 0; k < 16; k++) car(x - 60 + (k % 8) * 16 + (R() - 0.5) * 3, y, z - 38 - Math.floor(k / 8) * 9, (R() - 0.5) * 0.5, R() < 0.15);
    for (let k = 0; k < 3; k++) { rot(x - 12 + k * 8, y, z + 26, [0, 0, 0], 2.3, 2.6, 5.8, { color: [0.95, 0.95, 0.92], shape: 0.12, mat: 'paint' }); at(x - 12 + k * 8, y + 2.6, z + 26, 1.4, 0.3, 0.6, { color: [1, 0.2, 0.15], emissive: 1, noShadow: true, solid: false }); }
    open.push([x - 40, z - 50, y]);
    return { x, z, y, roof: main, name: "ST MARY'S HOSPITAL" };
  }
  // giant footprints: a trail of dark prints from (x, z) heading off at angle a
  function prints(x, z, a, n, step = 9) {
    for (let k = 0; k < n; k++) {
      const sd = k % 2 ? 1 : -1, d = 20 + k * step, px = x + Math.cos(a) * d - Math.sin(a) * sd * 3.2, pz = z + Math.sin(a) * d + Math.cos(a) * sd * 3.2;
      const py = T.heightAt(px, pz);
      rot(px, py + 0.02, pz, [0, Math.atan2(Math.cos(a), Math.sin(a)) * -1 + Math.PI / 2, 0], 2.6, 0.05, 4.6, { color: [0.13, 0.11, 0.1], solid: false, noShadow: true, shape: 'sphere' });
      for (const t of [-1, 0, 1]) rot(px + Math.cos(a) * 2.8 - Math.sin(a) * t * 0.9, py + 0.03, pz + Math.sin(a) * 2.8 + Math.cos(a) * t * 0.9, [0, 0, 0], 0.7, 0.05, 0.9, { color: [0.11, 0.09, 0.08], solid: false, noShadow: true, shape: 'sphere' });
    }
  }
  const HAZ = [0.95, 0.78, 0.1];
  const bioSign = (x, y, z, yaw) => {
    rot(x, y, z, [0, yaw, 0], 3, 3, 0.15, { color: HAZ, solid: false, mat: 'paint' });
    rot(x + Math.sin(yaw) * 0.09, y + 0.7, z + Math.cos(yaw) * 0.09, [Math.PI / 2, yaw, 0], 1.6, 0.06, 1.6, { color: [0.08, 0.08, 0.08], shape: 'cylY', solid: false, noShadow: true });
    rot(x + Math.sin(yaw) * 0.1, y + 1.15, z + Math.cos(yaw) * 0.1, [Math.PI / 2, yaw, 0], 0.55, 0.06, 0.55, { color: HAZ, shape: 'cylY', solid: false, noShadow: true });
  };
  // HALDEN BIOLAB: a fenced army research site. Project ATLAS: three growth vats in the containment hall,
  // and a fourth one smashed open, a hole torn through the wall, and huge footprints leading away
  function labSite(s) {
    const { x, z, y } = s, F = 92, M = [0.6, 0.62, 0.6];
    ground.town(x, z, 115, 30);
    // the fence (with a gate on the south side and a section trampled flat on the east)
    for (const [ax, az, bx, bz] of [[-F, -F, F, -F], [F, -F, F, F], [F, F, -F, F], [-F, F, -F, -F]]) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 12);
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, px = x + ax + (bx - ax) * t0, pz = z + az + (bz - az) * t0, qx = x + ax + (bx - ax) * t1, qz = z + az + (bz - az) * t1;
        const gate = az === F && bz === F && Math.abs((px + qx) / 2 - x) < 10, broken = ax === F && bx === F && Math.abs((pz + qz) / 2 - z - 20) < 16;
        at(px, y - 0.3, pz, 0.25, 3.4, 0.25, { color: M, mat: 'metal' });
        if (broken) { rot((px + qx) / 2 + 3, y + 0.1, (pz + qz) / 2, [0, 0, 1.45], 0.1, 3, 12, { color: M, mat: 'metal', solid: false }); continue; }
        if (gate) continue;
        seg([px, y + 2.9, pz], [qx, y + 2.9, qz], 0.06, 0.06, { color: M });
        const mx = (px + qx) / 2, mz = (pz + qz) / 2;
        rot(mx, y + 0.1, mz, [0, Math.atan2(qx - px, qz - pz), 0], 0.06, 2.8, 12, { color: [0.55, 0.57, 0.55], mat: 'metal', noBullet: true });
      }
    }
    for (const [sx, sz, yaw] of [[-12, F + 0.3, 0], [12, F + 0.3, 0], [F + 0.3, -30, Math.PI / 2], [-F - 0.3, 0, -Math.PI / 2]]) bioSign(x + sx, y + 1.2, z + sz, yaw);
    // the office block (the survivor holes up on its roof)
    const main = tower(x - 70, z - 70, x - 20, z - 38, y, 17, { style: 'office', lootChance: 0 });
    at(x - 45, y + 17.3, z - 54, 5, 0.1, 5, { color: HAZ, solid: false, noShadow: true });
    // the containment hall, with a giant's hole through its east wall
    const hx = x + 22, hz = z + 18, HW = 34, HD = 24, HH = 20, C = [0.62, 0.63, 0.6];
    add([hx - HW, y - 0.3, hz - HD], [hx + HW, y + HH, hz - HD + 1], { color: C, tex: 3 });
    add([hx - HW, y - 0.3, hz + HD - 1], [hx + HW, y + HH, hz + HD], { color: C, tex: 3 });
    add([hx - HW, y - 0.3, hz - HD], [hx - HW + 1, y + HH, hz + HD], { color: C, tex: 3 });
    add([hx + HW - 1, y - 0.3, hz - HD], [hx + HW, y + HH, hz - 9], { color: C, tex: 3 });
    add([hx + HW - 1, y - 0.3, hz + 9], [hx + HW, y + HH, hz + HD], { color: C, tex: 3 });
    add([hx + HW - 1, y + 16, hz - 9], [hx + HW, y + HH, hz + 9], { color: C, tex: 3 });
    // the roof: half of it fell in
    add([hx - HW, y + HH, hz - HD], [hx + 4, y + HH + 0.8, hz + HD], { color: [0.4, 0.4, 0.42], mat: 'metal' });
    rot(hx + 18, y + 9, hz, [0, 0, 0.55], 30, 0.8, 40, { color: [0.38, 0.38, 0.4], mat: 'metal' });
    for (let k = 0; k < 14; k++) rot(hx + HW + 4 + R() * 16, y, hz + (R() - 0.5) * 22, [R(), R() * 3, R()], 1.5 + R() * 3, 1 + R() * 2, 1.5 + R() * 3, { color: C, shape: 0.3 });
    // the vats: three still running, glowing; one smashed open from the inside
    const vats = [];
    for (let k = 0; k < 4; k++) {
      const vx = hx - 22 + k * 13, vz = hz - 6, dead = k === 3;
      at(vx, y - 0.3, vz, 9, 1.8, 9, { color: [0.3, 0.32, 0.34], mat: 'metal', shape: 'cylY' });
      if (dead) {
        for (let j = 0; j < 7; j++) { const a = j * 0.9; rot(vx + Math.cos(a) * 3.6, y + 1.5, vz + Math.sin(a) * 3.6, [0.2, -a, 0.4 + R() * 0.5], 0.15, 3 + R() * 5, 2.4, { color: [0.6, 0.8, 0.75], mat: 'glass', solid: false }); }
        at(vx, y + 1.5, vz, 7, 0.1, 7, { color: [0.3, 0.6, 0.15], emissive: 0.3, shape: 'cylY', solid: false, noShadow: true });
      } else {
        const parts = [
          at(vx, y + 1.5, vz, 6.8, 13, 6.8, { color: [0.35, 0.85, 0.2], emissive: 0.6, shape: 'cylY', dynamic: true, solid: false, noShadow: true }),
          at(vx, y + 14.5, vz, 8.2, 1.6, 8.2, { color: [0.3, 0.32, 0.34], mat: 'metal', shape: 'cylY', dynamic: true }),
          at(vx, y + 6, vz, 1.2, 3, 0.8, { color: [0.12, 0.2, 0.08], shape: 'sphere', dynamic: true, solid: false }),
        ];
        for (const a of [0.4, 2, 3.6, 5.2]) parts.push(at(vx + Math.cos(a) * 3.5, y + 1.5, vz + Math.sin(a) * 3.5, 0.45, 13, 0.45, { color: [0.35, 0.36, 0.38], mat: 'metal', dynamic: true }));
        vats.push({ x: vx, y: y + 8, z: vz, parts });
      }
      seg([vx, y + 16, vz], [vx, y + HH, hz - HD + 2], 0.5, 0.5, { color: [0.4, 0.4, 0.42], mat: 'metal' });
    }
    // the army never left: trucks, sandbags, warning lights
    for (const [tx, tz, yaw] of [[x + 10, z + 70, 0.3], [x - 20, z + 60, -0.2], [x + 70, z - 60, 1.2]]) {
      rot(x * 0 + tx, y, tz, [0, yaw, 0], 2.6, 2.4, 8, { color: [0.26, 0.3, 0.2], shape: 0.15, mat: 'paint' });
      rot(tx + Math.sin(yaw) * 1, y + 2.4, tz + Math.cos(yaw) * 1, [0, yaw, 0], 2.5, 1.6, 5, { color: [0.3, 0.34, 0.24], shape: 0.3 });
    }
    for (let k = 0; k < 8; k++) rot(x - 24 + k * 6.2, y, z + 82, [0, 0, 0], 6, 1.2, 1.4, { color: [0.55, 0.48, 0.34], shape: 0.5 });
    for (const [lx, lz] of [[-F, -F], [F, -F], [F, F], [-F, F]]) { at(x + lx, y, z + lz, 0.4, 9, 0.4, { color: M, mat: 'metal' }); at(x + lx, y + 9, z + lz, 0.9, 0.9, 0.9, { color: [1, 0.55, 0.1], emissive: 1, shape: 'sphere', noShadow: true, solid: false }); }
    burning.push([hx + 10, y + HH, hz]);
    open.push([x, z + 75, y]);
    return { x, z, y, roof: main, name: 'HALDEN BIOLAB', vats, hall: [hx, y, hz] };
  }
  // RED ROCK QUARRY: the goliath's den. A pit full of crushed, stacked cars it's carried back
  function quarrySite(s) {
    const { x, z, y } = s, ROCK = [[0.55, 0.42, 0.33], [0.48, 0.38, 0.3], [0.62, 0.5, 0.4]];
    ground.town(x, z, 90, 25);
    for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2 + R() * 0.2, r = 60 + R() * 10; const bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r; rot(bx, T.heightAt(bx, bz) - 2, bz, [R(), R() * 3, R()], 9 + R() * 10, 8 + R() * 10, 9 + R() * 8, { color: ROCK[k % 3], shape: 'blob' }); }
    // the pile of cars: flattened, stacked, some on end
    rot(x, y - 3, z, [0, 0.4, 0], 30, 7, 26, { color: [0.3, 0.27, 0.25], shape: 'blob' });
    for (let k = 0; k < 70; k++) {
      const a = R() * 6.28, r = R() * (16 - Math.floor(k / 14) * 2.5), layer = Math.floor(k / 14);
      rot(x + Math.cos(a) * r, y + 2.5 + layer * 1.0, z + Math.sin(a) * r, [R() * 0.4, R() * 6.28, R() * 0.4], 2.0, 0.6, 4.4, { color: [0.3 + R() * 0.4, 0.15 + R() * 0.3, 0.12 + R() * 0.3], shape: 0.15, mat: 'paint' });
    }
    for (let k = 0; k < 5; k++) rot(x + 20 + k * 5, y + 2, z - 12 + k * 3, [Math.PI / 2 - 0.2, k, 0], 1.9, 0.7, 4.3, { color: CARS[k % CARS.length], shape: 0.2, mat: 'paint' });
    // a toppled crane and the great bones of whatever it's eaten
    seg([x - 40, y + 1, z + 20], [x + 5, y + 6, z + 45], 1.2, 1.2, { color: [0.85, 0.65, 0.1], mat: 'paint', solid: true });
    for (let k = 0; k < 8; k++) { const a = k * 0.8, bx = x - 25 + Math.cos(a) * 12, bz = z - 20 + Math.sin(a) * 12; seg([bx, y + 0.4, bz], [bx + Math.cos(a + 1.3) * 5, y + 0.6, bz + Math.sin(a + 1.3) * 5], 0.35, 0.35, { color: [0.86, 0.82, 0.72], solid: false }); }
    at(x + 30, y, z + 30, 9, 4, 6, { color: [0.5, 0.5, 0.47], tex: 3 });
    prints(x, z, 2.2, 26, 10);
    burning.push([x + 5, y + 3, z - 5]);
    return { x, z, y, name: 'RED ROCK QUARRY' };
  }
  // KESSLER CHEMICALS: the spitter's den. Burst tanks, pools of something green eating through the concrete
  function chemSite(s) {
    const { x, z, y } = s;
    ground.town(x, z, 90, 25);
    for (const [tx, tz, burst] of [[-30, -25, 0], [-5, -30, 1], [22, -22, 0], [-28, 8, 1], [30, 10, 0]]) {
      const h = burst ? 7 : 14;
      at(x + tx, y - 0.3, z + tz, 15, h, 15, { color: burst ? [0.4, 0.42, 0.38] : [0.82, 0.84, 0.82], shape: 'cylY', mat: 'paint' });
      if (burst) for (let j = 0; j < 6; j++) { const a = j * 1.05; rot(x + tx + Math.cos(a) * 7, y + h - 0.5, z + tz + Math.sin(a) * 7, [0.5, -a, 0], 0.3, 3 + R() * 3, 5, { color: [0.38, 0.4, 0.36], mat: 'metal', solid: false }); }
      else { at(x + tx, y + h, z + tz, 15.4, 0.6, 15.4, { color: [0.5, 0.52, 0.5], shape: 'cylY', mat: 'metal' }); bioSign(x + tx, y + 3, z + tz + 7.6, 0); }
    }
    for (const [px, pz, r] of [[-12, -8, 16], [10, 6, 11], [-24, 28, 13], [24, 32, 9], [0, 46, 7]]) at(x + px, y + 0.03, z + pz, r, 0.08, r * 0.8, { color: [0.45, 0.95, 0.15], emissive: 0.6, shape: 'cylY', solid: false, noShadow: true });
    for (let k = 0; k < 6; k++) seg([x - 40, y + 6 + k * 0.6, z - 40 + k * 14], [x + 40, y + 6 + k * 0.6, z - 40 + k * 14], 0.4, 0.4, { color: [0.5, 0.45, 0.35], mat: 'metal' });
    for (let k = 0; k < 24; k++) { const a = R() * 6.28, r = 20 + R() * 40; rot(x + Math.cos(a) * r, y, z + Math.sin(a) * r, [R() < 0.4 ? Math.PI / 2 : 0, a, 0], 0.9, 1.3, 0.9, { color: [0.85, 0.7, 0.1], shape: 'cylY', mat: 'paint' }); }
    building(x - 20, z + 40, x + 20, z + 62, y, 8, 1, 'hardware');
    prints(x, z, 4.0, 24, 8);
    burning.push([x - 5, y + 7, z - 30]);
    return { x, z, y, name: 'KESSLER CHEMICALS' };
  }
  // THE NEST: the broodmother's den. A ring of cars dragged into a wall, and inside, eggs
  function nestSite(s) {
    const { x, z, y } = s, FLESH = [0.7, 0.45, 0.45], EGGC = [1, 0.55, 0.25];
    ground.town(x, z, 70, 25);
    for (let k = 0; k < 120; k++) { const a = (k % 60) / 60 * 6.28 + (k >= 60 ? 0.05 : 0), layer = k >= 60 ? 1 : 0, r = 44 + R() * 2 - layer; rot(x + Math.cos(a) * r, y + layer * 1.5 + R() * 0.3, z + Math.sin(a) * r, [k % 2 ? Math.PI : 0.3 + R() * 0.5, -a + (R() < 0.5 ? 0 : Math.PI / 2), R() * 0.5], 1.9, 0.75, 4.3, { color: CARS[k % CARS.length].map((v) => v * 0.6), shape: 0.2, mat: 'paint' }); }
    for (let k = 0; k < 9; k++) { const a = k * 0.7, r = 8 + (k % 4) * 7; rot(x + Math.cos(a) * r, y - 1, z + Math.sin(a) * r, [0, a, 0], 8 + (k % 3) * 3, 4 + (k % 2) * 2, 7 + (k % 3) * 2, { color: FLESH, shape: 'blob' }); }
    for (let k = 0; k < 60; k++) { const a = R() * 6.28, r = 4 + R() * 32, sz = 0.9 + R() * 0.8; at(x + Math.cos(a) * r, y + R() * 1.5, z + Math.sin(a) * r, sz, sz * 1.2, sz, { color: EGGC, emissive: 0.6, shape: 'sphere', solid: false, noShadow: true }); }
    for (let k = 0; k < 18; k++) { const a = R() * 6.28, b = a + (R() - 0.5) * 2; seg([x + Math.cos(a) * 10, y + 4, z + Math.sin(a) * 10], [x + Math.cos(b) * 44, y + 1.5, z + Math.sin(b) * 44], 0.08, 0.08, { color: [0.85, 0.8, 0.75], solid: false }); }
    prints(x, z, 0.9, 20, 9);
    return { x, z, y, name: 'THE NEST' };
  }
  // a radio mast: a lattice tower on a hilltop, a hut full of radios, and a little pad
  function mastSite(s, n) {
    const { x, z, y } = s, H = 64, M = [0.75, 0.72, 0.7];
    for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      seg([x + lx, y - 0.5, z + lz], [x + lx * 0.15, y + H, z + lz * 0.15], 0.18, 0.18, { color: (lx > 0) === (lz > 0) ? [0.85, 0.2, 0.15] : M, mat: 'paint', noShadow: false });
    }
    for (let k = 1; k < 8; k++) { const f = 1 - (k / 8) * 0.85, hh = y + (k / 8) * H; at(x, hh, z, 6 * f + 0.3, 0.2, 6 * f + 0.3, { color: M, mat: 'metal', solid: false }); }
    at(x, y + H, z, 0.5, 6, 0.5, { color: M, mat: 'metal' });
    for (const k of [0.5, 1]) at(x, y + H * k + (k === 1 ? 6 : 0), z, 0.9, 0.9, 0.9, { color: [1, 0.1, 0.05], emissive: 1, shape: 'sphere', noShadow: true });
    for (const a of [0, 2.1, 4.2]) rot(x + Math.cos(a) * 1.2, y + H - 8, z + Math.sin(a) * 1.2, [0, -a, Math.PI / 2], 2.2, 0.4, 2.2, { color: [0.9, 0.9, 0.88], shape: 'cylY', mat: 'paint', solid: false });
    const hut = at(x + 10, y - 0.5, z, 7, 3.6, 5, { color: [0.6, 0.6, 0.56], tex: 3 });
    at(x + 10, y + 3.1, z, 7.4, 0.3, 5.4, { color: [0.3, 0.3, 0.32], mat: 'metal' });
    const pc = [x - 9, y + 0.4, z];
    const pad = add([pc[0] - 7, y - 0.5, pc[2] - 7], [pc[0] + 7, y + 0.4, pc[2] + 7], { color: [0.45, 0.45, 0.44], tex: 4 });
    add([pc[0] - 6, pc[1], pc[2] - 6], [pc[0] + 6, pc[1] + 0.03, pc[2] + 6], { color: [0.95, 0.75, 0.15], solid: false, noShadow: true });
    add([pc[0] - 5.5, pc[1], pc[2] - 5.5], [pc[0] + 5.5, pc[1] + 0.05, pc[2] + 5.5], { color: [0.45, 0.45, 0.44], solid: false, noShadow: true });
    ground.town(x, z, 18, 10);
    return { x, z, y, n, name: ['MAST ALPHA', 'MAST BRAVO', 'MAST CHARLIE'][n] || 'MAST', pad, padAt: pc, hut: [x + 10, y, z], top: y + H };
  }
  for (const s of spots) {
    if (s.kind === 'city') { spire = metropolis(); cities.push(s); continue; }
    if (s.kind === 'borough') { borough(); cities.push(s); continue; }
    if (s.kind === 'port') continue;
    if (s.kind === 'fort') { fort = fortress(s); continue; }
    if (s.kind === 'airfield') { airfield = airfieldSite(s); continue; }
    if (s.kind === 'hospital') { hospital = hospitalSite(s); continue; }
    if (s.kind === 'mast') { masts.push(mastSite(s, masts.length)); continue; }
    if (s.kind === 'lab') { lab = labSite(s); continue; }
    if (s.kind === 'quarry' || s.kind === 'chem' || s.kind === 'nest') continue; // the giants' dens are gone
    if (s.kind === 'bridgehead') { ground.town(s.x, s.z, s.r * 0.7, 20); continue; }
    if (s.kind === 'small') { city(s.x, s.z, 230, s.y, 0.45); s.name = (TOWN_NAMES.splice(Math.floor(R() * TOWN_NAMES.length), 1)[0] || 'CITY') + ' CITY'; cities.push(s); continue; }
    const t = s, y = t.y;
    towns.push({ x: t.x, z: t.z, y, r: t.r, kind: t.kind, name: TOWN_NAMES.splice(Math.floor(R() * TOWN_NAMES.length), 1)[0] || 'NOWHERE' });
    ground.town(t.x, t.z, t.r * 0.75, t.r * 0.4);
    open.push([t.x, t.z, y]);
    townLayout(t, y);
  }
  // ---- towns and villages, laid out along proper streets. Roads from outside come in down the main streets
  // (see route), every lot faces a street, and nothing is ever built on a road.
  function roadGap(x, z, m) {
    for (const r of roads) { const dx = r[2] - r[0], dz = r[3] - r[1], L = dx * dx + dz * dz || 1, tt = Math.max(0, Math.min(1, ((x - r[0]) * dx + (z - r[1]) * dz) / L)); if (Math.hypot(x - r[0] - dx * tt, z - r[1] - dz * tt) < m) return false; }
    return true;
  }
  function townLayout(t, y) {
    const streets = [];
    const street = (x0, z0, x1, z1) => { streets.push([x0, z0, x1, z1]); ground.road(x0, z0, x1, z1); };
    const dStreet = (x, z) => { let best = [1e9, 0, 0]; for (const q of streets) { const dx = q[2] - q[0], dz = q[3] - q[1], L = dx * dx + dz * dz || 1, tt = Math.max(0, Math.min(1, ((x - q[0]) * dx + (z - q[1]) * dz) / L)); const px = q[0] + dx * tt, pz = q[1] + dz * tt, d = Math.hypot(x - px, z - pz); if (d < best[0]) best = [d, px, pz]; } return best; };
    // a lot: clear of every road and street (and of other lots), facing its street
    const used = [];
    const lotOk = (x, z, r) => roadGap(x, z, r * 0.75 + 3) && dStreet(x, z)[0] > r * 0.75 + 3 && used.every((u) => Math.hypot(u[0] - x, u[1] - z) > u[2] + r) && Math.hypot(x - t.x, z - t.z) < t.r - 4;
    const face = (x, z) => { const [, px, pz] = dStreet(x, z); return Math.atan2(-(px - x), -(pz - z)); };
    const R0 = t.r * 0.98, cx = t.x, cz = t.z;
    if (t.kind === 'town') {
      // a grid: the high street and the cross street right through, back streets around the middle
      const G = 46, S2 = R0 * 0.62;
      street(cx - R0, cz, cx + R0, cz); street(cx, cz - R0, cx, cz + R0);
      for (const o of [-G, G]) { street(cx - S2, cz + o, cx + S2, cz + o); street(cx + o, cz - S2, cx + o, cz + S2); }
      // the square: a little park with a statue in one of the middle blocks
      const sq = [cx - G / 2, cz - G / 2];
      ground.town(sq[0], sq[1], 14, 4);
      at(sq[0], y - 0.2, sq[1], 3, 1.2, 3, { color: [0.6, 0.6, 0.58], tex: 3 });
      at(sq[0], y + 1, sq[1], 1, 3.2, 1, { color: [0.35, 0.45, 0.38], mat: 'metal', shape: 'cylY' });
      for (const [dx, dz] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) tree(sq[0] + dx, sq[1] + dz, 1.1);
      for (const [dx, dz, yw] of [[-6, 0, 0], [6, 0, 0], [0, -6, Math.PI / 2], [0, 6, Math.PI / 2]]) rot(sq[0] + dx, y, sq[1] + dz, [0, yw, 0], 0.6, 0.5, 2.4, { color: [0.4, 0.28, 0.18], solid: false });
      used.push([sq[0], sq[1], 17]);
      // the church, on a corner of the high street
      const ch = [cx + G / 2, cz - G / 2 - 2];
      at(ch[0], y - 0.5, ch[1], 12, 10, 18, { color: [0.72, 0.7, 0.64], tex: 3 });
      for (const sd of [-1, 1]) rot(ch[0] + sd * 3.4, y + 9.5 + 1.6, ch[1], [0, 0, -sd * 0.75], 9, 0.3, 18.6, { color: [0.3, 0.3, 0.33], solid: false });
      at(ch[0], y - 0.5, ch[1] + 10, 5, 20, 5, { color: [0.72, 0.7, 0.64], tex: 3 });
      at(ch[0], y + 19.5, ch[1] + 10, 3.6, 6, 3.6, { color: [0.3, 0.3, 0.32], shape: { taper: [1, 1] } });
      used.push([ch[0], ch[1] + 3, 15]);
      // shops along the high street and the cross street, houses everywhere else
      const kinds = ['gas', 'market', 'pharmacy', 'police', 'hardware', 'gunshop', 'market', 'pharmacy'];
      for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
      let shop = 0;
      for (const along of [-1, 1]) for (let k = 0; k < 2; k++) for (const sd of [-1, 1]) for (const axis of [0, 1]) {
        const d = 14 + k * 21 + (along > 0 ? 0 : 0), off = 13 * sd;
        const x = axis ? cx + off : cx + along * d, z = axis ? cz + along * d : cz + off;
        if (!lotOk(x, z, 9)) continue;
        const kind = kinds[shop % kinds.length]; shop++;
        if (kind === 'gas') { if (!lotOk(x, z, 12)) continue; gasStation(x, y, z); used.push([x, z, 13]); continue; }
        const w = 8.5, dd = 6.5, h = 4 + Math.floor(R() * 3) * 3.6;
        building(x - w, z - dd, x + w, z + dd, y, h, 1, kind); used.push([x, z, 10]);
      }
      // houses: walk every street and put one each side every 17 m or so
      for (const q of streets) {
        const L = Math.hypot(q[2] - q[0], q[3] - q[1]), ux = (q[2] - q[0]) / L, uz = (q[3] - q[1]) / L;
        for (let d = 9; d < L - 5; d += 16 + R() * 3) for (const sd of [-1, 1]) {
          const x = q[0] + ux * d - uz * sd * 13, z = q[1] + uz * d + ux * sd * 13;
          if (!lotOk(x, z, 7)) continue;
          used.push([x, z, 8]);
          const r = R();
          if (r < 0.08) { tree(x, z, 1.2); continue; }
          if (r < 0.13) { car(x, y, z, face(x, z), R() < 0.3); continue; }
          house(x, y, z, face(x, z));
        }
      }
      // parked cars along the high street
      for (let n = 0; n < 6; n++) { const d = (R() - 0.5) * 2 * (R0 - 10), sd = R() < 0.5 ? -1 : 1, ax = R() < 0.5; car(ax ? cx + sd * 4.2 : cx + d, y, ax ? cz + d : cz + sd * 4.2, ax ? 0 : Math.PI / 2, R() < 0.15); }
    } else {
      // a village: one street right through, houses facing it both sides, a shop, sometimes a chapel and a lane
      const ax = t.axis ? 1 : 0, u = ax ? [0, 1] : [1, 0], v = ax ? [1, 0] : [0, 1];
      street(cx - u[0] * R0, cz - u[1] * R0, cx + u[0] * R0, cz + u[1] * R0);
      const lane = R() < 0.6 ? (R() < 0.5 ? -1 : 1) * (12 + Math.floor(R() * 2) * 16) : null, lsd = R() < 0.5 ? -1 : 1;
      if (lane != null) street(cx + u[0] * lane, cz + u[1] * lane, cx + u[0] * lane + v[0] * lsd * 42, cz + u[1] * lane + v[1] * lsd * 42);
      let shopDone = false;
      for (const q of streets) {
        const L = Math.hypot(q[2] - q[0], q[3] - q[1]), ux = (q[2] - q[0]) / L, uz = (q[3] - q[1]) / L;
        for (let d = 8; d < L - 4; d += 15 + R() * 3) for (const sd of [-1, 1]) {
          const x = q[0] + ux * d - uz * sd * 12.5, z = q[1] + uz * d + ux * sd * 12.5;
          if (!shopDone && Math.abs(d - L / 2) < 12 && q === streets[0]) {
            if (!lotOk(x, z, 9)) continue;
            building(x - 8, z - 6, x + 8, z + 6, y, 4 + Math.floor(R() * 2) * 3.6, 1, ['market', 'pharmacy', 'hardware'][Math.floor(R() * 3)]);
            used.push([x, z, 10]); shopDone = true; continue;
          }
          if (!lotOk(x, z, 7)) continue;
          used.push([x, z, 8]);
          if (R() < 0.12) { tree(x, z, 1.1); continue; }
          house(x, y, z, face(x, z));
        }
      }
      if (R() < 0.45) { const x = cx - u[0] * 30 + v[0] * 22, z = cz - u[1] * 30 + v[1] * 22; if (lotOk(x, z, 9)) { at(x, y - 0.5, z, ax ? 9 : 14, 8, ax ? 14 : 9, { color: [0.72, 0.7, 0.64], tex: 3 }); at(x, y - 0.5, z, 3.5, 13, 3.5, { color: [0.72, 0.7, 0.64], tex: 3 }); at(x, y + 12.5, z, 2.6, 4, 2.6, { color: [0.3, 0.3, 0.32], shape: { taper: [1, 1] } }); } }
      if (R() < 0.6) car(cx + u[0] * (R() - 0.5) * 60 + v[0] * 4, y, cz + u[1] * (R() - 0.5) * 60 + v[1] * 4, ax ? 0 : Math.PI / 2, R() < 0.3);
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
    if (rt.pts.length < 14 || gs >= 22 || R() < 0.35) continue;
    const i = Math.floor(rt.pts.length / 2), [px, pz] = rt.pts[i], [qx, qz] = rt.pts[i + 1], a = Math.atan2(qz - pz, qx - px);
    const x = px - Math.sin(a) * 22, z = pz + Math.cos(a) * 22;
    if (!clear(x, z, 20) || !offRoad(x, z, 14) || wet(x, z, 30)) continue;
    const y = T.heightAt(x, z); T.flatten(x, z, 14, y, 14); ground.town(x, z, 12, 10); gasStation(x, y, z); open.push([x, z, y]); gs++;
  }
  // farms: a barn, a silo and a farmhouse out in the fields
  for (let n = 0, tries = 0; n < 90 && tries < 1700; tries++) {
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
  add([hx - 20, 0.1, hz - 20], [hx + 20, 0.12, hz + 20], { color: [0.4, 0.42, 0.44], noShadow: true, solid: false, tex: 3 });
  add([hx - 21, 0.1, hz + 18], [hx + 21, 18, hz + 20], { color: [0.62, 0.64, 0.66], tex: 5, mat: 'metal' });
  add([hx - 21, 0.1, hz - 22], [hx - 19, 18, hz + 20], { color: [0.62, 0.64, 0.66], tex: 5, mat: 'metal' });
  add([hx + 19, 0.1, hz - 22], [hx + 21, 18, hz + 20], { color: [0.62, 0.64, 0.66], tex: 5, mat: 'metal' });
  // a painted landing circle under the helicopter, and light strips down the walls
  for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; at(hx + Math.cos(a) * 7.5, 0.12, hz + Math.sin(a) * 7.5, 1.1, 0.015, 0.35, { color: [0.95, 0.78, 0.15], noShadow: true, solid: false }); }
  at(hx - 1.6, 0.12, hz, 0.5, 0.015, 4, { color: [0.92, 0.92, 0.9], noShadow: true, solid: false });
  at(hx + 1.6, 0.12, hz, 0.5, 0.015, 4, { color: [0.92, 0.92, 0.9], noShadow: true, solid: false });
  at(hx, 0.12, hz, 2.7, 0.015, 0.5, { color: [0.92, 0.92, 0.9], noShadow: true, solid: false });
  for (const x of [-18.9, 18.9]) for (const z of [-12, 0, 12]) at(hx + x, 3, hz + z, 0.15, 9, 0.5, { color: [1, 0.96, 0.88], emissive: 1, noShadow: true, solid: false });
  for (const x of [-14, -4, 6, 16]) at(hx + x, 4, hz + 17.9, 0.5, 9, 0.15, { color: [1, 0.96, 0.88], emissive: 1, noShadow: true, solid: false });
  for (const z of [-16, -6, 4, 14]) add([hx - 21, 17, hz + z - 0.4], [hx + 21, 18, hz + z + 0.4], { color: [0.3, 0.31, 0.33], mat: 'metal' });
  for (const x of [-12, 0, 12]) add([hx + x - 0.4, 16.6, hz - 20], [hx + x + 0.4, 17, hz + 18], { color: [1, 0.96, 0.85], emissive: 1, noShadow: true, solid: false });
  for (let s = 0; s < 4; s++) at(hx - 16 + s * 2.4, 0.1, hz + 16, 2, 1.2, 1.6, { color: [0.55, 0.42, 0.22], tex: 12 });
  at(hx + 15, 0.1, hz + 14, 3, 1.1, 1.2, { color: [0.75, 0.15, 0.1], mat: 'paint', shape: 0.08 });
  for (let s = -9; s <= 9; s++) for (const zz of [-19.6, 19.6]) at(hx + s * 2, 0.12, hz + zz, 1, 0.02, 0.4, { color: s % 2 ? [0.95, 0.75, 0.1] : [0.08, 0.08, 0.08], noShadow: true, solid: false });

  return { world, terrain: T, ground, roofs, burning, open, loot, roads, towns, cities, city: { x: cx, z: cz, r: CITY_R, y: cityY, iw: IW, il: IL, park: cityPark }, boro, bridges, grids, spire, fort, hospital, masts, airfield, lab, lairs, fobs: [spire, fort, airfield].filter(Boolean) };
}

// THE SPIRE: a tower 170 m tall with a landing bay cut into one side 70 m up, and a big flight deck sticking out over
// the street: three pads, a hangar, fuel, guns on every corner. Zombies can't get up there (they pile up at the bottom
// and the guns pick them off).
function buildSpire({ add, at }, x, z, base, w) {
  const S = Math.min(w - 2, 34), H = 172, BAY = 72, BH = 15, DEP = 20;
  const x0 = x - S / 2, x1 = x + S / 2, z0 = z - S / 2, z1 = z + S / 2;
  const CON = [0.42, 0.43, 0.45], DK = [0.22, 0.23, 0.25], YEL = [0.95, 0.75, 0.15], WH = [0.95, 0.95, 0.92];
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
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) at(px, base + 4, pz, 0.6, H - 6, 0.6, { color: [1, 0.75, 0.35], emissive: 0.7, noShadow: true, solid: false });
  // THE FLIGHT DECK: 84 m wide, 60 m out from the tower
  const floorY = base + BAY, DX = 42, DZ = 60;
  add([x - DX, floorY - 1.4, z0 - DZ], [x + DX, floorY + 0.3, z0 + DEP], { color: [0.2, 0.2, 0.22], tex: 7 });
  add([x - DX, floorY - 3.2, z0 - DZ], [x + DX, floorY - 1.4, z0 - DZ + 1.2], { color: DK, mat: 'metal' });        // the deck edge girder
  for (const sx of [-1, 1]) add([x + sx * DX - (sx > 0 ? 1.2 : 0), floorY - 3.2, z0 - DZ], [x + sx * DX + (sx < 0 ? 1.2 : 0), floorY - 1.4, z0], { color: DK, mat: 'metal' });
  // legs down to the street, with cross-bracing
  for (const lx of [-DX + 2, -14, 14, DX - 2]) for (const lz of [-DZ + 2, -28]) {
    add([x + lx - 1.3, base, z0 + lz - 1.3], [x + lx + 1.3, floorY - 1.4, z0 + lz + 1.3], { color: CON, tex: 3 });
  }
  for (const lz of [-DZ + 2, -28]) for (let k = 0; k < 4; k++) add([x - DX + 2, base + 14 + k * 14, z0 + lz - 0.4], [x + DX - 2, base + 15 + k * 14, z0 + lz + 0.4], { color: DK, mat: 'metal' });
  // pads: [centre x offset, centre z offset, half size]
  const PADS = [[8, -40, 11], [-24, -44, 9], [28, -14, 9]];
  const pads = PADS.map(([ox, oz, hs], n) => {
    const c = [x + ox, floorY + 0.55, z0 + oz];
    const box = add([c[0] - hs, floorY + 0.3, c[2] - hs], [c[0] + hs, floorY + 0.55, c[2] + hs], { color: [0.16, 0.16, 0.18], tex: 7, tag: 'pad' });
    add([c[0] - hs + 1, c[1], c[2] - hs + 1], [c[0] + hs - 1, c[1] + 0.02, c[2] + hs - 1], { color: n ? [0.9, 0.9, 0.88] : YEL, solid: false, noShadow: true });
    add([c[0] - hs + 1.6, c[1], c[2] - hs + 1.6], [c[0] + hs - 1.6, c[1] + 0.04, c[2] + hs - 1.6], { color: [0.16, 0.16, 0.18], solid: false, noShadow: true });
    const k = hs / 11;
    for (const [a, b] of [[[-4, -5], [-2.6, 5]], [[2.6, -5], [4, 5]], [[-2.6, -0.7], [2.6, 0.7]]]) add([c[0] + a[0] * k, c[1] + 0.04, c[2] + a[1] * k], [c[0] + b[0] * k, c[1] + 0.06, c[2] + b[1] * k], { color: WH, solid: false, noShadow: true });
    for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4; at(c[0] + Math.cos(a) * (hs - 0.4), floorY + 0.55, c[2] + Math.sin(a) * (hs - 0.4), 0.3, 0.22, 0.3, { color: n ? [0.4, 0.7, 1] : [0.3, 1, 0.4], emissive: 1, noShadow: true, solid: false }); }
    return { box, at: c, n };
  });
  // the hangar: a big shed on the west side of the deck, doors open to the south
  const hx0 = x - DX + 1, hx1 = x - 16, hz0 = z0 - 30, hz1 = z0 - 1, HH = 11;
  add([hx0, floorY + 0.3, hz1 - 1], [hx1, floorY + HH, hz1], { color: [0.55, 0.57, 0.6], tex: 5, mat: 'metal' });
  add([hx0, floorY + 0.3, hz0], [hx0 + 1, floorY + HH, hz1], { color: [0.55, 0.57, 0.6], tex: 5, mat: 'metal' });
  add([hx1 - 1, floorY + 0.3, hz0], [hx1, floorY + HH, hz1], { color: [0.55, 0.57, 0.6], tex: 5, mat: 'metal' });
  add([hx0 - 0.5, floorY + HH, hz0 - 0.5], [hx1 + 0.5, floorY + HH + 1.2, hz1 + 0.5], { color: [0.4, 0.42, 0.45], tex: 5, mat: 'metal' });
  add([hx0, floorY + HH - 2.2, hz0], [hx1, floorY + HH, hz0 + 0.6], { color: [0.35, 0.37, 0.4], mat: 'metal' });          // the door header
  for (const lx of [hx0 + 6, (hx0 + hx1) / 2, hx1 - 6]) at(lx, floorY + HH - 0.5, (hz0 + hz1) / 2, 0.5, 0.25, hz1 - hz0 - 4, { color: [1, 0.96, 0.85], emissive: 1, noShadow: true, solid: false });
  for (let s = 0; s < 10; s++) at(hx0 + 1 + s * ((hx1 - hx0 - 2) / 10) + 1, floorY + 0.32, hz0 + 0.4, (hx1 - hx0 - 2) / 10, 0.02, 0.6, { color: s % 2 ? YEL : [0.08, 0.08, 0.08], noShadow: true, solid: false });
  for (let s = 0; s < 3; s++) at(hx0 + 3 + s * 2.2, floorY + 0.3, hz1 - 3, 2, 1.3, 1.6, { color: [0.5, 0.4, 0.22], tex: 12 });
  at(hx1 - 4, floorY + 0.3, hz1 - 3, 3, 1.6, 1.4, { color: [0.75, 0.15, 0.1], mat: 'paint', shape: 0.08 });              // a tool chest
  at(x - DX + 6, floorY + HH + 3.2, hz0 + 0.2, 10, 2.2, 0.3, { color: [0.1, 0.1, 0.12], solid: false });
  at(x - DX + 6, floorY + HH + 3.2, hz0 - 0.05, 9, 1.6, 0.1, { color: [0.4, 0.8, 1], emissive: 0.9, noShadow: true, solid: false });
  // the bay in the tower: fuel, crates, a crane
  for (const fx of [x0 + 5, x0 + 9]) at(fx, floorY + 0.3, z0 + DEP - 3, 3, 4.5, 3, { color: [0.75, 0.22, 0.12], shape: 'cylY', mat: 'paint' });
  for (let k = 0; k < 4; k++) at(x1 - 5 - (k % 2) * 2.2, floorY + 0.3 + Math.floor(k / 2) * 1.3, z0 + DEP - 3, 2, 1.3, 1.6, { color: [0.5, 0.4, 0.22], tex: 12 });
  for (const lx of [x - 8, x, x + 8]) at(lx, floorY + BH - 0.6, z0 + DEP / 2, 0.6, 0.3, DEP - 2, { color: [1, 0.95, 0.85], emissive: 1, noShadow: true, solid: false });
  // a fuel farm along the east edge, and a crane
  for (let k = 0; k < 3; k++) at(x + DX - 3, floorY + 0.3, z0 - DZ + 6 + k * 5, 3.4, 3.2, 3.4, { color: [0.85, 0.82, 0.74], shape: 'cylY', mat: 'paint' });
  at(x + DX - 6, floorY + 0.3, z0 - DZ + 11, 1.2, 1.2, 14, { color: [0.75, 0.22, 0.12], mat: 'paint' });
  at(x + DX - 4, floorY + 0.3, z0 - 34, 0.8, 14, 0.8, { color: YEL, mat: 'paint' });
  at(x + DX - 4, floorY + 14, z0 - 40, 1, 1, 16, { color: YEL, mat: 'paint' });
  // a little control tower with a windsock, and sandbags round the guns
  { const tx = x + 30, tz = z0 - 30;
    at(tx, floorY + 0.3, tz, 6, 4, 4, { color: [0.3, 0.32, 0.3], tex: 3 });
    at(tx, floorY + 4.3, tz, 6.4, 2.4, 4.4, { color: [0.2, 0.35, 0.45], mat: 'glass', solid: false });
    at(tx, floorY + 6.7, tz, 6.8, 0.4, 4.8, { color: DK, mat: 'metal' });
    at(tx - 3, floorY + 7, tz - 2, 0.12, 4, 0.12, { color: [0.7, 0.7, 0.7], mat: 'metal' });
    at(tx - 3, floorY + 10.4, tz - 3.2, 0.6, 0.6, 2.2, { color: [1, 0.45, 0.1], shape: { taper: [1, 0.4] }, solid: false }); }
  // railings and edge lights all the way round
  for (const sx of [x - DX, x + DX]) add([sx - 0.1, floorY + 0.3, z0 - DZ], [sx + 0.1, floorY + 1.3, z0], { color: YEL, mat: 'paint', solid: false });
  add([x - DX, floorY + 0.3, z0 - DZ - 0.1], [x + DX, floorY + 1.3, z0 - DZ + 0.1], { color: YEL, mat: 'paint', solid: false });
  for (let k = 0; k <= 14; k++) at(x - DX + k * (2 * DX / 14), floorY + 1.3, z0 - DZ, 0.3, 0.3, 0.3, { color: [1, 0.3, 0.2], emissive: 1, noShadow: true, solid: false });
  for (const lx of [x - 20, x + 20]) { at(lx, floorY + 0.3, z0 - DZ + 2, 0.3, 9, 0.3, { color: DK, mat: 'metal' }); at(lx, floorY + 9.3, z0 - DZ + 2, 1.4, 0.4, 1.4, { color: [1, 0.92, 0.75], emissive: 1, noShadow: true, solid: false }); }
  // a big lit sign
  at(x, floorY + BH + 4, z0 - 0.3, 22, 4, 0.3, { color: [0.12, 0.12, 0.14], mat: 'metal', solid: false });
  at(x, floorY + BH + 4.4, z0 - 0.5, 20, 3.2, 0.1, { color: [1, 0.78, 0.2], emissive: 0.9, noShadow: true, solid: false });
  // guns on every corner of the deck
  const turrets = [[x - DX + 4, z0 - DZ + 3], [x + DX - 4, z0 - DZ + 3], [x - DX + 4, z0 - 34], [x + DX - 10, z0 - 3]].map(([tx, tz]) => {
    at(tx, floorY + 0.3, tz, 2, 1.4, 2, { color: [0.3, 0.32, 0.3], mat: 'metal' });
    for (const [dx, dz] of [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6]]) at(tx + dx, floorY + 0.3, tz + dz, dx ? 0.8 : 3.2, 0.9, dz ? 0.8 : 3.2, { color: [0.5, 0.45, 0.33], shape: 0.3, solid: false });
    return { pos: [tx, floorY + 2.4, tz], yaw: Math.PI, cd: 0, flash: 0 };
  });
  // where other helicopters park: in the hangar, at the back of the bay, and on the spare pads
  const parking = [
    { pos: [(hx0 + hx1) / 2, floorY + 0.3, (hz0 + hz1) / 2 + 1], yaw: 0, inside: true },
    { pos: [x, floorY + 0.3, z0 + DEP / 2 - 1], yaw: Math.PI / 2, inside: true },
    { pos: [...pads[1].at.slice(0, 2), pads[1].at[2]], yaw: 0.4, pad: 1 },
    { pos: [...pads[2].at.slice(0, 2), pads[2].at[2]], yaw: -0.5, pad: 2 },
  ];
  for (const pk of parking) pk.pos[1] = floorY + 0.55;
  const pc = pads[0].at;
  const spawns = [pads[1].at, pads[2].at, [x + 2, floorY + 0.55, z0 - 17]];         // where wingmen start
  return { id: 'spire', name: 'THE SPIRE', pos: [x, base, z], pad: pads[0].box, pads, padAt: pc, spawns, hp: 1, max: 1, turrets, foot: [x, base, z0 - 3], top: base + H, deck: { x0: x - DX, x1: x + DX, z0: z0 - DZ, z1: z0 + DEP, y: floorY }, parking };
}
