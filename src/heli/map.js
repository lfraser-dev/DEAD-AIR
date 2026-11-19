// DEAD AIR: the open world, made from a seed. Procedural hills and lakes (terrain.js), a dense city in the flattest
// valley (narrow streets between tall blocks: close quarters), villages out in the hills joined by roads, woods, and one
// base: THE SPIRE, a huge tower in the city with a landing bay jutting out of its side, high above the streets.
// Some buildings are worth raiding (shops, police, pharmacies...): send your team in from the roof or the street.
import { makeBox } from '../world.js';
import { compose } from '../math.js';
import { Terrain, GeoWorld, rng, WATER, HALF as TH } from './terrain.js';

export const WORLD = TH - 60;               // how far you can fly
export const HANGAR = [1900, 0, 0];         // the upgrade hangar scene, off the map
export const HALF = 0;                      // (unused now; kept for old imports)

const FACADES = [
  { tex: 13, col: [0.55, 0.32, 0.24] }, { tex: 13, col: [0.45, 0.28, 0.22] }, { tex: 6, col: [0.62, 0.6, 0.56] },
  { tex: 6, col: [0.45, 0.47, 0.5] }, { tex: 3, col: [0.55, 0.54, 0.5] }, { tex: 2, col: [0.4, 0.55, 0.62] }, { tex: 6, col: [0.7, 0.66, 0.58] },
];
const HOUSES = [[0.85, 0.8, 0.7], [0.7, 0.75, 0.82], [0.88, 0.78, 0.6], [0.75, 0.82, 0.72], [0.9, 0.88, 0.85], [0.8, 0.62, 0.55]];
const ROOFS = [[0.35, 0.18, 0.14], [0.22, 0.22, 0.25], [0.4, 0.3, 0.22]];
const CARS = [[0.6, 0.1, 0.08], [0.15, 0.25, 0.5], [0.75, 0.75, 0.72], [0.12, 0.12, 0.13], [0.5, 0.48, 0.3], [0.2, 0.4, 0.3], [0.85, 0.7, 0.15]];
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

export function buildWorld(seed = 1337) {
  const R = rng(seed * 7 + 3);
  const T = new Terrain(seed);
  const world = new GeoWorld(T);
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
  const tree = (x, z, big = 1, pine = false) => {
    const y = T.heightAt(x, z), th = (3 + R() * 2) * big;
    at(x, y - 0.3, z, 0.45 * big, th + 0.3, 0.45 * big, { color: [0.3, 0.22, 0.15], shape: 'cylY' });
    if (pine) for (let k = 0; k < 3; k++) at(x, y + th * 0.55 + k * 2.2 * big, z, (4.2 - k * 1.2) * big, 3 * big, (4.2 - k * 1.2) * big, { color: [0.1 + R() * 0.05, 0.2 + R() * 0.06, 0.12], shape: 'sphere', solid: k === 0 });
    else at(x, y + th - 0.8 * big, z, (4 + R() * 2) * big, (4 + R() * 1.5) * big, (4 + R() * 2) * big, { color: [0.16 + R() * 0.08, 0.26 + R() * 0.1, 0.11], shape: 'sphere', solid: false });
  };
  const ok = (x, z, r) => Math.abs(x) < WORLD - r && Math.abs(z) < WORLD - r;
  const flatTarget = (x, z) => Math.max(T.heightAt(x, z), WATER + 6);

  // ---- where things go: the city in the middle, towns round it
  let cx = 0, cz = 0;
  for (let i = 0; i < 40; i++) { const x = (R() - 0.5) * 400, z = (R() - 0.5) * 400; if (T.heightAt(x, z) > WATER + 4) { cx = x; cz = z; break; } }
  const CITY_R = 280, cityY = flatTarget(cx, cz);
  T.flatten(cx, cz, CITY_R, cityY, 90);
  const townSpots = [];
  for (let tries = 0; tries < 400 && townSpots.length < 7; tries++) {
    const a = R() * Math.PI * 2, d = 520 + R() * 420, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (!ok(x, z, 140) || T.heightAt(x, z) < WATER + 3) continue;
    if (townSpots.some((t) => Math.hypot(t[0] - x, t[1] - z) < 330)) continue;
    townSpots.push([x, z]);
  }
  for (const [x, z] of townSpots) { const y = flatTarget(x, z); T.flatten(x, z, 62, y, 60); towns.push({ x, z, y }); }
  // roads: from the city's edge out to each town, and a few between towns
  const roadTo = (ax, az, ay, bx, bz, by) => { T.road(ax, az, ay, bx, bz, by); roads.push([ax, az, bx, bz]); };
  for (const t of towns) {
    const a = Math.atan2(t.z - cz, t.x - cx), ex = cx + Math.cos(a) * (CITY_R - 10), ez = cz + Math.sin(a) * (CITY_R - 10);
    roadTo(ex, ez, cityY, t.x, t.z, t.y);
  }
  const ring = [...towns].sort((a, b) => Math.atan2(a.z - cz, a.x - cx) - Math.atan2(b.z - cz, b.x - cx));
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; if (Math.hypot(a.x - b.x, a.z - b.z) < 700 && R() < 0.7) roadTo(a.x, a.z, a.y, b.x, b.z, b.y); }

  // water: one big sheet at sea level shows wherever the land dips below it
  add([-TH, WATER - 40, -TH], [TH, WATER, TH], { color: [0.16, 0.27, 0.3], tex: 15, noShadow: true, noBullet: true });

  // ---- the city: narrow streets, tall blocks, an avenue every few blocks
  const lines = [];               // street centre lines along one axis (same both ways)
  { let p = -CITY_R + 6; let n = 0; while (p < CITY_R) { lines.push(p); p += (n % 4 === 3 ? 26 : 14) / 2 + 36 + (n % 4 === 2 ? 26 : 14) / 2; n++; } }
  const sw = (k) => (k % 4 === 3 ? 26 : 14);
  const Y = cityY;
  // streets: a dark tarmac sheet over the whole city, kerbs are the block plinths
  add([cx - CITY_R, Y - 1, cz - CITY_R], [cx + CITY_R, Y + 0.02, cz + CITY_R], { color: [0.17, 0.17, 0.18], tex: 7, noShadow: true });
  let spire = null;
  const midI = Math.floor(lines.length / 2) - 1;
  for (let i = 0; i < lines.length - 1; i++) for (let j = 0; j < lines.length - 1; j++) {
    const x0 = cx + lines[i] + sw(i) / 2, x1 = cx + lines[i + 1] - sw(i + 1) / 2, z0 = cz + lines[j] + sw(j) / 2, z1 = cz + lines[j + 1] - sw(j + 1) / 2;
    if (x1 - x0 < 10 || z1 - z0 < 10) continue;
    const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
    const dc = Math.hypot(bx - cx, bz - cz) / CITY_R;          // 0 in the middle, 1 at the edge
    if (dc > 0.98) continue;
    add([x0, Y, z0], [x1, Y + 0.18, z1], { color: [0.5, 0.49, 0.46], tex: 4 });
    const base = Y + 0.18;
    if (i === midI && j === midI) { spire = buildSpire({ add, at, R }, bx, bz, base, Math.min(W, D)); continue; }
    const r = R();
    if (r < 0.07 && dc > 0.2) {                                // a little park or square
      for (let t = 0; t < 5; t++) tree(x0 + 3 + R() * (W - 6), z0 + 3 + R() * (D - 6), 0.9);
      open.push([bx, bz, base]);
      continue;
    }
    if (r < 0.12) {                                            // a car park
      for (let c = 0; c < 6; c++) car(x0 + 5 + (c % 3) * ((W - 10) / 2), base, z0 + 6 + Math.floor(c / 3) * (D - 12), (R() - 0.5) * 0.3, R() < 0.12);
      open.push([bx, bz, base]);
      continue;
    }
    // 1-4 buildings filling the block, taller towards the middle
    const tall = 1 - dc;
    const split = R() < 0.55 ? 2 : 1;
    const parts = split === 2 ? (R() < 0.5 ? [[x0, z0, bx - 1.5, z1], [bx + 1.5, z0, x1, z1]] : [[x0, z0, x1, bz - 1.5], [x0, bz + 1.5, x1, z1]]) : [[x0, z0, x1, z1]];
    for (const [a0, b0, a1, b1] of parts) {
      const h = 10 + R() * 14 + tall * tall * (40 + R() * 60);
      building(a0 + 0.5, b0 + 0.5, a1 - 0.5, b1 - 0.5, base, h, dc);
    }
    // street clutter: wrecks and lamps on the corners
    if (R() < 0.5) car(x0 - sw(i) / 2 + (R() < 0.5 ? -3 : 3), Y, bz + (R() - 0.5) * D * 0.7, (R() - 0.5) * 0.6, R() < 0.18);
    at(x0 + 0.6, base, z0 + 0.6, 0.18, 6.5, 0.18, { color: [0.2, 0.2, 0.22], mat: 'metal' });
    at(x0 + 0.6, base + 6.5, z0 + 0.6, 0.55, 0.22, 0.55, { color: [1, 0.85, 0.55], emissive: R() < 0.5 ? 0.9 : 0, noShadow: true });
  }

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
    // neon down the side of some
    if (h > 18 && R() < 0.4) {
      const nc = NEON[Math.floor(R() * NEON.length)], len = Math.min(h * 0.5, 16), side = R() < 0.5;
      const px = side ? x0 - 0.25 : bx + (R() - 0.5) * sx * 0.4, pz = side ? bz + (R() - 0.5) * sz * 0.4 : z0 - 0.25;
      at(px, top - len - 2, pz, side ? 0.35 : 2.2, len, side ? 2.2 : 0.35, { color: [0.08, 0.08, 0.1], noShadow: true, solid: false });
      for (let k = 0; k < Math.floor(len / 2.2); k++) at(side ? px - 0.2 : px, top - len - 1.4 + k * 2.2, side ? pz : pz - 0.2, side ? 0.08 : 1.5, 1.3, side ? 1.5 : 0.08, { color: nc, emissive: 1, noShadow: true, solid: false });
    }
    const rec = { box: b, top, x: bx, z: bz, sx, sz, h, base, door: [bx, base, z0 - 0.5], stair: [hx, top, hz] };
    if (h > 7 && sx >= 12 && sz >= 12) roofs.push(rec);
    // some are worth raiding
    const types = Object.keys(LOOT_TYPES);
    if (kind || (h < 60 && R() < 0.14)) {
      const type = kind || (h > 40 ? (R() < 0.5 ? 'hospital' : 'flats') : types[Math.floor(R() * types.length)]);
      rec.loot = type; rec.floors = Math.max(1, Math.round(h / 3.6));
      const L = LOOT_TYPES[type];
      // a lit sign over the door
      at(bx, base + 3.6, z0 - 0.3, Math.min(sx - 2, 7), 1.1, 0.2, { color: L.col, emissive: 0.85, noShadow: true, solid: false });
      loot.push(rec);
    }
    return rec;
  }

  // ---- towns: a crossroads with shops, houses, a gas station and a church
  for (const t of towns) {
    const y = t.y;
    for (const [ax, az, bx, bz] of [[-60, 0, 60, 0], [0, -60, 0, 60]]) roads.push([t.x + ax, t.z + az, t.x + bx, t.z + bz]);
    const lots = [];
    for (const qx of [-1, 1]) for (const qz of [-1, 1]) for (const k of [0, 1]) lots.push([t.x + qx * (13 + k * 22), t.z + qz * 14, qx, qz], [t.x + qx * 14, t.z + qz * (36 + k * 0), qx, qz]);
    const kinds = ['gas', 'market', 'pharmacy', 'police', 'hardware', 'gunshop'];
    lots.forEach(([x, z], n) => {
      const r = R();
      if (n < 4) {                                            // shops on the main street (flat roofs: land on them)
        const kind = kinds[(n + Math.floor(R() * 6)) % kinds.length];
        if (kind === 'gas') {
          at(x, y, z, 14, 0.2, 10, { color: [0.4, 0.4, 0.42], tex: 4 });
          for (const [dx, dz] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) at(x + dx, y, z + dz, 0.4, 5, 0.4, { color: [0.85, 0.85, 0.85], mat: 'paint' });
          at(x, y + 5, z, 14, 0.6, 9, { color: [0.9, 0.9, 0.88], mat: 'paint' });
          at(x, y + 5.6, z, 14.2, 0.5, 9.2, { color: [1, 0.55, 0.1], emissive: 0.6 });
          for (const dx of [-2.5, 2.5]) at(x + dx, y, z, 0.8, 1.6, 0.6, { color: [0.85, 0.2, 0.15], mat: 'paint' });
          building(x - 7, z + 6, x + 7, z + 14, y, 4, 1, 'gas');
        } else building(x - 9, z - 7, x + 9, z + 7, y, 4 + Math.floor(R() * 3) * 3.6, 1, kind);
        return;
      }
      if (r < 0.15) { tree(x, z, 1.2); return; }
      // a house with a pitched roof
      const sx = 9, sz = 8, hh = 4 + R() * 2.5, col = HOUSES[Math.floor(R() * HOUSES.length)], rc = ROOFS[Math.floor(R() * ROOFS.length)];
      at(x, y, z, sx, hh, sz, { color: col, tex: 10 });
      const half = sx / 2 + 0.4, rise = 2.2, sl = Math.hypot(half, rise), ang = Math.atan2(rise, half);
      for (const sd of [-1, 1]) rot(x + sd * half / 2, y + hh + rise / 2 - 0.15, z, [0, 0, -sd * ang], sl, 0.22, sz + 0.8, { color: rc, shape: 0.05, solid: false });
      if (R() < 0.5) tree(x + 7, z + 6, 0.9);
    });
    // a church tower
    const ch = [t.x - 30, t.z + 40];
    at(ch[0], y, ch[1], 10, 9, 16, { color: [0.7, 0.68, 0.62], tex: 3 });
    at(ch[0], y, ch[1] - 9, 5, 20, 5, { color: [0.7, 0.68, 0.62], tex: 3 });
    at(ch[0], y + 20, ch[1] - 9, 3.4, 5, 3.4, { color: [0.3, 0.3, 0.32], shape: { taper: [1, 1] } });
    open.push([t.x, t.z, y]);
    for (let n = 0; n < 4; n++) car(t.x + (R() - 0.5) * 80, y, t.z + (R() < 0.5 ? -1 : 1) * 2.5, Math.PI / 2 + (R() - 0.5) * 0.5, R() < 0.2);
  }

  // ---- the countryside: woods, farms, wrecks on the roads
  const inTown = (x, z, m) => Math.hypot(x - cx, z - cz) < CITY_R + m || towns.some((t) => Math.hypot(x - t.x, z - t.z) < 80 + m);
  const nearRoad = (x, z) => roads.some(([ax, az, bx, bz]) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, tt = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)); return Math.hypot(x - ax - dx * tt, z - az - dz * tt) < 12; });
  for (let n = 0; n < 90; n++) {
    const x = (R() - 0.5) * 2 * (WORLD - 40), z = (R() - 0.5) * 2 * (WORLD - 40);
    if (inTown(x, z, 40)) continue;
    const pine = T.heightAt(x, z) > 40 || R() < 0.4;
    for (let k = 0; k < 16; k++) {
      const tx = x + (R() - 0.5) * 70, tz = z + (R() - 0.5) * 70, gy = T.heightAt(tx, tz);
      if (gy < WATER + 1.5 || T.slopeAt(tx, tz) > 0.35 || nearRoad(tx, tz) || inTown(tx, tz, 10)) continue;
      tree(tx, tz, 1.1 + R() * 0.6, pine);
    }
  }
  for (let n = 0; n < 10; n++) {
    const x = (R() - 0.5) * 2 * (WORLD - 100), z = (R() - 0.5) * 2 * (WORLD - 100), y = T.heightAt(x, z);
    if (inTown(x, z, 60) || y < WATER + 3 || T.slopeAt(x, z) > 0.15 || nearRoad(x, z)) continue;
    const b = at(x, y - 0.5, z, 16, 8.5, 12, { color: [0.55, 0.18, 0.12], tex: 12 });
    roofs.push({ box: b, top: y + 8, x, z, sx: 16, sz: 12, h: 8, base: y, farm: true, door: [x, y, z - 6.5], stair: [x - 6, y + 8, z - 4] });
    at(x + 12, y - 0.5, z - 4, 4, 12.5, 4, { color: [0.7, 0.7, 0.66], shape: 'cylY', mat: 'paint' });
    open.push([x, z + 20, T.heightAt(x, z + 20)]);
  }
  for (const [ax, az, bx, bz] of roads) for (let n = 0; n < 3; n++) {
    const t = R(), x = ax + (bx - ax) * t + (R() - 0.5) * 5, z = az + (bz - az) * t + (R() - 0.5) * 5;
    if (inTown(x, z, 0)) continue;
    car(x, T.heightAt(x, z), z, Math.atan2(bx - ax, bz - az) + (R() - 0.5) * 0.8, R() < 0.25);
  }

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

  return { world, terrain: T, roofs, burning, open, loot, roads, towns, city: { x: cx, z: cz, r: CITY_R, y: cityY }, spire, fobs: spire ? [spire] : [] };
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
