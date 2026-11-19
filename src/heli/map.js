// DEAD AIR: the open world. A city on a grid of streets (towers downtown, offices and flats round them, houses in the
// suburbs, warehouses in the industrial east), then countryside: fields, woods and roads. Four army bases (FOBs) sit
// round the edge, each with a helipad, a hangar and fuel, and there's a fuel pad on a downtown tower roof. The
// upgrade hangar scene is off on its own at HANGAR. Same seed every time, so friends playing together see the same
// world without sending it.
import { World, makeBox } from '../world.js';
import { compose } from '../math.js';

export const NB = 12, PITCH = 62, STREET = 16, HALF = (NB * PITCH) / 2;     // the city grid: 744 m across
export const WORLD = 820;                                                    // the map edge
export const HANGAR = [1700, 0, 0];
export const streetX = (k) => -HALF + k * PITCH;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const ASPH = [0.19, 0.19, 0.2], PAVE = [0.5, 0.49, 0.46], GRASS = [0.24, 0.32, 0.16], DIRT = [0.33, 0.3, 0.22], FIELD = [[0.42, 0.38, 0.2], [0.3, 0.36, 0.17], [0.38, 0.32, 0.22]];
const FACADES = [
  { tex: 13, col: [0.55, 0.32, 0.24] }, { tex: 13, col: [0.45, 0.28, 0.22] }, { tex: 6, col: [0.62, 0.6, 0.56] },
  { tex: 6, col: [0.45, 0.47, 0.5] }, { tex: 3, col: [0.55, 0.54, 0.5] }, { tex: 2, col: [0.4, 0.55, 0.62] }, { tex: 6, col: [0.7, 0.66, 0.58] },
];
const HOUSES = [[0.85, 0.8, 0.7], [0.7, 0.75, 0.82], [0.88, 0.78, 0.6], [0.75, 0.82, 0.72], [0.9, 0.88, 0.85], [0.8, 0.62, 0.55]];
const ROOFS = [[0.35, 0.18, 0.14], [0.22, 0.22, 0.25], [0.4, 0.3, 0.22]];
const CARS = [[0.6, 0.1, 0.08], [0.15, 0.25, 0.5], [0.75, 0.75, 0.72], [0.12, 0.12, 0.13], [0.5, 0.48, 0.3], [0.2, 0.4, 0.3], [0.85, 0.7, 0.15]];

// the bases: where they are, which way their gate faces (towards the city), and the road out to the map edge
export const FOB_DEFS = [
  { id: 'home', name: 'FOB HOME', pos: [0, 0, HALF + 95], out: [0, 1] },
  { id: 'north', name: 'FOB NORTH', pos: [-130, 0, -HALF - 95], out: [0, -1] },
  { id: 'east', name: 'FOB EAST', pos: [HALF + 95, 0, 120], out: [1, 0] },
  { id: 'west', name: 'FOB WEST', pos: [-HALF - 95, 0, -40], out: [-1, 0] },
];

export function buildWorld() {
  const world = new World(), R = rng(4242);
  const roofs = [], burning = [], fobs = [], roads = [], open = [];
  const add = (min, max, o = {}) => world.add(makeBox(min, max, { grid: false, edges: false, ...o }));
  const at = (x, y, z, sx, sy, sz, o) => add([x - sx / 2, y, z - sz / 2], [x + sx / 2, y + sy, z + sz / 2], o);
  // a box turned about its centre (collision keeps the upright bounds; pass solid: false for roofs and the like)
  const rot = (x, y, z, r, sx, sy, sz, o = {}) => {
    const c = Math.cos(r[1]), s = Math.sin(r[1]);
    const b = at(x, y, z, Math.abs(c) * sx + Math.abs(s) * sz, sy, Math.abs(s) * sx + Math.abs(c) * sz, o);
    b.scale = [sx, sy, sz];
    compose(b.model, b.center, r, b.scale);
    return b;
  };
  const car = (x, z, yaw, burn) => {
    const col = burn ? [0.08, 0.07, 0.06] : CARS[Math.floor(R() * CARS.length)];
    const c = Math.cos(yaw), s = Math.sin(yaw);
    rot(x, 0, z, [0, yaw, 0], 1.9, 0.75, 4.3, { color: col, shape: 0.2, mat: 'paint' });
    rot(x + 0.3 * s, 0.75, z + 0.3 * c, [0, yaw, 0], 1.7, 0.6, 2.1, { color: burn ? col : [0.1, 0.13, 0.16], shape: 0.15, mat: 'glass', solid: false });
    if (burn) burning.push([x, 1.2, z]);
  };
  const tree = (x, z, big = 1) => {
    const th = (3 + R() * 2) * big;
    at(x, 0, z, 0.5 * big, th, 0.5 * big, { color: [0.3, 0.22, 0.15], shape: 'cylY' });
    at(x, th - 0.8 * big, z, (4 + R() * 2) * big, (4 + R() * 1.5) * big, (4 + R() * 2) * big, { color: [0.16 + R() * 0.08, 0.26 + R() * 0.1, 0.11], shape: 'sphere', solid: false });
  };

  // ---- ground: grass and dirt everywhere, the city on its asphalt slab, fields and woods outside
  add([-1400, -1, -1400], [1400, 0, 1400], { color: GRASS, tex: 7 });
  add([-HALF - 8, -0.98, -HALF - 8], [HALF + 8, 0.02, HALF + 8], { color: ASPH, tex: 7, noShadow: true });
  // ring road round the city
  for (const [a, b] of [[[-HALF - 34, -HALF - 34], [HALF + 34, -HALF - 18]], [[-HALF - 34, HALF + 18], [HALF + 34, HALF + 34]], [[-HALF - 34, -HALF - 34], [-HALF - 18, HALF + 34]], [[HALF + 18, -HALF - 34], [HALF + 34, HALF + 34]]])
    add([a[0], -0.97, a[1]], [b[0], 0.03, b[1]], { color: ASPH, tex: 7, noShadow: true });
  for (let k = 0; k <= NB; k++) {
    add([streetX(k) - 0.12, 0.02, -HALF], [streetX(k) + 0.12, 0.04, HALF], { color: [0.75, 0.62, 0.2], noShadow: true, solid: false });
    add([-HALF, 0.02, streetX(k) - 0.12], [HALF, 0.04, streetX(k) + 0.12], { color: [0.75, 0.62, 0.2], noShadow: true, solid: false });
  }

  // ---- the city blocks
  const C = (NB - 1) / 2;
  for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
    const x0 = streetX(i) + STREET / 2, x1 = streetX(i + 1) - STREET / 2, z0 = streetX(j) + STREET / 2, z1 = streetX(j + 1) - STREET / 2;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0;
    const ring = Math.max(Math.abs(i - C), Math.abs(j - C));
    const r = R();
    let kind;
    if (ring < 1.6) kind = r < 0.8 ? 'tower' : 'mid';
    else if (ring < 3.6) kind = r < 0.1 ? 'park' : r < 0.18 ? 'lot' : r < 0.3 ? 'tower' : 'mid';
    else if (i >= NB - 2) kind = r < 0.15 ? 'lot' : 'industry';
    else kind = r < 0.14 ? 'park' : 'houses';
    const green = kind === 'park' || kind === 'houses';
    add([x0, 0, z0], [x1, 0.18, z1], { color: green ? GRASS : PAVE, tex: green ? 0 : 4 });
    const building = (bx, bz, sx, sz, h, roofOk = true, f = FACADES[Math.floor(R() * FACADES.length)]) => {
      const b = at(bx, 0.18, bz, sx, h, sz, { color: f.col, tex: f.tex });
      const top = 0.18 + h, pc = f.col.map((v) => v * 0.8);
      at(bx, top, bz - sz / 2 + 0.2, sx, 0.7, 0.4, { color: pc, tex: 3 });
      at(bx, top, bz + sz / 2 - 0.2, sx, 0.7, 0.4, { color: pc, tex: 3 });
      at(bx - sx / 2 + 0.2, top, bz, 0.4, 0.7, sz - 0.8, { color: pc, tex: 3 });
      at(bx + sx / 2 - 0.2, top, bz, 0.4, 0.7, sz - 0.8, { color: pc, tex: 3 });
      if (R() < 0.7) at(bx + (sx / 2 - 2.4) * (R() < 0.5 ? -1 : 1), top, bz + (R() - 0.5) * sz * 0.5, 2.2, 1.3, 1.6, { color: [0.62, 0.62, 0.6], tex: 5, mat: 'metal' });
      if (h > 22 && R() < 0.35) {
        const wx = bx + (sx / 2 - 3) * (R() < 0.5 ? -1 : 1), wz = bz + (sz / 2 - 3) * (R() < 0.5 ? -1 : 1);
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) at(wx + dx * 1.1, top, wz + dz * 1.1, 0.2, 2.6, 0.2, { color: [0.25, 0.2, 0.15] });
        at(wx, top + 2.6, wz, 3.2, 3, 3.2, { color: [0.42, 0.3, 0.2], shape: 'cylY', tex: 12 });
      }
      if (roofOk && h > 7 && h < 50 && sx >= 12 && sz >= 12) roofs.push({ box: b, top, x: bx, z: bz, sx, sz, h });
      return b;
    };
    if (kind === 'tower') {
      const s = W - 10 - R() * 6, h = (ring < 1.6 ? 50 : 34) + R() * 30;
      const b = building(cx, cz, s, s, h, false);
      if (R() < 0.5) at(cx, 0.18 + h, cz, 10, 0.1, 10, { color: [0.2, 0.2, 0.22], solid: false });
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) at(cx + dx * (W / 2 - 2), 0.18, cz + dz * (W / 2 - 2), 2.4, 0.8, 2.4, { color: [0.4, 0.38, 0.35], tex: 3 });
      b.tower = true;
    } else if (kind === 'mid') {
      const hw = (W - 3) / 2;
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (R() < 0.12) continue;
        const sx = hw - R() * 4, sz = hw - R() * 4;
        building(cx + dx * (W / 2 - sx / 2), cz + dz * (W / 2 - sz / 2), sx, sz, (ring < 2.5 ? 12 : 8) + R() * (ring < 2.5 ? 26 : 16));
      }
    } else if (kind === 'industry') {
      // a warehouse with a flat roof, plus silos or containers
      const wx = W - 6, wz = W * 0.55;
      building(cx, z0 + wz / 2 + 2, wx, wz, 9 + R() * 4, true, { tex: 5, col: [0.5 + R() * 0.15, 0.5, 0.48] });
      if (R() < 0.5) for (let n = 0; n < 3; n++) at(x0 + 8 + n * 9, 0.18, z1 - 8, 6, 14 + R() * 6, 6, { color: [0.7, 0.7, 0.68], shape: 'cylY', mat: 'paint' });
      else for (let n = 0; n < 6; n++) at(x0 + 6 + (n % 3) * 8, 0.18 + Math.floor(n / 3) * 2.6, z1 - 7, 6, 2.6, 2.5, { color: CARS[n % CARS.length], tex: 5, mat: 'metal' });
      at(x1 - 4, 0.18, z1 - 4, 1.6, 22, 1.6, { color: [0.45, 0.25, 0.18], tex: 13 });
    } else if (kind === 'houses') {
      // houses with pitched roofs and a tree in the garden
      const n = 3, cell = W / n;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        if (a === 1 && b === 1) { tree(x0 + cell * 1.5, z0 + cell * 1.5, 1.1); continue; }
        if (R() < 0.12) continue;
        const hx = x0 + cell * (a + 0.5), hz = z0 + cell * (b + 0.5), sx = cell - 5, sz = cell - 6, hh = 4 + R() * 2.5;
        const col = HOUSES[Math.floor(R() * HOUSES.length)], rc = ROOFS[Math.floor(R() * ROOFS.length)];
        at(hx, 0.18, hz, sx, hh, sz, { color: col, tex: 10 });
        const along = R() < 0.5, half = (along ? sx : sz) / 2 + 0.4, rise = 2.2, sl = Math.hypot(half, rise), ang = Math.atan2(rise, half);
        for (const sd of [-1, 1]) {
          if (along) rot(hx + sd * half / 2, 0.18 + hh + rise / 2 - 0.15, hz, [0, 0, -sd * ang], sl, 0.22, sz + 0.8, { color: rc, shape: 0.05, solid: false });
          else rot(hx, 0.18 + hh + rise / 2 - 0.15, hz + sd * half / 2, [sd * ang, 0, 0], sx + 0.8, 0.22, sl, { color: rc, shape: 0.05, solid: false });
        }
        at(hx, 0.18, hz + sz / 2 + 0.01, 1.1, 2.1, 0.06, { color: [0.3, 0.2, 0.14], solid: false, noShadow: true });
      }
    } else if (kind === 'park') {
      for (let t = 0; t < 9; t++) tree(x0 + 4 + R() * (W - 8), z0 + 4 + R() * (W - 8));
      at(cx, 0.18, cz, 3, 2.5, 3, { color: [0.6, 0.6, 0.58], tex: 3, shape: 'cylY' });
      open.push([cx, cz]);
    } else {
      for (let c = 0; c < 6; c++) car(x0 + 5 + (c % 3) * 12, z0 + 10 + Math.floor(c / 3) * 22, (R() - 0.5) * 0.4, R() < 0.1);
      open.push([cx, cz]);
    }
    for (const [dx, dz] of [[x0 + 0.8, z0 + 0.8], [x1 - 0.8, z1 - 0.8]]) {
      at(dx, 0.18, dz, 0.2, 7, 0.2, { color: [0.2, 0.2, 0.22], mat: 'metal' });
      at(dx, 7.1, dz, 0.6, 0.25, 0.6, { color: [1, 0.85, 0.55], emissive: R() < 0.55 ? 0.9 : 0, noShadow: true });
    }
  }
  // wrecks along the streets
  for (let n = 0; n < 110; n++) {
    const k = Math.floor(R() * (NB + 1)), along = -HALF + 10 + R() * (2 * HALF - 20), alongX = R() < 0.5, off = (R() - 0.5) * (STREET - 5);
    car(alongX ? along : streetX(k) + off, alongX ? streetX(k) + off : along, (alongX ? Math.PI / 2 : 0) + (R() - 0.5) * 0.9, R() < 0.15);
  }

  // ---- the countryside: fields and woods (kept off the roads and bases)
  const nearBase = (x, z, r) => FOB_DEFS.some((f) => Math.abs(x - f.pos[0]) < r && Math.abs(z - f.pos[2]) < r);
  const onRoad = (x, z) => FOB_DEFS.some((f) => (f.out[0] ? Math.abs(z - f.pos[2]) < 14 && Math.sign(x - f.pos[0]) === f.out[0] : Math.abs(x - f.pos[0]) < 14 && Math.sign(z - f.pos[2]) === f.out[1]));
  const outside = (x, z, m = 50) => Math.abs(x) > HALF + m || Math.abs(z) > HALF + m;
  for (let n = 0; n < 40; n++) {
    const x = (R() - 0.5) * 2 * (WORLD - 60), z = (R() - 0.5) * 2 * (WORLD - 60), sx = 50 + R() * 70, sz = 50 + R() * 70;
    if (!outside(x, z, 40 + Math.max(sx, sz) / 2) || nearBase(x, z, 110) || onRoad(x, z)) continue;
    add([x - sx / 2, 0, z - sz / 2], [x + sx / 2, 0.06, z + sz / 2], { color: FIELD[n % 3], noShadow: true, solid: false });
    open.push([x, z]);
  }
  for (let n = 0; n < 34; n++) {
    const x = (R() - 0.5) * 2 * (WORLD - 40), z = (R() - 0.5) * 2 * (WORLD - 40);
    if (!outside(x, z, 70) || nearBase(x, z, 110) || onRoad(x, z)) continue;
    for (let t = 0; t < 14; t++) { const tx = x + (R() - 0.5) * 50, tz = z + (R() - 0.5) * 50; if (!onRoad(tx, tz)) tree(tx, tz, 1.2 + R() * 0.5); }
  }
  // a few farms out there, with flat-roofed barns to land on
  for (let n = 0; n < 8; n++) {
    const x = (R() - 0.5) * 2 * (WORLD - 80), z = (R() - 0.5) * 2 * (WORLD - 80);
    if (!outside(x, z, 80) || nearBase(x, z, 120) || onRoad(x, z)) continue;
    const b = at(x, 0, z, 16, 8, 12, { color: [0.55, 0.18, 0.12], tex: 12 });
    roofs.push({ box: b, top: 8, x, z, sx: 16, sz: 12, h: 8, farm: true });
    at(x + 12, 0, z - 4, 4, 12, 4, { color: [0.7, 0.7, 0.66], shape: 'cylY', mat: 'paint' });
    open.push([x, z + 20]);
  }

  // ---- the bases
  for (const def of FOB_DEFS) fobs.push(buildFob(def, { add, at, rot, roads }));
  // a fuel pad on the tallest tower downtown (no hangar there, just fuel)
  let tallest = null;
  for (const b of world.boxes) if (b.tower && (!tallest || b.max[1] > tallest.max[1])) tallest = b;
  if (tallest) {
    const top = tallest.max[1], tx = tallest.center[0], tz = tallest.center[2];
    const pad = add([tx - 8, top, tz - 8], [tx + 8, top + 0.3, tz + 8], { color: [0.2, 0.2, 0.22], tag: 'pad' });
    for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; at(tx + Math.cos(t) * 8.6, top, tz + Math.sin(t) * 8.6, 0.3, 0.3, 0.3, { color: [1, 0.7, 0.2], emissive: 1, noShadow: true, solid: false }); }
    at(tx + 6, top + 0.3, tz - 6, 1.6, 2.2, 1.6, { color: [0.85, 0.3, 0.1], shape: 'cylY', mat: 'paint' });
    fobs.push({ id: 'roof', name: 'ROOFTOP FUEL', pos: [tx, top, tz], pad, padAt: [tx, top + 0.3, tz], fuelOnly: true, hp: 1, max: 1, turrets: [] });
  }

  // ---- the hangar (the upgrade screen)
  const [hx, , hz] = HANGAR;
  add([hx - 40, 0, hz - 40], [hx + 40, 0.1, hz + 40], { color: [0.36, 0.36, 0.38], tex: 3 });
  add([hx - 20, 0.1, hz - 20], [hx + 20, 0.12, hz + 20], { color: [0.22, 0.24, 0.26], noShadow: true, solid: false });
  add([hx - 21, 0.1, hz + 18], [hx + 21, 18, hz + 20], { color: [0.4, 0.42, 0.44], tex: 5, mat: 'metal' });
  add([hx - 21, 0.1, hz - 22], [hx - 19, 18, hz + 20], { color: [0.4, 0.42, 0.44], tex: 5, mat: 'metal' });
  add([hx + 19, 0.1, hz - 22], [hx + 21, 18, hz + 20], { color: [0.4, 0.42, 0.44], tex: 5, mat: 'metal' });
  for (const z of [-16, -6, 4, 14]) add([hx - 21, 17, hz + z - 0.4], [hx + 21, 18, hz + z + 0.4], { color: [0.3, 0.31, 0.33], mat: 'metal' });
  for (const x of [-12, 0, 12]) add([hx + x - 0.4, 16.6, hz - 20], [hx + x + 0.4, 17, hz + 18], { color: [1, 0.96, 0.85], emissive: 1, noShadow: true, solid: false });
  for (let s = 0; s < 4; s++) at(hx - 16 + s * 2.4, 0.1, hz + 16, 2, 1.2, 1.6, { color: [0.55, 0.42, 0.22], tex: 12 });
  at(hx + 15, 0.1, hz + 14, 3, 1.1, 1.2, { color: [0.75, 0.15, 0.1], mat: 'paint', shape: 0.08 });
  at(hx - 15, 0.1, hz - 8, 1.4, 1.6, 1.4, { color: [0.2, 0.3, 0.6], shape: 'cylY', mat: 'paint' });
  for (let s = -9; s <= 9; s++) for (const zz of [-19.6, 19.6]) at(hx + s * 2, 0.12, hz + zz, 1, 0.02, 0.4, { color: s % 2 ? [0.95, 0.75, 0.1] : [0.08, 0.08, 0.08], noShadow: true, solid: false });

  return { world, roofs, burning, fobs, roads, open };
}

// an army base: concrete, hesco walls with a gate towards the city, a helipad, a hangar shed, fuel tanks and a tower
function buildFob(def, { add, at, roads }) {
  const [bx, , bz] = def.pos, [ox, oz] = def.out;
  // which way is "out" (away from the city): the gate is on the other side
  const HESCO = [0.6, 0.55, 0.42];
  add([bx - 44, 0, bz - 38], [bx + 44, 0.2, bz + 38], { color: [0.48, 0.47, 0.44], tex: 3 });
  const wall = (x0, z0, x1, z1) => add([Math.min(x0, x1) - 1, 0.2, Math.min(z0, z1) - 1], [Math.max(x0, x1) + 1, 2.6, Math.max(z0, z1) + 1], { color: HESCO, tex: 4 });
  // four walls, each with a gap in the middle on the city side and the road side
  const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const [sx, sz] of sides) {
    const gate = (sx === -ox && sz === -oz) || (sx === ox && sz === oz);
    if (sz) { const z = bz + sz * 36; if (gate) { wall(bx - 42, z, bx - 9, z); wall(bx + 9, z, bx + 42, z); } else wall(bx - 42, z, bx + 42, z); }
    else { const x = bx + sx * 42; if (gate) { wall(x, bz - 36, x, bz - 9); wall(x, bz + 9, x, bz + 36); } else wall(x, bz - 36, x, bz + 36); }
  }
  const PAD = [bx, bz];
  const pad = add([PAD[0] - 11, 0.2, PAD[1] - 11], [PAD[0] + 11, 0.5, PAD[1] + 11], { color: [0.2, 0.2, 0.22], tex: 7, tag: 'pad' });
  add([PAD[0] - 10, 0.5, PAD[1] - 10], [PAD[0] + 10, 0.52, PAD[1] + 10], { color: [0.95, 0.75, 0.15], solid: false, noShadow: true });
  add([PAD[0] - 9.4, 0.5, PAD[1] - 9.4], [PAD[0] + 9.4, 0.54, PAD[1] + 9.4], { color: [0.2, 0.2, 0.22], solid: false, noShadow: true });
  for (const [a, b] of [[[-4, -5], [-2.6, 5]], [[2.6, -5], [4, 5]], [[-2.6, -0.7], [2.6, 0.7]]]) add([PAD[0] + a[0], 0.54, PAD[1] + a[1]], [PAD[0] + b[0], 0.56, PAD[1] + b[1]], { color: [0.95, 0.95, 0.92], solid: false, noShadow: true });
  for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; at(PAD[0] + Math.cos(t) * 11.6, 0.2, PAD[1] + Math.sin(t) * 11.6, 0.35, 0.3, 0.35, { color: [0.3, 1, 0.4], emissive: 1, noShadow: true, solid: false }); }
  // the hangar shed (on the far side from the gate), fuel tanks and tents
  const hxs = ox ? bx + ox * 28 : bx + 26, hzs = oz ? bz + oz * 26 : bz + 26;
  const sx = ox ? 12 : 22, sz = ox ? 22 : 12;
  add([hxs - sx / 2, 0.2, hzs - sz / 2], [hxs + sx / 2, 9, hzs + sz / 2], { color: [0.42, 0.44, 0.4], tex: 5, mat: 'metal' });
  for (const [x, z] of [[-30, 26], [-30, 18]]) at(bx + (ox ? -ox * 0 + x * (ox ? 0 : 1) : x), 0.2, bz + (oz ? z * -oz : z), 4, 3.4, 4, { color: [0.62, 0.62, 0.6], shape: 'cylY', mat: 'paint' });
  at(bx - (ox ? 0 : 28), 0.2, bz - (oz ? 0 : 26), 8, 3, 12, { color: [0.3, 0.34, 0.22], shape: 0.5, mat: 'cloth' });
  // the watch tower with its gun, by the gate
  const tx = bx - ox * 30 + (oz ? 18 : 0), tz = bz - oz * 28 + (ox ? 18 : 0);
  for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) at(tx + dx, 0.2, tz + dz, 0.3, 7, 0.3, { color: [0.3, 0.25, 0.18] });
  at(tx, 7.2, tz, 4, 0.3, 4, { color: [0.36, 0.3, 0.22] });
  // a flag
  at(bx + 16, 0.2, bz - 16, 0.15, 10, 0.15, { color: [0.8, 0.8, 0.8], mat: 'metal' });
  at(bx + 16.9, 8.6, bz - 16, 1.6, 1, 0.05, { color: [0.25, 0.4, 0.2], mat: 'cloth', solid: false });
  // the road out to the map edge
  const len = WORLD - Math.abs(ox ? bx : bz) + 40;
  const r0 = ox ? [bx + ox * 44, bz] : [bx, bz + oz * 38], r1 = [r0[0] + ox * len, r0[1] + oz * len];
  add([Math.min(r0[0], r1[0]) - (ox ? 0 : 7), -0.97, Math.min(r0[1], r1[1]) - (oz ? 0 : 7)], [Math.max(r0[0], r1[0]) + (ox ? 0 : 7), 0.03, Math.max(r0[1], r1[1]) + (oz ? 0 : 7)], { color: ASPH, tex: 7, noShadow: true });
  // and a road in from the city side
  const c0 = ox ? [bx - ox * 44, bz] : [bx, bz - oz * 38], c1 = ox ? [Math.sign(bx) * (HALF + 18), bz] : [bx, Math.sign(bz) * (HALF + 18)];
  add([Math.min(c0[0], c1[0]) - (ox ? 0 : 7), -0.97, Math.min(c0[1], c1[1]) - (oz ? 0 : 7)], [Math.max(c0[0], c1[0]) + (ox ? 0 : 7), 0.03, Math.max(c0[1], c1[1]) + (oz ? 0 : 7)], { color: ASPH, tex: 7, noShadow: true });
  roads.push({ fob: def.id, from: [r1[0] - ox * 30, r1[1] - oz * 30], to: [r0[0] - ox * 10, r0[1] - oz * 10] });
  return { ...def, pad, padAt: [PAD[0], 0.5, PAD[1]], hp: 1200, max: 1200, turrets: [{ pos: [tx, 8.7, tz], yaw: 0, cd: 0, flash: 0 }], gate: [bx - ox * 40, bz - oz * 36] };
}
