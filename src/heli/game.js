// DEAD AIR: a third-person helicopter shooter in an open world full of zombies.
//
// HANGAR: spend SCRAP on upgrades; every one is built onto the helicopter where you can see it.
// THE WORLD: made from a seed (terrain.js + map.js): hills, lakes, woods, farms, small towns and one big burning city,
// with roads between. Your only base is THE SPIRE: a pad sticking out of the side of a huge tower in the middle.
// RESCUES and SUPPLY DROPS turn up round the world (events.js). Zombies are just people (walkers, runners, crawlers and
// screamers) but there are LOTS, and they pile up on each other to climb walls and reach you (horde.js).
// YOUR TEAM (team.js): recruit people, give them guns and armour, land on a building with a sign and send them in (R).
// Watch them clear it floor by floor on the tracker, then pick them up on the roof or the street with what they found.
// FUEL: it runs down while you fly. Refuel at the Spire, or find it in buildings, or pay for a fuel drop (G).
// Friends can join online as door gunners (coop.js).
import { perspective, lookDir, mul, mat4, compose, clamp, damp, norm } from '../math.js';
import { StaticBatches } from '../batch.js';
import { Effects } from '../effects.js';
import { buildWorld, HANGAR, WORLD, LOOT_TYPES } from './map.js';
import { WATER } from './terrain.js';
import { Forest } from './trees.js';
import { Horde, TYPES, pickType } from './horde.js';
import { hullGeometries } from './hulls.js';
import { mountAt, AIRFRAMES, Chopper, chopperParts, qrot, qmat, droneParts } from './chopper.js';
import { SLOTS, SLOT, PAINTS, PAINT, HELIS, HELI_IDS, capEq, slotFits, loadSave, saveSave, statsFor, bars, CAMOS, CAMO, NOSEART, TAILART, TIPS, TRIMS, TINTS, BASE, BEDS, baseCut } from './data.js';
import { Story, CHAPTERS } from './story.js';
import { Music } from './music.js';
import { Director, crateParts, wreckParts, convoyParts, BOSSES, CARS } from './events.js';
import { ROLES, ROLE_IDS, WEAPONS, ARMORS, ITEMS, newMember, recruitCost, Raid, HAIR, randName } from './team.js';
import { makeTransport, code5, ZT, ZS, q1, q2, listServers } from './coop.js';
import { CSS } from './ui.js';

const FOG = [0.8, 0.74, 0.66], SKY = [0.26, 0.42, 0.68], SUN = [0.6, 0.48, 0.36];
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const CAMS = {
  all: [0.75, 0.22, 21, [0, 0.4, 1.5]], gun: [0.55, 0.02, 8.5, [0, -0.9, -3.6]], rockets: [1.15, 0.15, 10, [1.6, -0.5, 0.4]],
  bombs: [1.35, -0.12, 9, [0, -1.4, 0.4]], armor: [0.85, 0.15, 13, [0, -0.1, -0.6]], engine: [2.5, 0.38, 10, [0, 1.4, 1.6]],
  rotor: [0.8, 0.62, 19, [0, 2, 0.3]], door: [1.62, 0.08, 9, [1.1, 0, 0.6]], cabin: [-1.45, 0.12, 11, [-1, -0.2, 0.7]],
  fuel: [1.25, 0.05, 11, [1.2, -0.8, 0.4]], winch: [1.55, 0.1, 9, [1.2, 0, 0.6]], light: [0.4, -0.05, 7.5, [0, -1.3, -3.1]], turret: [0.9, -0.25, 8, [0, -1.6, 0.6]], medbay: [1.5, 0.05, 8, [1.2, 0.3, 1.2]],
  drops: [-1.5, -0.05, 8, [-1.5, -0.6, 0.6]], radio: [2.4, 0.25, 9, [0.25, 1.8, 4.2]], flir: [0.35, -0.02, 7.5, [0, -0.9, -3.4]],
  speaker: [1.2, 0.08, 10, [0, -0.6, 0]], nose: [0.55, 0.05, 8, [0, -0.3, -3.2]], tailart: [2.0, 0.1, 10, [0, 0.6, 4.8]], drone: [0.9, 0.35, 12, [0, 1.5, 2]], ammo: [0.5, 0.05, 7, [0, -0.9, -2.6]], repair: [-0.9, 0.12, 9, [0, 0, 0.5]], suppress: [2.5, 0.35, 9, [0, 1.3, 1.2]], flares: [2.2, 0.15, 8, [0, 0.2, 3.6]], beacon: [-2.2, 0.1, 8, [-0.6, 0.4, 3.4]], skids: [1.45, -0.12, 10, [0, -1.6, 0]], pods: [1.1, 0.02, 10, [1.8, -0.7, -0.6]], sight: [0.55, 0.02, 8.5, [0, -0.9, -3.6]], quiet: [2.5, 0.38, 10, [0, 1.4, 1.6]], tpod: [0.55, 0.02, 8.5, [0, -0.9, -3.6]], cooling: [0.55, 0.02, 8.5, [0, -0.9, -3.6]], hover: [0.4, 0.3, 12, [0, 0, -2]], crash: [-1.45, 0.12, 11, [-1, -0.2, 0.7]], sniper: [-1.5, 0.12, 8, [-0.9, 0, 1.4]], paint: [0.75, 0.22, 21, [0, 0.4, 1.5]],
};
const FLIGHT = { easy: 'EASY', assist: 'ASSIST', pro: 'PRO' };
const FRIEND_COLS = [[1, 0.8, 0.1], [0.3, 0.9, 1]];

// upgrade tiers get rarer colours as they go up: grey, green, blue, purple, orange
const RARITY = ['#9aa3ad', '#6fe08a', '#4fb4ff', '#b77bff', '#ff9a2e'];
const SLOT_KEYS = { speaker: 'V', light: 'L', drops: 'B', flares: 'X', beacon: 'N', nvg: 'Z', bombs: 'SPACE', rockets: 'R-CLICK', engine: 'SHIFT' };
// little "+60% HEALTH" chips: what changes if you fit this tier
function tierChips(a, b) {
  const out = [], pct = (x, y) => Math.round((y / x - 1) * 100);
  const fp = (s) => s.gun.rate * s.gun.dmg * (s.gun.splash ? 2.2 : 1) * (s.gun.barrels === 2 && s.gun.cannon ? 1.15 : 1) + s.rockets * s.rocketDmg / 12 + s.gunners * 150 * (s.doorMini ? 2 : s.doorGL ? 3 : 1) + s.bombs * (s.thermo ? 500 : 60) + Math.max(0, (s.drones || 0) - 1) * 130 * (s.ammo === 2 ? 1.3 : 1) + (s.ammo ? 120 : 0);
  const add = (v, txt) => { if (v) out.push(`<i class="${v > 0 ? 'up' : 'dn'}">${v > 0 ? '+' : ''}${txt}</i>`); };
  const h = pct(a.hp, b.hp); add(h, `${h}% HEALTH`);
  const f = pct(fp(a) || 1, fp(b) || 1); if (Math.abs(f) >= 3) add(f, `${f}% FIREPOWER`);
  if (b.seats !== a.seats) add(b.seats - a.seats, `${b.seats - a.seats} SEATS`);
  if (b.fuel !== a.fuel) add(b.fuel - a.fuel, `${Math.round((b.fuel / a.fuel - 1) * 100)}% FUEL`);
  if (b.rockets !== a.rockets) add(b.rockets - a.rockets, `${b.rockets - a.rockets} ROCKETS`);
  if (b.bombs !== a.bombs) add(b.bombs - a.bombs, `${b.bombs - a.bombs} BOMBS`);
  if ((b.flares || 0) !== (a.flares || 0)) add(b.flares - a.flares, `${b.flares - a.flares} FLASHES`);
  if ((b.beacons || 0) !== (a.beacons || 0)) add(b.beacons - a.beacons, `${b.beacons - a.beacons} BEACONS`);
  return out.slice(0, 4).join('');
}

// the paint job plus camo, nose art and tail markings, in the form the model wants
function paintFor(s) {
  const p = PAINT[s.paint] || PAINT.olive, tip = TIPS.find((q) => q.id === s.tips), trim = TRIMS.find((q) => q.id === s.trimCol), tint = TINTS.find((q) => q.id === s.tint);
  return { ...p, glass: tint && tint.col ? tint.col : null, trim: trim && trim.col ? trim.col : p.trim, tips: tip ? tip.col : null, tips2: tip ? tip.col2 : null, camo: (CAMO[s.camo] || {}).k || 0, nose: s.nose && s.nose !== 'none' ? s.nose : p.shark ? 'shark' : 'none', tailArt: s.tailArt || 'none', num: s.num };
}
// graphics levels: resolution, shadows, how far you can see, how far the trees go
const QLEVELS = [
  { res: 1, shadow: true, view: 2800, trees: 1100 },
  { res: 0.85, shadow: true, view: 2600, trees: 1000 },
  { res: 0.72, shadow: true, view: 2300, trees: 850 },
  { res: 0.72, shadow: false, view: 2100, trees: 750 },
  { res: 0.6, shadow: false, view: 1700, trees: 600 },
  { res: 0.5, shadow: false, view: 1300, trees: 420 },
];
const GFXNAME = { auto: 'AUTO', low: 'LOW (FAST)', potato: 'POTATO (FASTEST)' };
const GFXNEXT = { auto: 'low', low: 'potato', potato: 'auto' };
// where the pilot's eyes are in each aircraft (for the cockpit camera)
const SEATS = { warhorse: [0.3, 0.25, -2.6], hornet: [0, 0.15, -0.9], reaper: [0, 0.65, -3.0], kestrel: [0.42, 0.45, -3.2], viper: [0, 0.75, -2.6], huey: [0.4, 0.35, -2.4], seaking: [0.42, 0.45, -3.9], osprey: [0.42, 0.45, -4.8], harrier: [0, 0.95, -3.3], alligator: [0, 0.65, -2.9], warthog: [0, 1.0, -3.5], spectre: [0.5, 0.5, -7.2], mule: [0.5, 0.45, -6.0] };
const seatFor = (id) => SEATS[id] || SEATS.warhorse;
// which tab of the hangar each upgrade is on
const TABS = {
  weapons: ['gun', 'rockets', 'bombs', 'pods', 'sniper', 'racks', 'hardpoints', 'door', 'ammo', 'cooling', 'sight', 'tpod'],
  armour: ['armor', 'crash', 'repair', 'suppress', 'quiet', 'skids', 'flares'],
  flight: ['engine', 'rotor', 'fuel', 'hover', 'flaps', 'airbrake', 'reheat', 'gear', 'radio'],
  kit: ['cabin', 'winch', 'medbay', 'drops', 'flir', 'light', 'nvg'],
  looks: [],
};
const TABNAME = { weapons: '🔫 GUNS', armour: '🛡 ARMOUR', flight: '✈ FLIGHT', kit: '⛑ CREW', looks: '🎨 LOOKS' };
const DECOR = {
  camo: { list: CAMOS, own: 'camos', cur: 'camo', name: 'CAMO', icon: '▦' },
  nose: { list: NOSEART, own: 'noses', cur: 'nose', name: 'NOSE ART', icon: '☠' },
  tailart: { list: TAILART, own: 'tails', cur: 'tailArt', name: 'TAIL MARKINGS', icon: '#' },
  trim: { list: TRIMS, own: 'trimsOwn', cur: 'trimCol', name: 'TRIM COLOUR', icon: '◧' },
  tips: { list: TIPS, own: 'tipsOwn', cur: 'tips', name: 'ROTOR TIPS', icon: '✲' },
  tint: { list: TINTS, own: 'tintsOwn', cur: 'tint', name: 'WINDOW TINT', icon: '◫' },
};

export class HeliGame {
  constructor({ renderer, sounds, canvas, onExit, isDev }) {
    this.r = renderer; this.snd = sounds; this.canvas = canvas; this.onExit = onExit; this.isDev = isDev || (() => false);
    this.r.registerShapes(hullGeometries());
    this.active = false; this.mode = 'off';
    this.save = loadSave();
    this.keys = new Set(); this.hitKeys = new Set(); this.btn = new Set(); this.clk = new Set();
    this.mx = 0; this.my = 0; this.locked = false; this.softUnlock = false;
    this.sel = 'all'; this.install = {};
    this.cam = { yaw: 0.75, pitch: 0.22, dist: 21, tgt: [0, 0.4, 1.5], dyaw: 0 };
    this.proj = mat4(); this.view = mat4(); this.vp = mat4();
    this.t = 0;
    this.ui();
    this.listen();
  }

  // ---------------------------------------------------------------- set up
  load(seed) {
    if (seed == null) { this.save = this.save || loadSave(); if (!this.save.seed) { this.save.seed = 1 + Math.floor(Math.random() * 99999); saveSave(this.save); } seed = this.save.seed; }
    if (this.map && this.map.seed === seed) return;
    const t0 = performance.now();
    if (this.terrain) { this.terrain.dispose(this.r); this.forest.dispose(this.r); this.batches.clear(); }
    this.map = buildWorld(seed); this.map.seed = seed;
    this.terrain = this.map.terrain;
    const G = this.map.ground;
    this.r.setGround(G.data, G.size, G.x0, G.z0, G.span);
    this.r.setRoads([], WATER);
    { const g = this.map.grids; this.r.setCityGrids(g.a.flat(), g.b.flat()); }
    this.forest = new Forest(this.map);
    this.map.world.trees = this.forest;
    this.mapImg = null;
    { const C = this.map.city, e = [C.x, C.y + 150, C.z]; this.terrain.stream(this.r, e, 2900, 99999); this.forest.stream(this.r, e, 99999); }
    this.raid = null;
    this.world = this.map.world;
    this.fobs = this.map.fobs;
    this.fx = new Effects(this.world); this.fx.max = 1400;
    this.horde = new Horde(this.world, this.fx);
    this.batches = new StaticBatches(this.r);
    this.batches.build(this.world, () => 0);
    this.live = this.world.boxes.filter((b) => !b.batched && !b.hidden);
    const lo = this.r.meshesLo;
    this.zBatches = { box: this.r.makeBatch(this.r.cube), sphere: this.r.makeBatch(lo.sphere), cyl: this.r.makeBatch(lo.cyl), cylY: this.r.makeBatch(lo.cylY) };
    this.r.registerShapes(hullGeometries());
    this.smokeBatch = this.r.makeBatch(lo.sphere);
    this.smokeData = new Float32Array(32 * 1200);
    this.smokes = [];
    // smoke columns over the burning city: a few roofs, fixed for everyone
    let sd = 99; const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
    this.plumes = [];
    for (let i = 0; i < 9; i++) { const r = this.map.roofs[Math.floor(rnd() * this.map.roofs.length)]; if (r) this.plumes.push([r.x, r.top + 1, r.z, 0.7 + rnd() * 0.6]); }
    for (const b of this.map.burning) if (rnd() < 0.35) this.plumes.push([b[0], b[1], b[2], 0.35]);
    this.heli = new Chopper();
    this.director = new Director();
    this.syncStoryMap();
    this.loadMs = Math.round(performance.now() - t0);
  }
  get time() { return this.run ? this.run.t : 0; }
  // the bits of the story that change the world: Fort Calder (ours or not), the masts (working or not)
  syncStoryMap() {
    const st = this.save.story || {};
    if (this.map.fort) this.map.fort.locked = !st.fort;
    for (const m of this.map.masts || []) m.on = (st.masts || []).includes(m.n);
    this.fobs = this.map.fobs;
  }
  storyHit(k, v) { if (this.story && !this.client) this.story.hit(this, k, v); }
  saveNow() { saveSave(this.save); }
  // Spire Control on the radio: a box bottom-left for a few seconds, and in the feed
  radio(text, dur = 9) {
    const r = this.$('radio'); if (!r) return;
    r.innerHTML = `<b>📻 SPIRE CONTROL</b>${text}`;
    r.classList.remove('hidden'); r.style.opacity = 1;
    clearTimeout(this.radioT); this.radioT = setTimeout(() => { r.style.opacity = 0; setTimeout(() => r.classList.add('hidden'), 600); }, dur * 1000);
    this.snd.tone?.(900, 1300, 0.12, 0.08, 'square');
    if (this.nfx) this.nfx.push(['R', text, dur]);
  }
  // people living at the Spire, and how many of them have a bed (only they go out scavenging)
  population() { return this.save.rescued || 0; }
  workers() { return Math.min(this.population(), BEDS[this.save.base.bunks || 0]); }
  income() { return Math.floor(this.workers() / 10) * 12; }        // scrap a minute
  fobById(id) { return this.fobs.find((f) => f.id === id); }
  groundAt(x, z) { const h = this.world.raycast([x, 700, z], [0, -1, 0], 800); return h ? h.point[1] : 0; }

  open() {
    this.load();
    this.active = true;
    this.save = loadSave();
    if (!this.save.seed) { this.save.seed = this.map.seed; saveSave(this.save); } else this.load();
    this.setSky(true);
    this.session = null;
    this.toHangar();
    this.root.classList.remove('hidden');
  }

  close() {
    this.stopAudio();
    this.stopCoop();
    if (document.pointerLockElement) document.exitPointerLock();
    this.active = false; this.mode = 'off'; this.session = null;
    this.root.classList.add('hidden'); this.root.classList.remove('da-gunner', 'da-wing');
    this.setSky(false);
    saveSave(this.save);
    this.onExit?.();
  }

  // ---- time of day: 0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk. A day lasts 12 minutes (nights go a bit quicker).
  // At night it's dark (stars, a moon, lit windows and neon across the city), and there are more of them, and faster.
  dayTick(dt) {
    const was = this.night || 0;
    this.tod = ((this.tod ?? 0.3) + (dt / 720) * (1 + was * 0.5)) % 1;
    this.applyDay();
    if (was < 0.5 && this.night >= 0.5) { this.banner('NIGHT FALLS', 'THEY\'RE FASTER IN THE DARK · AND THERE ARE MORE OF THEM · ⚙ +50%', 'r', 3); this.snd.fail?.(); }
    if (was >= 0.5 && this.night < 0.5) this.banner('DAWN', 'YOU MADE IT THROUGH THE NIGHT', 'g', 2.5);
  }
  applyDay(on = true) {
    const r = this.r, gl = r.gl;
    if (!on) { r.setDay(1, 0, 1, [1, 1, 1], 0); this.night = 0; this.setSky(true); return; }
    const t = this.tod ?? 0.36, th = (t - 0.25) * Math.PI * 2, el = Math.sin(th);
    const sun = norm([Math.cos(th), el, 0.38]);
    const dayK = clamp((el + 0.1) / 0.3, 0, 1), dk = dayK * dayK * (3 - 2 * dayK);
    const gold = dk * (1 - clamp((el - 0.04) / 0.38, 0, 1));
    const mix3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    const tint = mix3([0.5, 0.62, 1.0], mix3([1, 1, 1], [1.0, 0.6, 0.34], gold), dk);
    this.night = 1 - dk;
    // night vision: when it's dark, everything comes up bright and green
    const nv = this.S && this.S.nvg && this.nvgOn !== false && this.mode !== 'hangar' ? clamp((1 - dk) * 1.6, 0, 1) : 0;
    this.nvNow = nv;
    r.setDay(dk + (1 - dk) * 0.1, (1 - dk) * (1 - 0.75 * nv), 0.2 + 0.8 * dk + nv * 0.75, mix3(tint, [0.42, 1.15, 0.45], nv), 1);
    const sky = mix3(mix3([0.012, 0.02, 0.05], mix3(SKY, [0.3, 0.28, 0.45], gold), dk), [0.07, 0.2, 0.08], nv);
    const fog = mix3(mix3([0.03, 0.04, 0.075], mix3(FOG, [0.92, 0.6, 0.42], gold), dk), [0.12, 0.3, 0.13], nv);
    gl.useProgram(r.prog);
    r.fogColor = fog; gl.uniform3fv(r.u.uFogColor, fog); gl.uniform3fv(r.u.uSkyTop, sky);
    r.sunDir = el > -0.02 ? sun : sun.map((v) => -v); gl.uniform3fv(r.u.uSunDir, r.sunDir);
  }
  clock() { const m = Math.floor(((this.tod ?? 0.3) * 24 * 60)) % 1440; return `${this.night > 0.5 ? '☾' : '☀'} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

  setSky(on) {
    const gl = this.r.gl; gl.useProgram(this.r.prog);
    this.r.fogColor = on ? [...FOG] : [0.86, 0.89, 0.93];
    gl.uniform3fv(this.r.u.uFogColor, this.r.fogColor);
    gl.uniform3fv(this.r.u.uSkyTop, on ? SKY : [0.48, 0.64, 0.86]);
    const sd = on ? SUN : [0.45, 0.8, 0.38], l = Math.hypot(...sd);
    this.r.sunDir = sd.map((v) => v / l);
    gl.uniform3fv(this.r.u.uSunDir, this.r.sunDir);
    this.sunNow = null;
  }

  // ---------------------------------------------------------------- input
  listen() {
    const flying = () => this.mode === 'fly' || this.mode === 'gunner' || this.mode === 'wing';
    addEventListener('keydown', (e) => {
      if (!this.active || e.target?.tagName === 'INPUT') return;
      e.stopImmediatePropagation();
      if (flying() && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.hitKeys.add(e.code);
      this.keys.add(e.code);
      if (this.mode === 'hangar' && e.code === 'Escape') { if (this.panel) this.closePanel(); else if (this.client && this.client.wing) this.deploy(); else this.close(); }
      if (this.mode === 'hangar' && e.code === 'Enter' && !this.panel) this.deploy();
      if (flying() && e.code === 'Escape') { if (this.panel) this.closePanel(); else this.pause(true); }
      if (this.mode === 'fly' && e.code === 'KeyT') { if (this.panel) this.closePanel(); else this.openTeam(); }
      if (this.mode === 'hangar' && e.code === 'KeyT') { if (this.panel) this.closePanel(); else this.openTeam(); }
      // taking off again grabs the mouse back
      if ((this.mode === 'fly' || this.mode === 'wing') && !this.locked && !this.panel && ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'].includes(e.code)) this.lock();
    }, true);
    addEventListener('keyup', (e) => { this.keys.delete(e.code); if (this.active) e.stopImmediatePropagation(); }, true);
    addEventListener('blur', () => { this.keys.clear(); this.btn.clear(); });
    addEventListener('mousedown', (e) => {
      if (!this.active || e.target !== this.canvas) return;
      e.stopImmediatePropagation();
      if (flying() && !this.locked) { if (!this.panel) this.lock(); return; }
      this.btn.add(e.button); this.clk.add(e.button);
      if (this.mode === 'hangar') this.drag = e.clientX;
    }, true);
    addEventListener('mouseup', (e) => { this.btn.delete(e.button); this.drag = null; if (this.active) e.stopImmediatePropagation(); }, true);
    addEventListener('mousemove', (e) => {
      if (!this.active) return;
      if (this.locked) {
        if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
        this.mx += e.movementX; this.my += e.movementY;
      } else if (this.drag != null) { this.cam.dyaw -= (e.clientX - this.drag) * 0.008; this.drag = e.clientX; }
      e.stopImmediatePropagation();
    }, true);
    addEventListener('wheel', (e) => { if (this.active) { e.stopImmediatePropagation(); if (this.mode === 'hangar') this.cam.zoom = clamp((this.cam.zoom || 1) * (e.deltaY > 0 ? 1.1 : 0.9), 0.6, 1.6); } }, { capture: true, passive: true });
    addEventListener('contextmenu', (e) => { if (this.active && e.target === this.canvas) e.preventDefault(); }, true);
    document.addEventListener('pointerlockchange', (e) => {
      if (!this.active) return;
      e.stopImmediatePropagation();
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked) this.softUnlock = false;
      else if (flying() && !this.softUnlock && !this.panel) this.pause(true);
    }, true);
  }
  lock() { try { const p = this.canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ } }
  unlockSoft() { if (this.locked) { this.softUnlock = true; document.exitPointerLock(); } }
  key(c) { return this.keys.has(c); }
  hit(c) { return this.hitKeys.has(c); }

  // ---------------------------------------------------------------- the DOM
  $(id) { return this.root.querySelector(`[data-da="${id}"]`); }
  ui() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
    const root = document.createElement('div');
    root.id = 'da-root'; root.className = 'hidden';
    root.innerHTML = `
      <div class="da-hangar" data-da="hangar">
        <div class="da-title"><b>DEAD AIR</b><span>HANGAR · UPGRADE YOUR CHOPPER</span></div>
        <div class="da-scrap" data-da="scrap"></div>
        <div class="da-slots" data-da="slots"></div>
        <div class="da-tiers" data-da="tiers"></div>
        <div class="da-stats" data-da="stats"></div>
        <div class="da-opts" data-da="opts"></div>
        <div class="da-msg" data-da="msg"></div>
        <button class="da-back" data-da="back" type="button">◀ TITLE</button>
        <button class="da-teambtn" data-da="teambtn" type="button">👥 TEAM</button>
        <button class="da-spirebtn" data-da="spirebtn" type="button">🏢 THE SPIRE</button>
        <button class="da-netbtn" data-da="netbtn" type="button">🌐 ONLINE</button>
        <button class="da-deploy" data-da="deploy" type="button">TAKE OFF ▶</button>
      </div>
      <div class="da-hud hidden" data-da="hud">
        <canvas class="da-pit hidden" data-da="pit"></canvas><div class="da-dmg" data-da="dmg"></div><div class="da-white" data-da="white"></div>
        <div data-da="marks"></div>
        <div class="da-cross" data-da="cross"></div><div class="da-hit" data-da="hit"></div>
        <div class="da-evs" data-da="evs"></div>
        <div class="da-raid hidden" data-da="raid"></div>
        <canvas class="da-map" data-da="map" width="190" height="190"></canvas>
        <canvas class="da-bigmap hidden" data-da="bigmap" width="620" height="620"></canvas>
        <div class="da-boss hidden" data-da="boss">TITAN<i></i></div>
        <div class="da-banner" data-da="banner"><b></b><span></span></div>
        <div class="da-warn hidden" data-da="warn"></div>
        <div class="da-feed" data-da="feed"></div>
        <div class="da-radio hidden" data-da="radio"></div>
        <div class="da-help" data-da="help"></div>
        <div class="da-tut hidden" data-da="tut"></div>
        <div class="da-left">
          <div class="da-meter fuel" data-da="fuelm" style="--c:#ff9f3a">FUEL <b data-da="fueltxt"></b><i></i></div>
          <div class="da-meter hidden" data-da="shm" style="--c:#5ad8ff">SHIELD<i></i></div>
          <div class="da-meter" data-da="hpm" style="--c:#7dff9a">CHOPPER<i></i></div>
          <div class="da-meter" data-da="heatm" style="--c:#ffcf3a">GUN HEAT<i></i></div>
          <div class="da-meter hidden" data-da="boostm" style="--c:#8fd0ff">AFTERBURNER<i></i></div>
        </div>
        <div class="da-status" data-da="status"></div>
        <div class="da-acts" data-da="acts"></div>
        <div class="da-flight"><span data-da="alt"></span><span data-da="spd"></span></div>
        <div class="da-right" data-da="right"></div>
        <div class="da-click hidden" data-da="click">CLICK TO FLY</div>
        <button class="da-tbtn" data-da="tbtn" type="button"><kbd>T</kbd> TEAM</button>
      </div>
      <div class="da-panel hidden" data-da="panel"></div>
      <div class="da-card hidden" data-da="pause"></div>
      <div class="da-card hidden" data-da="end"></div>
      <div class="da-join hidden" data-da="join"></div>`;
    document.body.append(root);
    this.root = root;
    this.$('back').onclick = () => { this.snd.button?.(); this.close(); };
    this.$('deploy').onclick = () => this.deploy();
    this.$('teambtn').onclick = () => this.openTeam();
    this.$('spirebtn').onclick = () => this.openSpire();
    this.$('netbtn').onclick = () => this.openOnline();
    this.$('tbtn').onclick = () => this.openTeam();
    this.$('raid').addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-r]'); if (b && !b.disabled) { e.preventDefault(); this.raidCmd(b.dataset.r); } });
  }
  price(c, heli) { return Math.round(c * baseCut(this.save, heli) / 10) * 10; }
  flash(t, ms = 1800) { const m = this.$('msg'); m.textContent = t; m.style.opacity = 1; clearTimeout(this.msgT); this.msgT = setTimeout(() => { m.style.opacity = 0; }, ms); }

  // ---------------------------------------------------------------- hangar
  toHangar() {
    this.mode = 'hangar';
    this.stopAudio();
    if (document.pointerLockElement) { this.softUnlock = true; document.exitPointerLock(); }
    for (const k of ['hud', 'pause', 'end', 'join']) this.$(k).classList.add('hidden');
    this.closePanel();
    this.$('hangar').classList.remove('hidden');
    this.$('deploy').textContent = this.session ? 'TAKE OFF ▶' : 'DEPLOY ▶';
    this.hangarHeli = this.hangarHeli || new Chopper();
    this.hangarHeli.reset([HANGAR[0], 2.04, HANGAR[2]], 0, statsFor(this.save.eq, this.save.heli));
    this.applyDay(false); this.spot = null;
    this.hst = { rotorA: 0.3, tailA: 0, rpm: 0, spin: 0, t: 0, install: this.install, riders: 0 };
    this.renderHangar();
  }

  renderHangar() {
    const s = this.save, el = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild; };
    this.$('scrap').innerHTML = `<small>SCRAP</small>⚙ ${s.scrap.toLocaleString('en-GB')}`;
    if (s.refundMsg) {
      // a one-off note: the belly turret / tail gun / electric skids were taken out and paid back
      const n = s.refundMsg; delete s.refundMsg; saveSave(s);
      setTimeout(() => this.flash(`+⚙ ${n.toLocaleString('en-GB')} REFUNDED FOR UPGRADES THAT WERE TAKEN OUT (DRONES, BEACONS, FLASHBANGS, LOUDSPEAKER...)`, 7000), 400);
    }
    // a red dot on THE SPIRE when there's something new there (the next chapter, or something you can build)
    const canBuild = BASE.some((b) => { const nx = b.tiers[(s.base[b.id] || 0) + 1]; return nx && s.scrap >= nx.cost && this.population() >= nx.pop; });
    this.$('spirebtn').classList.toggle('new', canBuild || s.story.seen !== s.story.ch);
    const slots = this.$('slots'); slots.replaceChildren();
    const HK = HELIS[s.heli], cap = (id) => (slotFits(id, s.heli) ? HK.cap[id] ?? 99 : 0);
    // only the upgrades for this kind of aircraft (helicopter or plane) are listed
    // the upgrades are split into tabs so the list isn't a mile long
    const all = [...SLOTS.filter((q) => slotFits(q.id, s.heli)), { id: 'paint', name: 'PAINT JOB', icon: '◆' }, ...Object.entries(DECOR).map(([id, d]) => ({ id, name: d.name, icon: d.icon, decor: true }))];
    const tabOf = (id) => Object.keys(TABS).find((k) => TABS[k].includes(id)) || (id === 'paint' || DECOR[id] ? 'looks' : 'kit');
    if (this.sel && this.sel !== 'all' && this.sel !== 'heli') this.tab = tabOf(this.sel);
    if (!this.tab) this.tab = 'weapons';
    const tabRow = el(`<div class="da-tabs">${Object.keys(TABNAME).map((k) => `<button type="button" data-t="${k}" class="${this.tab === k ? 'on' : ''}">${TABNAME[k]}</button>`).join('')}</div>`);
    for (const tb of tabRow.querySelectorAll('button')) tb.onclick = () => { this.snd.click?.(2600, 0.2); this.tab = tb.dataset.t; if (this.sel !== 'heli') this.sel = 'all'; this.renderHangar(); };
    let tabbed = false;
    for (const sl of [{ id: 'heli', name: 'AIRCRAFT', icon: '✈' }, ...all.filter((q) => tabOf(q.id) === this.tab)]) {
      const cur = sl.id === 'heli' ? HK.n : sl.id === 'paint' ? PAINT[s.paint].n : sl.decor ? (DECOR[sl.id].list.find((q) => q.id === s[DECOR[sl.id].cur]) || DECOR[sl.id].list[0]).n + (sl.id === 'tailart' && s.tailArt === 'number' ? ` ${String(s.num).padStart(2, '0')}` : '') : cap(sl.id) === 0 ? "DOESN'T FIT" : sl.tiers[Math.min(s.eq[sl.id], cap(sl.id), sl.tiers.length - 1)].n;
      const canBuy = sl.id === 'heli' ? HELI_IDS.some((k) => !s.helis.includes(k) && s.scrap >= this.price(HELIS[k].cost, true)) : sl.id !== 'paint' && !sl.decor && s.own[sl.id] < sl.tiers.length - 1 && s.scrap >= this.price(sl.tiers[s.own[sl.id] + 1].cost);
      const pips = sl.tiers ? `<u>${sl.tiers.slice(1).map((_, j) => `<q class="${j + 1 <= s.eq[sl.id] ? 'f' : j + 1 <= s.own[sl.id] ? 'o' : ''}" style="--r:${RARITY[Math.min(RARITY.length - 1, Math.round(((j + 1) / (sl.tiers.length - 1)) * (RARITY.length - 1)))]}"></q>`).join('')}</u>` : '';
      const b = el(`<button class="da-slot${this.sel === sl.id ? ' on' : ''}${sl.id !== 'heli' && sl.id !== 'paint' && cap(sl.id) === 0 ? ' off' : ''}" type="button"><i>${sl.icon}</i><span><b>${sl.name}</b><small>${cur}</small>${pips}</span>${canBuy ? '<em>NEW</em>' : ''}</button>`);
      b.onclick = () => { this.snd.click?.(2400, 0.2); this.sel = this.sel === sl.id ? 'all' : sl.id; this.renderHangar(); };
      slots.append(b);
      if (!tabbed) { slots.append(tabRow); tabbed = true; }
    }
    const tiers = this.$('tiers'); tiers.replaceChildren(); tiers.classList.toggle('compact', this.sel === 'heli');
    if (this.sel === 'heli') {
      for (const k of HELI_IDS) {
        const h = HELIS[k], own = s.helis.includes(k), eq = s.heli === k;
        // one card going wrong must never hide the rest
        let facts = '';
        try {
          const st2 = statsFor(s.eq, k);
          const cant = Object.entries(h.cap || {}).filter(([id, v]) => v === 0 && SLOT[id]).map(([id]) => SLOT[id].name);
          facts = `${st2.seats} SEATS · ${st2.hp} HEALTH · ${st2.fuel} FUEL${cant.length ? ` · CAN'T FIT: ${cant.join(', ')}` : ''}`;
        } catch (e) { console.error(e); }
        // compact cards so all the helicopters fit at once; the full description shows for the one you're flying
        const hc = this.price(h.cost, true);
        const b = el(`<button class="da-tier${eq ? ' eq' : own ? '' : s.scrap >= hc ? ' buy' : ' poor'}" type="button" title="${h.d.replace(/"/g, '')}"><b>${h.plane ? (h.vtol ? '✈ ' : '✈ ') : ''}${h.n}</b><small style="display:block;color:${h.plane ? '#5ab4ff' : '#9aa'};font:900 10px var(--font);letter-spacing:.12em">${h.plane ? (h.vtol ? 'PLANE · CAN HOVER' : 'PLANE · NEEDS THE RUNWAY') : 'HELICOPTER'}</small><p>${eq ? `${h.d}<br>` : ''}<small>${facts}</small></p><span>${eq ? 'FLYING THIS' : own ? 'FLY THIS' : `BUY ⚙ ${hc.toLocaleString('en-GB')}`}</span></button>`);
        b.onclick = () => {
          if (!own) { if (s.scrap < hc) { this.snd.fail?.(); this.flash('NOT ENOUGH SCRAP'); return; } s.scrap -= hc; s.helis.push(k); this.snd.coins?.(); this.flash(`${h.n} BOUGHT`); }
          if (s.heli !== k) { s.heli = k; this.session = this.session ? { ...this.session } : null; this.snd.bolt?.(); this.toHangar(); }
          saveSave(s); this.renderHangar();
        };
        tiers.append(b);
      }
    } else if (DECOR[this.sel]) {
      const D = DECOR[this.sel];
      s[D.own] = s[D.own] || ['none'];
      for (const p of D.list) {
        const own = s[D.own].includes(p.id), eq = (s[D.cur] || 'none') === p.id;
        const extra = p.id === 'number' ? ` <b style="color:#ffcf3a">${String(s.num).padStart(2, '0')}</b>` : '';
        const b = el(`<button class="da-tier${eq ? ' eq' : own ? '' : s.scrap >= p.cost ? ' buy' : ' poor'}" type="button"><b>${p.n}</b><p>${p.d}${extra}</p><span>${eq ? (p.id === 'number' ? 'NEW NUMBER' : 'EQUIPPED') : own ? 'EQUIP' : `BUY ⚙ ${p.cost}`}</span></button>`);
        b.onclick = () => {
          if (!own) { if (s.scrap < p.cost) { this.snd.fail?.(); return; } s.scrap -= p.cost; s[D.own].push(p.id); this.snd.coins?.(); this.flash(`${p.n} BOUGHT`); }
          else if (eq && p.id === 'number') s.num = 10 + Math.floor(Math.random() * 90);
          s[D.cur] = p.id; saveSave(s); this.snd.click?.(2000, 0.25); this.renderHangar();
        };
        tiers.append(b);
      }
    } else if (this.sel === 'paint') {
      for (const p of PAINTS) {
        if (p.dev && !this.isDev()) continue;
        const own = s.paints.includes(p.id) || p.dev, eq = s.paint === p.id;
        const sw = `<i class="sw" style="background:rgb(${p.body.map((v) => Math.round(v * 255))})"></i><i class="sw" style="background:rgb(${p.trim.map((v) => Math.round(v * 255))})"></i>`;
        const b = el(`<button class="da-tier${eq ? ' eq' : own ? '' : s.scrap >= p.cost ? ' buy' : ' poor'}" type="button"><b>${sw}${p.n}</b><p>${p.shark ? 'Teeth on the nose. Scary.' : p.glow ? 'Glowing stripes.' : 'A paint job.'}</p><span>${eq ? 'EQUIPPED' : own ? 'EQUIP' : `BUY ⚙ ${p.cost}`}</span></button>`);
        b.onclick = () => {
          if (!own) { if (s.scrap < p.cost) { this.snd.fail?.(); return; } s.scrap -= p.cost; s.paints.push(p.id); this.snd.coins?.(); this.flash(`${p.n} BOUGHT`); }
          s.paint = p.id; saveSave(s); this.snd.click?.(2000, 0.25); this.renderHangar();
        };
        tiers.append(b);
      }
    } else if (this.sel !== 'all') {
      const sl = SLOT[this.sel], now = statsFor(s.eq, s.heli), top = sl.tiers.length - 1;
      sl.tiers.forEach((t0, i) => {
        const t = { ...t0, cost: this.price(t0.cost) };
        const own = i <= s.own[sl.id], eq = s.eq[sl.id] === i, next = i === s.own[sl.id] + 1, fits = i <= cap(sl.id);
        const cls = eq ? ' eq' : own ? '' : next ? s.scrap >= t.cost ? ' buy' : ' poor' : ' lock';
        const rar = RARITY[Math.min(RARITY.length - 1, Math.round((i / Math.max(1, top)) * (RARITY.length - 1)))];
        const chips = fits && !eq ? tierChips(now, statsFor({ ...s.eq, [sl.id]: i }, s.heli)) : '';
        const key = SLOT_KEYS[sl.id] && i > 0 ? `<kbd>${SLOT_KEYS[sl.id]}</kbd>` : '';
        const b = el(`<button class="da-tier${cls}${fits ? '' : ' nofit'}" type="button" style="--r:${rar}"><small class="tn">${i === 0 ? 'STOCK' : `MK ${'I II III IV V VI'.split(' ')[i - 1]}`}${key}</small><b>${t.n}</b><p>${t.d}${fits ? '' : `<br><small class="warn">TOO BIG FOR THE ${HK.n} (IT'LL FIT YOUR OTHER HELICOPTERS)</small>`}</p>${chips ? `<div class="da-chips">${chips}</div>` : ''}<span>${eq ? '✔ FITTED' : own ? 'FIT' : next ? `BUY ⚙ ${t.cost.toLocaleString('en-GB')}` : `🔒 ⚙ ${t.cost.toLocaleString('en-GB')}`}</span></button>`);
        b.onclick = () => {
          if (!own) {
            if (!next) return;
            if (s.scrap < t.cost) { this.snd.fail?.(); this.flash('NOT ENOUGH SCRAP · GO AND EARN SOME'); return; }
            s.scrap -= t.cost; s.own[sl.id] = i; this.snd.coins?.(); this.flash(`${t.n} INSTALLED`);
          }
          if (s.eq[sl.id] !== i) { s.eq[sl.id] = i; this.install[sl.id] = 0; this.snd.magIn?.(); setTimeout(() => this.snd.bolt?.(), 260); }
          saveSave(s); this.renderHangar();
        };
        tiers.append(b);
      });
    }
    const st = this.$('stats');
    st.innerHTML = `<h4 class="da-hpick"><button type="button" data-d="-1">◀</button>${HK.n}<button type="button" data-d="1">▶</button><small>${s.helis.length} OF ${HELI_IDS.length} HELICOPTERS · CLICK HELICOPTER FOR ALL</small></h4>${bars(s.eq, s.heli).map(([n, p]) => `<div class="da-bar">${n}<i style="--p:${clamp(p, 0.04, 1).toFixed(2)}"></i></div>`).join('')}<div class="da-best">SAVED: ${s.rescued} · JOBS DONE: ${s.events || 0} · TEAM: ${s.team.length} · WORLD #${s.seed}</div>`;
    // the arrows flip between the helicopters you own
    for (const b of st.querySelectorAll('.da-hpick button')) b.onclick = () => {
      const own = HELI_IDS.filter((k) => s.helis.includes(k));
      if (own.length < 2) { this.sel = 'heli'; this.renderHangar(); return; }
      s.heli = own[(own.indexOf(s.heli) + Number(b.dataset.d) + own.length) % own.length];
      saveSave(s); this.snd.bolt?.(); this.toHangar(); this.renderHangar();
    };
    const opts = this.$('opts'); opts.replaceChildren();
    const opt = (label, val, fn) => { const b = el(`<button class="da-opt" type="button">${label}<b>${val}</b></button>`); b.onclick = () => { fn(); saveSave(s); this.snd.click?.(2000, 0.2); this.renderHangar(); }; opts.append(b); };
    opt('FLYING', FLIGHT[s.flight] || 'EASY', () => { s.flight = s.flight === 'easy' ? 'assist' : s.flight === 'assist' ? 'pro' : 'easy'; });
    opt('INVERT MOUSE', s.invert ? 'ON' : 'OFF', () => { s.invert = !s.invert; });
    opt('GRAPHICS', GFXNAME[s.gfx || 'auto'], () => { s.gfx = GFXNEXT[s.gfx || 'auto']; this.ql = null; this.pfT = 0; this.pfN = 0; });
    opt('MUSIC', s.music === false ? 'OFF' : ['QUIET', 'MEDIUM', 'LOUD'][Math.round((s.musicVol ?? 0.5) * 2 - 0.5) || 0] || 'MEDIUM', () => { if (s.music === false) { s.music = true; s.musicVol = 0.25; } else if ((s.musicVol ?? 0.5) < 0.4) s.musicVol = 0.5; else if (s.musicVol < 0.9) s.musicVol = 1; else s.music = false; });
    opt('TUTORIAL', this.tutAsk ? 'ON NEXT FLIGHT ✔' : 'PLAY IT AGAIN', () => { this.tutAsk = !this.tutAsk; });
    opt('MOUSE SPEED', `${s.sens.toFixed(1)}×`, () => { s.sens = s.sens >= 2 ? 0.5 : Math.round((s.sens + 0.25) * 100) / 100; });
    const nw = el(`<button class="da-opt" type="button">WORLD<b>${this.sureNew ? 'SURE? CLICK AGAIN' : 'NEW WORLD ▶'}</b></button>`);
    nw.onclick = () => {
      if (!this.sureNew) { this.sureNew = true; this.renderHangar(); return; }
      this.sureNew = false;
      s.seed = 1 + Math.floor(Math.random() * 99999);
      for (const m of s.team) { m.raid = false; if (m.hp <= 0) m.hp = m.max; }
      saveSave(s); this.session = null; this.raid = null; this.mapImg = null;
      this.load(); this.toHangar(); this.flash(`NEW WORLD #${s.seed}`); this.snd.checkpoint?.();
    };
    if (!this.client) opts.append(nw);
    this.$('netbtn').classList.toggle('hidden', !!this.client);
    this.$('back').textContent = this.client ? '◀ LEAVE SERVER' : '◀ TITLE';
    const c = CAMS[this.sel] || CAMS.all, cm = (AIRFRAMES[s.heli] || AIRFRAMES.warhorse).cam;
    Object.assign(this.cam, { yawT: c[0], pitchT: c[1], distT: c[2] * (this.sel === 'all' || this.sel === 'heli' || this.sel === 'paint' || this.sel === 'camo' ? Math.min(cm, 1.1) : cm > 1.05 ? Math.min(cm, 1.15) : 1), tgtT: c[3] });
  }

  hangarFrame(dt) {
    const c = this.cam, k = damp(4, dt);
    c.yaw += ((c.yawT ?? 0.75) + c.dyaw - c.yaw) * k;
    c.pitch += ((c.pitchT ?? 0.2) - c.pitch) * k;
    c.dist += ((c.distT ?? 20) * (c.zoom || 1) - c.dist) * k;
    for (let i = 0; i < 3; i++) c.tgt[i] += ((c.tgtT || [0, 0, 0])[i] - c.tgt[i]) * k;
    if (this.drag == null && this.sel === 'all') c.dyaw += dt * 0.12;
    for (const s of Object.keys(this.install)) { this.install[s] = Math.min(1, this.install[s] + dt * 1.6); if (this.install[s] >= 1) delete this.install[s]; }
    const H = this.hangarHeli;
    this.hst.t += dt; this.hst.rotorA += dt * 0.25; this.hst.tailA += dt * 0.6; this.hst.spin += dt * (this.sel === 'gun' ? 2 : 0.2);
    const T = H.toWorld(c.tgt);
    const cp = Math.cos(c.pitch), eye = [T[0] - Math.sin(c.yaw) * cp * c.dist, Math.max(0.6, T[1] + Math.sin(c.pitch) * c.dist), T[2] - Math.cos(c.yaw) * cp * c.dist];
    const fwd = norm([T[0] - eye[0], T[1] - eye[1], T[2] - eye[2]]);
    const s = this.save, st = statsFor(s.eq, s.heli);
    const crew = s.team.filter((m) => m.aboard && !m.raid).slice(0, 4).map((m) => ({ col: ROLES[m.role].col }));
    const parts = chopperParts(capEq(s.eq, s.heli), paintFor(s), { ...this.hst, hangar: true, crew, rockets: st.rockets, rocketMax: st.rockets, bombs: st.bombs, bombMax: st.bombs }, H.H, s.heli);
    this.draw(eye, fwd, 0, parts, [], HANGAR, 0.002);
    if (this.coop) this.coopHostTick(dt);
  }

  // ---------------------------------------------------------------- flying: start, respawn
  deploy() {
    this.suppressUsed = false;
    if (this.mode !== 'hangar') return;
    if (this.client && this.client.wing) { this.wingReturn(); return; }
    this.snd.unlock?.(); this.snd.startRun?.();
    const s = this.save, S = statsFor(s.eq, s.heli);
    S.rotorTier = s.eq.rotor;
    this.S = S;
    this.closePanel();
    this.$('hangar').classList.add('hidden');
    this.$('hud').classList.remove('hidden');
    this.root.classList.remove('da-gunner', 'da-wing');
    const fob = this.map.spire;
    this.applyDay();
    if (!this.session) {
      this.session = { fob };
      this.run = { t: 0, kills: 0, rescued: 0, lost: 0, scrap: 0 };
      this.fx.clear(); this.horde.clear(); this.director.clear(); this.dustoffs = [];
      for (const f of this.fobs) { f.hp = f.max; f.wrecked = false; }
      { const sp0 = this.spawnFor(S); this.heli.reset(sp0.pos, sp0.yaw, S); }
      this.tod = 0.3;
      this.director.start(this);
      this.story = new Story(this.save, this.map);
      this.syncVats();
      this.story.ensure(this);
      this.incomeT = 0;
      this.banner('DEAD AIR', this.story.done ? 'THE SPIRE · FREE FLIGHT · HELP WHO YOU CAN' : `THE SPIRE · CHAPTER ${this.save.story.ch + 1}: ${CHAPTERS[this.save.story.ch].n}`, '', 3);
      for (const m of this.save.team) { m.raid = false; }
      this.help(true);
      // brand new pilots (or anyone who asked for it in the hangar) get the guided first flight
      this.tut = (!this.save.tutDone && (this.save.rescued || 0) < 5) || this.tutAsk ? { i: 0, t: 0, n: 0 } : null; this.tutAsk = false;
      if (this.tut) this.helpT = 0;
      this.riders = 0; this.fuel = S.fuel;
      this.shots = []; this.tracers = []; this.blasts = []; this.fires = []; this.runners = [];
    } else {
      // back out of the hangar at the same base, fixed up and refuelled
      this.heli.stats = S;
      { const sp0 = this.spawnFor(S); this.heli.reset(sp0.pos, S.plane && !S.vtol ? sp0.yaw : this.heli.heading, S); }
    }
    this.hp = S.hp; this.fuel = Math.max(this.fuel ?? S.fuel, S.fuel);
    this.heat = 0; this.overT = 0; this.gunT = 0; this.spinV = 0; this.flashT = 0;
    this.rockets = S.rockets; this.rocketT = 0; this.rocketRegen = 0; this.rocketSide = 0;
    this.bombs = S.bombs; this.bombT = 0;
    this.siren = 0; this.raid = this.raid || null;
    const cb = [0, 25, 50][this.save.base.clinic || 0];
    for (const m of this.save.team) { if (m.max0 == null) m.max0 = m.max; m.max = m.max0 + cb; }
    for (const m of this.save.team) if (!m.raid) m.hp = m.max;          // a rest at the Spire heals everyone
    this.shield = S.shield || 0; this.shieldHit = 0; this.shieldT = 0; this.flaresLeft = S.flares; this.flareRegen = 0; this.beaconsLeft = S.beacons; this.beacons = []; this.mag = []; this.beams = [];
    this.splats = this.splats || [];
    this.boardT = 0; this.unloadT = 0; this.unloading = false; this.boarding = false;
    this.doorAim = [[-Math.PI / 2, -0.3], [Math.PI / 2, -0.3]]; this.doorT = [0, 0]; this.doorTgt = [null, null]; this.doorFlash = [0, 0];
    this.shake = 0; this.dmgT = 0; this.camMode = this.camMode || 0; this.camEye = null; this.camLook = null;
    this.scav = null; this.drop = null; this.crate = this.crate && this.crate.carried ? this.crate : null;
    this.mode = 'fly';
    this.startAudio();
    this.lock();
  }
  // where you start: planes on the end of the runway pointing down it, everything else on the Spire's pad
  spawnFor(S, wingPad) {
    const af = this.map.airfield, sp = this.map.spire;
    if (S.plane && !S.vtol && af) { const p = af.spawn; return { pos: [p[0] + (wingPad != null ? 40 + wingPad * 40 : 0), p[1] + 1.93, p[2]], yaw: af.spawnYaw }; }
    const P = wingPad != null ? (sp.spawns || [])[wingPad] || sp.padAt : sp.padAt;
    return { pos: [P[0], P[1] + 1.93, P[2]], yaw: 0 };
  }
  faceCity(f) { return Math.atan2(f.padAt[0], f.padAt[2]); }    // heading that points the nose at the city centre
  // the guided first flight: one step at a time, each ticks off when you've done it
  tutSteps() {
    const S = this.S, H = this.heli, plane = S.plane && (!S.vtol || H.planeMode), sp = Math.hypot(H.vel[0], H.vel[2]);
    const st = [];
    if (plane) {
      st.push({ t: 'HOLD <kbd>W</kbd> FOR FULL THROTTLE AND ROLL DOWN THE RUNWAY', ok: () => sp > S.stall * 0.85 || this.agl > 8 });
      st.push({ t: 'PULL BACK ON THE <kbd>MOUSE</kbd> TO LIFT THE NOSE AND TAKE OFF', ok: () => this.agl > 15 });
      st.push({ t: 'MOVE THE <kbd>MOUSE</kbd> SIDEWAYS TO BANK AND TURN · KEEP YOUR SPEED UP OR YOU STALL', ok: (d) => Math.abs(H.rollL) > 0.35 && (d.n += 1) > 40 });
    } else {
      st.push({ t: 'HOLD <kbd>W</kbd> TO LIFT OFF THE PAD', ok: () => this.agl > 10 });
      st.push({ t: this.save.flight === 'easy' ? 'PUSH THE <kbd>MOUSE</kbd> FORWARD TO FLY · SIDEWAYS TO TURN · <kbd>S</kbd> TO GO DOWN' : 'TILT WITH THE <kbd>MOUSE</kbd> TO FLY · <kbd>A</kbd> <kbd>D</kbd> TO TURN · <kbd>S</kbd> TO GO DOWN', ok: (d) => sp > 12 && (d.n += 1) > 90 });
    }
    st.push({ t: '<kbd>CLICK</kbd> TO FIRE THE GUN', ok: (d) => this.flashT > 0 && (d.n += 1) > 15 });
    if (S.rockets) st.push({ t: '<kbd>RIGHT CLICK</kbd> FIRES ROCKETS · GOOD FOR CROWDS', ok: () => this.rockets < S.rockets });
    if (plane) st.push({ t: 'FIND A GREEN <b style="color:#7dff9a">SOS</b> MARKER · FLY NEAR IT AND PRESS <kbd>E</kbd> TO CALL A DUSTOFF', ok: () => (this.dustoffs || []).length > 0 });
    else {
      st.push({ t: 'FIND A GREEN <b style="color:#7dff9a">SOS</b> MARKER · LAND ON THAT ROOF AND PRESS <kbd>E</kbd> TO PICK THEM UP', ok: () => this.riders > 0 });
      st.push({ t: 'FLY BACK TO THE <b style="color:#5ab4ff">SPIRE</b> (THE BLUE H) AND LAND ON THE PAD TO DROP THEM OFF', ok: () => (this.run?.rescued || 0) > 0 });
    }
    st.push({ t: 'NICE FLYING! <kbd>C</kbd> CAMERA (TRY THE COCKPIT) · <kbd>M</kbd> MAP · LAND AT THE SPIRE FOR THE <b>HANGAR</b> AND UPGRADES', ok: (d) => (d.n += 1) > 600 });
    return st;
  }
  tutTick() {
    const T = this.tut, el = this.$('tut');
    if (!T || this.mode !== 'fly' || this.client) { el.classList.add('hidden'); return; }
    if (this.hit('KeyT')) { this.tut = null; this.save.tutDone = true; saveSave(this.save); el.classList.add('hidden'); this.flash('TUTORIAL SKIPPED · REPLAY IT FROM THE HANGAR', 2500); return; }
    const st = this.tutSteps(), cur = st[T.i];
    if (!cur) { this.tut = null; this.save.tutDone = true; saveSave(this.save); el.classList.add('hidden'); return; }
    if (cur.ok(T)) { T.i++; T.n = 0; this.snd.click?.(2600, 0.3); if (T.i < st.length) this.snd.checkpoint?.(); }
    const html = `<small>FLIGHT SCHOOL · ${Math.min(T.i + 1, st.length)} / ${st.length}</small><div>${(st[T.i] || cur).t}</div><i>T TO SKIP</i>`;
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
    el.classList.remove('hidden');
  }
  help(on) {
    const h = this.$('help');
    const mode = this.save.flight, S = this.S || {};
    if (S.plane) {
      h.innerHTML = `<b>YOU'RE FLYING A PLANE</b> · <kbd>W</kbd><kbd>S</kbd> THROTTLE · <kbd>MOUSE</kbd> PITCH AND ROLL (BANK TO TURN) · <kbd>A</kbd><kbd>D</kbd> RUDDER${S.vtol ? ' · <kbd>V</kbd> HOVER / FLY LIKE A PLANE' : ''}<br>KEEP YOUR SPEED UP OR IT STALLS · ${S.vtol ? 'HOVER TO LAND ANYWHERE' : 'FULL THROTTLE DOWN THE RUNWAY, THEN PULL BACK ON THE MOUSE TO TAKE OFF · LAND AND STOP ON THE RUNWAY TO REFUEL'}<br>JOBS: FLY NEAR AN SOS OR A SUPPLY DROP AND PRESS <kbd>E</kbd> TO CALL A DUSTOFF HELICOPTER, THEN KEEP THE ZOMBIES OFF IT · <kbd>E</kbd> OVER A MAST DROPS THE ENGINEER BY PARACHUTE · <kbd>CLICK</kbd> GUN · <kbd>RIGHT CLICK</kbd> ROCKETS · <kbd>SPACE</kbd> BOMB · <kbd>M</kbd> MAP`;
      this.helpT = on ? 22 : 0;
      return;
    }
    h.innerHTML = mode === 'easy'
      ? '<kbd>W</kbd><kbd>S</kbd> UP / DOWN · <kbd>MOUSE</kbd> STEER (FORWARD = FLY FORWARD) · <kbd>A</kbd><kbd>D</kbd> SLIDE<br> <kbd>CLICK</kbd> GUN · <kbd>RIGHT CLICK</kbd> ROCKETS · <kbd>SPACE</kbd> BOMB · <kbd>Z</kbd> NIGHT VISION · <kbd>L</kbd> LIGHT · <kbd>B</kbd> SUPPLIES · <kbd>C</kbd> CAMERA · <kbd>M</kbd> MAP<br>LAND ON A BUILDING WITH A SIGN AND PRESS <kbd>R</kbd> TO SEND YOUR TEAM IN'
      : '<kbd>W</kbd><kbd>S</kbd> UP / DOWN · <kbd>A</kbd><kbd>D</kbd> TURN · <kbd>MOUSE</kbd> TILT TO FLY<br><kbd>CLICK</kbd> GUN · <kbd>RIGHT CLICK</kbd> ROCKETS · <kbd>SPACE</kbd> BOMB · <kbd>Z</kbd> NIGHT VISION · <kbd>C</kbd> CAMERA · <kbd>M</kbd> MAP<br>LAND ON A BUILDING WITH A SIGN AND PRESS <kbd>R</kbd> TO SEND YOUR TEAM IN';
    this.helpT = on ? 22 : 0;
  }

  // ---------------------------------------------------------------- the frame
  frame(dt) {
    this.t += dt;
    if (this.mode === 'hangar') this.hangarFrame(dt);
    else if (this.mode === 'fly' || this.mode === 'pause' || this.mode === 'down') this.flyFrame(this.mode === 'pause' && !this.coop ? 0 : dt);
    else if (this.mode === 'gunner' || this.mode === 'gpause') this.gunnerFrame(dt);
    else if (this.mode === 'wing' || this.mode === 'wpause') this.wingFrame(dt);
    else if (this.mode === 'joining') {
      const C = this.map.city, a = this.t * 0.05, eye = [C.x + Math.sin(a) * 330, C.y + 140, C.z + Math.cos(a) * 330];
      const v = [C.x - eye[0], C.y + 40 - eye[1], C.z - eye[2]], l = Math.hypot(...v);
      this.draw(eye, v.map((c) => c / l), 0, [], [], [C.x, 0, C.z], 0.0032);
    }
    if (this.mode === 'fly' || this.mode === 'wing' || this.mode === 'gunner') { this.bossFeel(dt); this.siteTick(dt); }
    this.musicTick(dt);
    this.hitKeys.clear(); this.clk.clear(); this.mx = 0; this.my = 0;
  }

  flyFrame(dt) {
    const H = this.heli, S = this.S;
    const live = this.mode === 'fly';
    if (dt > 0) {
      this.run.t += dt;
      const ctrl = live && !this.panel;
      const k = (c) => (ctrl && this.key(c) ? 1 : 0);
      const ctl = {
        coll: H.dead ? 0 : k('KeyW') - k('KeyS'), yaw: k('KeyA') - k('KeyD'),
        mx: ctrl && this.locked ? this.mx : 0, my: ctrl && this.locked ? this.my : 0,
        pk: k('ArrowUp') - k('ArrowDown'), rk: k('ArrowRight') - k('ArrowLeft'),
        boost: ctrl && (this.key('ShiftLeft') || this.key('ShiftRight')) && this.fuel > 0,
        mode: this.save.flight || 'easy', assist: this.save.flight !== 'pro', sens: this.save.sens, invert: this.save.invert,
        engineOn: this.mode !== 'down', noFuel: this.fuel <= 0,
      };
      ctl.hold = this.holdOn(ctl);
      const grabbers = this.horde.list.filter((z) => z.alive && z.st === 'grab').length;
      H.extraMass = grabbers * 0.07 + (this.crate && this.crate.carried ? 0.12 : 0);
      for (const z of this.horde.list) if (z.alive && z.st === 'grab' && z.type === 'brute') H.extraMass += 0.14;
      if (S.heavy) H.extraMass *= 0.4;
      H.step(dt, ctl, this.world);
      this.edge(dt);
      const easy = this.save.flight === 'easy';
      for (const ev of H.events) {
        if (ev.type === 'impact') { this.hurt(ev.speed * (ev.hard ? 14 : 9) * (easy ? 0.5 : 1) * (S.gpws ? 0.7 : 1), ev.point); this.fx.sparks(ev.point, 12, [1, 0.8, 0.4], 7, 0.5, 0.05, 2); this.snd.meleeWall?.('smash'); this.shake = Math.max(this.shake, 0.5); }
        else if (ev.type === 'rotor' && S.toughBlades) { this.rotorHitT = (this.rotorHitT || 0) - dt; this.fx.sparks(ev.point, 4, [1, 0.85, 0.5], 9, 0.3, 0.04, 1); if (this.rotorHitT <= 0) { this.rotorHitT = 0.3; this.hurt(easy ? 1.5 : 3, ev.point); } }
        else if (ev.type === 'rotor') { this.rotorHitT = (this.rotorHitT || 0) - dt; if (this.rotorHitT <= 0) { this.rotorHitT = 0.15; this.hurt(easy ? 7 : 14, ev.point); this.fx.sparks(ev.point, 10, [1, 0.85, 0.5], 9, 0.4, 0.04, 1); this.snd.click?.(3600, 0.4, 3); this.shake = Math.max(this.shake, 0.4); } }
      }
      H.events.length = 0;
      this.gpwsTick(dt);
      if (H.dead && this.mode !== 'down' && (H.contacts || H.pos[1] < 1)) this.crash();
      this.burnFuel(dt, ctl);
      if (live && !H.dead && !this.panel) this.weapons(dt);
      this.upkeep(dt);
      this.doorGuns(dt);
      this.marksman(dt);
      this.turrets(dt);
      this.updateShots(dt);
      this.landing(dt);
      this.dayTick(dt);
      this.gadgets(dt);
      this.ambientSpawns(dt);
      this.director.update(dt, this);
      if (this.story) this.story.update(dt, this);
      this.dustoffTick(dt);
      this.incomeT = (this.incomeT || 0) + dt;
      if (this.incomeT >= 60) { this.incomeT = 0; const n = this.income(); if (n > 0) { this.addScrap(n); this.feed(`THE SPIRE'S SCAVENGERS BROUGHT IN ⚙${n}`, 'g'); } }
      this.fobTick(dt);
      const aglHit = this.world.raycast([H.pos[0], H.pos[1] - 2, H.pos[2]], [0, -1, 0], 1000);
      this.agl = aglHit ? aglHit.t : 1000;
      const roofs = this.director.list.filter((e) => e.kind === 'rescue').map((e) => e.roof);
      if (this.raid && this.raid.roofT) roofs.push(this.raid.roofT);
      if (this.raid) this.raidTick(dt);
      this.horde.update(dt, { heli: H, heliAlt: this.agl, noHeap: !!this.atFob, roofs, others: this.coop ? this.wingSpots() : null, noise: [1, 0.67, 0.42][S.quiet || 0], lure: this.siren > 0 ? this.lure : this.beaconLure(), lureR: this.siren > 0 ? 0 : 260, skidGuard: S.skidGuard });
      this.hordeEvents();
      this.ambient(dt);
      this.fx.update(dt);
      this.saveT = (this.saveT || 0) + dt; if (this.saveT > 8) { this.saveT = 0; saveSave(this.save); }
    }
    this.camera(dt);
    this.hud(dt);
    this.audio();
    if (this.coop) this.coopHostTick(dt);
  }

  // the edge of the map pushes you back; there's a height limit too
  edge(dt) {
    const H = this.heli, L = WORLD - 20;
    this.outT = 0;
    for (const ax of [0, 2]) {
      const p = H.pos[ax];
      if (p < -L) { H.vel[ax] += (-L - p) * 4 * dt; this.outT = 1; }
      if (p > L) { H.vel[ax] -= (p - L) * 4 * dt; this.outT = 1; }
    }
    const ceil = Math.max(750, this.groundAt(H.pos[0], H.pos[2]) + 500);
    if (H.pos[1] > ceil) { H.vel[1] -= (H.pos[1] - ceil) * 3 * dt; this.outT = 1; }
  }

  burnFuel(dt, ctl) {
    const H = this.heli;
    if (this.mode === 'down' || this.fuel <= 0) return;
    const idle = H.contacts >= 3 && ctl.coll <= 0;
    const burn = idle ? 0.06 : 0.33 + 0.22 * Math.max(0, ctl.coll) + H.boost * 1.1;
    const before = this.fuel;
    this.fuel = Math.max(0, this.fuel - burn * dt * H.rpm);
    const k0 = before / this.S.fuel, k1 = this.fuel / this.S.fuel;
    if (k0 > 0.25 && k1 <= 0.25) { this.banner('FUEL LOW', 'HEAD FOR A BASE OR THE ROOFTOP FUEL PAD', 'bad', 2.4); this.snd.alarm?.(); }
    if (k0 > 0.1 && k1 <= 0.1) { this.feed('FUEL VERY LOW · LAND SOMEWHERE SAFE', 'r'); this.snd.alarm?.(); }
    if (before > 0 && this.fuel <= 0) { this.banner('OUT OF FUEL', 'THE ENGINE\'S CUT OUT · GLIDE DOWN AND LAND', 'bad', 3); this.snd.fail?.(); }
  }
  fuelUp(n) { this.fuel = Math.min(this.S.fuel, this.fuel + n); }

  hurt(dmg, at) {
    if (this.heli.dead || this.mode === 'down') return;
    if (this.shield > 0) {
      const take = Math.min(this.shield, dmg);
      this.shield -= take; dmg -= take; this.shieldHit = 1; this.shieldT = 0;
      if (this.shield <= 0) { this.feed('SHIELD DOWN', 'r'); this.snd.fail?.(); }
      if (dmg <= 0) { this.snd.tone?.(1200, 400, 0.12, 0.08); return; }
    }
    this.hp -= dmg; this.dmgT = Math.min(1, this.dmgT + dmg / 60);
    this.shake = Math.max(this.shake, Math.min(0.8, dmg / 60));
    this.snd.hurt?.();
    if (this.hp <= 0 && this.S.suppress && !this.suppressUsed) {
      this.suppressUsed = true; this.hp = this.S.hp * 0.2;
      this.banner('FIRE SUPPRESSION', 'EXTINGUISHERS FIRED · GET HER HOME', 'bad', 2.5);
      this.fx.dust(this.heli.toWorld([0, 1.4, 1]), 10);
      this.snd.alarm?.();
      return;
    }
    if (this.hp <= 0) {
      this.hp = 0; this.heli.dead = true;
      this.banner('YOU\'RE GOING DOWN', 'MAYDAY · MAYDAY', 'bad', 3);
      this.snd.alarm?.();
    }
  }

  crash() {
    const p = this.heli.pos;
    this.boom(p, this.S.crash === 2 ? 1 : 3);
    if (this.S.crash !== 2) for (let i = 0; i < 30; i++) this.fx.flame([p[0] + (Math.random() - 0.5) * 6, p[1], p[2] + (Math.random() - 0.5) * 6], [0, 2, 0], 4);
    this.heli.vel = [0, 0, 0]; this.heli.rpm = 0;
    this.mode = 'down';
    // crashworthy seats: the survivors aboard live, and the rescue team brings them home
    const safe = this.S.crash ? this.riders : 0;
    if (safe) { this.run.rescued += safe; this.save.rescued += safe; this.addScrap(25 * safe); this.storyHit('rescued', safe); }
    const lostR = this.riders - safe; this.run.lost += lostR; this.riders = 0;
    if (this.crate && this.crate.carried) { this.crate.carried = false; this.crate.done = true; this.crate = null; }
    for (const z of this.horde.list) if (z.st === 'grab') { z.st = 'fall'; z.vel = [0, 2, 0]; }
    const bill = this.S.crash === 2 ? 0 : Math.min(this.save.scrap, 150);
    this.save.scrap -= bill; saveSave(this.save);
    if (document.pointerLockElement) { this.softUnlock = true; document.exitPointerLock(); }
    setTimeout(() => {
      if (this.mode !== 'down') return;
      const e = this.$('end');
      e.innerHTML = `<h2 class="lose">SHOT DOWN</h2><p>${lostR ? `${lostR} survivor${lostR > 1 ? 's' : ''} didn't make it.` : safe ? `The crash seats worked: all ${safe} survivors aboard walked away.` : 'You walked away from it.'} The rescue team pulled you out.</p>
        <table><tr><td>REPAIR BILL</td><td>⚙ ${bill}</td></tr><tr><td>ZOMBIES KILLED</td><td>${this.run.kills}</td></tr><tr><td>SURVIVORS SAVED</td><td>${this.run.rescued}</td></tr><tr><td>SCRAP</td><td>⚙ ${this.save.scrap.toLocaleString('en-GB')}</td></tr></table>
        <div class="row"><button data-x="go" type="button">FLY AGAIN FROM ${this.nearestFob(p).name}</button><button class="alt" data-x="hangar" type="button">HANGAR</button></div>`;
      e.querySelector('[data-x=go]').onclick = () => this.respawn();
      e.querySelector('[data-x=hangar]').onclick = () => { this.session.fob = this.nearestFob(p); this.toHangar(); };
      e.classList.remove('hidden');
    }, 2600);
  }
  nearestFob() { return this.map.spire; }
  nearestFobOld(p, fuelOk = false) {
    let best = null, bd = Infinity;
    for (const f of this.fobs) { if (f.wrecked || (f.fuelOnly && !fuelOk)) continue; const d = Math.hypot(f.padAt[0] - p[0], f.padAt[2] - p[2]); if (d < bd) { bd = d; best = f; } }
    return best || this.fobById('home');
  }
  respawn() {
    const f = this.nearestFob(this.heli.pos);
    this.$('end').classList.add('hidden');
    this.session.fob = f;
    this.mode = 'hangar';
    this.fuel = this.S.fuel;
    this.deploy();
  }

  // ---------------------------------------------------------------- aiming and weapons
  // LOUDSPEAKER: every zombie within earshot heads for where you are now
  sirenOn() {
    if (!this.S.speaker) { this.feed('NO LOUDSPEAKER FITTED · BUY ONE IN THE HANGAR', 'y'); return; }
    if (this.sirenCd > 0) { this.feed(`SPEAKER COOLING DOWN · ${Math.ceil(this.sirenCd)}s`, 'y'); return; }
    const H = this.heli.pos;
    this.siren = 10; this.sirenCd = 25; this.lure = [H[0], H[2]];
    for (const z of this.horde.list) if (z.alive && z.st === 'walk' && Math.hypot(z.x - H[0], z.z - H[2]) < 260 && !(z.tgt && z.tgt.sticky)) { z.tgt = null; }
    this.feed('SIREN · EVERY ZOMBIE NEARBY IS COMING HERE', 'y');
  }
  upkeep(dt) {
    const H = this.heli, S = this.S;
    this.sirenCd = Math.max(0, (this.sirenCd || 0) - dt);
    if (this.siren > 0) {
      this.siren -= dt;
      this.sirenT = (this.sirenT || 0) - dt;
      if (this.sirenT <= 0) { this.sirenT = 0.55; this.snd.tone?.(this.sirenHi ? 980 : 720, this.sirenHi ? 720 : 980, 0.5, 0.12, 'square'); this.sirenHi = !this.sirenHi; }
      if (this.siren <= 0) this.lure = null;
      // LRAD: a blast every second knocks down everything close under you, and shakes them off the skids
      if (S.lrad && !H.dead) {
        this.sonicT = (this.sonicT || 0) - dt;
        if (this.sonicT <= 0) {
          this.sonicT = 1;
          for (const z of this.horde.list) {
            if (!z.alive || Math.hypot(z.x - H.pos[0], z.z - H.pos[2]) > 45) continue;
            if (z.st === 'grab') { z.st = 'fall'; z.slot = -1; z.vel = [(Math.random() - 0.5) * 8, 3, (Math.random() - 0.5) * 8]; }
            else if (z.st === 'walk') { z.stun = 1.4; this.horde.damage(z, 6, [(z.x - H.pos[0]) * 0.2, 2, (z.z - H.pos[2]) * 0.2], 'siren'); }
          }
          this.blasts.push({ pos: [H.pos[0], this.groundAt(H.pos[0], H.pos[2]) + 0.5, H.pos[2]], t: 0, size: 4, ring: true, col: [0.4, 0.8, 1] });
        }
      }
    }
    if (this.beacons) this.beaconTick(dt);
    this.shieldT += dt; this.shieldHit = Math.max(0, this.shieldHit - dt * 2.5);
    if (S.shield && this.shieldT > 3 && this.shield < S.shield) this.shield = Math.min(S.shield, this.shield + S.shieldRegen * dt);
    if (S.flares && this.flaresLeft < S.flares) { this.flareRegen += dt; if (this.flareRegen > 15) { this.flareRegen = 0; this.flaresLeft++; } }
    if (this.mag.length) {
      this.mag = this.mag.filter((z) => z.alive);
      this.mag.forEach((z, i) => {
        const p = H.toWorld([2.15 + (i - 1) * 0.5, -5.2 - (i % 2) * 0.6, (i - 1) * 0.4]);
        z.x = p[0]; z.y = p[1] - z.s * 1.6; z.z = p[2]; z.ph += dt * 10; z.st = 'mag';
      });
    }
    for (let i = this.beams.length - 1; i >= 0; i--) { this.beams[i].t -= dt; if (this.beams[i].t <= 0) this.beams.splice(i, 1); }
    for (let i = this.splats.length - 1; i >= 0; i--) { this.splats[i].t += dt; if (this.splats[i].t > 30) this.splats.splice(i, 1); }
    this.whiteT = Math.max(0, (this.whiteT || 0) - dt * 0.8);
  }
  // FLASH PODS: blinding flashes all round. Zombies near you are stunned and anything on the skids lets go.
  fireFlares() {
    const H = this.heli, S = this.S;
    if (!S.flares) { this.feed('NO FLASH PODS FITTED · BUY THEM IN THE HANGAR', 'y'); return; }
    if (this.flaresLeft <= 0) { this.feed('OUT OF FLASHES · THEY COME BACK SLOWLY', 'y'); return; }
    this.flaresLeft--;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.shots.push({ kind: 'flare', pos: H.toWorld(mountAt(this.save.heli, 'flares', [Math.cos(a) * 0.6, 0, 3.4])), vel: [H.vel[0] + Math.cos(a) * 11, H.vel[1] - 3 + Math.random() * 4, H.vel[2] + Math.sin(a) * 11], life: 3 });
    }
    const R = S.megaFlare ? 50 : 25, T = S.megaFlare ? 6 : 3.5;
    let n = 0, off = 0;
    for (const z of this.horde.list) {
      if (!z.alive || Math.hypot(z.x - H.pos[0], z.z - H.pos[2]) > R) continue;
      if (z.st === 'grab') { z.st = 'fall'; z.slot = -1; z.vel = [(Math.random() - 0.5) * 8, 3, (Math.random() - 0.5) * 8]; off++; continue; }
      if (z.st === 'walk') { z.stun = T; n++; }
    }
    this.blasts.push({ pos: [...H.pos], t: 0, size: S.megaFlare ? 3 : 1.8, col: [1, 0.95, 0.8] });
    this.whiteT = Math.max(this.whiteT || 0, 0.25);
    this.feed(`FLASH! ${n} STUNNED${off ? ` · ${off} FELL OFF` : ''}`, 'y');
    this.snd.launch?.(); this.snd.tone?.(1800, 900, 0.3, 0.1);
  }
  // NOISE BEACONS: a screaming box that every zombie nearby walks to (and the boom ones blow up when they stop)
  dropBeacon() {
    const H = this.heli, S = this.S;
    if (!S.beacons) { this.feed('NO NOISE BEACONS FITTED · BUY THEM IN THE HANGAR', 'y'); return; }
    if (this.beaconsLeft <= 0) { this.feed('OUT OF BEACONS · LAND AT A BASE', 'y'); return; }
    this.beaconsLeft--;
    this.shots.push({ kind: 'beacon', pos: H.toWorld(mountAt(this.save.heli, 'beacon', [-0.8, 0.3, 3.4])), vel: [H.vel[0] * 0.8 - 2, H.vel[1] - 1, H.vel[2] * 0.8], life: 30 });
    this.snd.grappleRelease?.();
  }
  beaconLure() { const b = this.beacons && this.beacons[this.beacons.length - 1]; return b ? [b.pos[0], b.pos[2]] : null; }
  beaconTick(dt) {
    for (let i = this.beacons.length - 1; i >= 0; i--) {
      const b = this.beacons[i];
      b.t -= dt; b.beep = (b.beep || 0) - dt;
      if (b.beep <= 0) {
        b.beep = 0.6;
        const e = this.eye || b.pos, d = Math.hypot(b.pos[0] - e[0], b.pos[1] - e[1], b.pos[2] - e[2]);
        if (d < 300) this.snd.tone?.(1400, 1100, 0.15, 0.08 * Math.min(1, 60 / (d + 1)), 'square');
      }
      if (b.t <= 0) {
        if (b.boom) { this.blastAll(b.pos, 14, 600, 20, 'bomb'); this.boom(b.pos, 2.4); this.fires.push({ pos: b.pos, r: 8, t: 6, tick: 0 }); }
        this.beacons.splice(i, 1);
      }
    }
  }

  splat(p, killed) { if (killed && this.splats) { if (this.splats.length > 140) this.splats.shift(); this.splats.push({ x: p[0], y: this.groundAt(p[0], p[2]) + 0.05, z: p[2], r: 0.8 + Math.random() * 1.2, t: 0 }); } }

  bore() {
    const H = this.heli, a = 0.13;
    return { o: H.toWorld(mountAt(this.save.heli, 'gun', [0, -1.0, -4.6])), d: qrot(H.q, [0, -Math.sin(a), -Math.cos(a)]) };
  }
  // the nearest thing a ray hits: a wall, a zombie or something you can shoot (a nest)
  rayHit(o, d, max) {
    const w = this.world.raycast(o, d, max);
    let t = w ? w.t : max, res = { t, w };
    const zh = this.horde.hitRay(o, d, t);
    if (zh) { t = zh.t; res = { t, z: zh.z }; }
    for (const sh of this.shootList()) {
      const oc = [sh.pos[0] - o[0], sh.pos[1] - o[1], sh.pos[2] - o[2]], tc = oc[0] * d[0] + oc[1] * d[1] + oc[2] * d[2];
      if (tc < 0) continue;
      const d2 = oc[0] * oc[0] + oc[1] * oc[1] + oc[2] * oc[2] - tc * tc;
      if (d2 > sh.r * sh.r) continue;
      const th = tc - Math.sqrt(sh.r * sh.r - d2);
      if (th < t) { t = th; res = { t, sh }; }
    }
    res.p = [o[0] + d[0] * res.t, o[1] + d[1] * res.t, o[2] + d[2] * res.t];
    return res;
  }
  aimPoint() { const { o, d } = this.bore(); return this.rayHit(o, d, 400); }

  weapons(dt) {
    const S = this.S, G = S.gun;
    const firing = (this.btn.has(0) || this.clk.has(0) || this.key('KeyF')) && this.locked;
    this.overT = Math.max(0, this.overT - dt);
    if (firing && this.overT <= 0) {
      this.spinV = Math.min(1, this.spinV + dt * 4);
      this.gunT += dt * G.rate * (G.spin ? 0.35 + this.spinV * 0.65 : 1);
      while (this.gunT >= 1) {
        this.gunT -= 1;
        this.fireGun();
        this.heat += G.heat * (this.save.flight === 'easy' ? 0.8 : 1);
        if (this.heat >= 1) { this.heat = 1; this.overT = 2.2; this.feed('GUN OVERHEATED', 'r'); this.snd.fail?.(); break; }
      }
    } else { this.gunT = Math.min(this.gunT, 0.99); this.spinV = Math.max(0, this.spinV - dt * 1.5); this.heat = Math.max(0, this.heat - G.cool * dt * (this.overT > 0 ? 0.8 : 1)); }
    // gun pods on the wings fire with the nose gun
    this.podFlash = Math.max(0, (this.podFlash || 0) - dt);
    if (S.pods && firing && this.overT <= 0) {
      this.podT = (this.podT || 0) + dt * (S.pods === 1 ? 16 : 8);
      while (this.podT >= 1) { this.podT -= 1; this.podShot(); }
    }
    this.flashT = Math.max(0, this.flashT - dt);
    this.rocketT -= dt;
    if (S.rockets) {
      this.rocketRegen += dt;
      if (this.rocketRegen > 8 && this.rockets < S.rockets) { this.rocketRegen = 0; this.rockets++; }
      if ((this.btn.has(2) || this.clk.has(2)) && this.locked && this.rocketT <= 0 && this.rockets > 0) {
        this.rocketRegen = 0;
        if (S.swarm) { this.rocketT = 0.9; const n = Math.min(6, this.rockets); this.rockets -= n; this.fireSwarm(n); }
        else { this.rocketT = S.homing ? 0.42 : 0.24; this.rockets--; this.fireRocket(); }
      }
    } else if (this.clk.has(2)) this.feed('NO ROCKETS FITTED · BUY THEM IN THE HANGAR', 'y');
    this.bombT -= dt;
    if (this.hit('Space') && !this.heli.contacts) {
      if (!S.bombs) this.feed('NO BOMBS FITTED · BUY THEM IN THE HANGAR', 'y');
      else if (this.bombs > 0 && this.bombT <= 0) {
        this.bombT = 0.5; this.bombs--;
        const H = this.heli, p = H.toWorld([0, -1.9, 0.4]);
        this.shots.push({ kind: 'bomb', pos: p, vel: [H.vel[0], H.vel[1] - 2, H.vel[2]], life: 12, t: 0, cluster: S.cluster });
        this.snd.grappleRelease?.();
      } else if (this.bombs <= 0) this.feed('OUT OF BOMBS · LAND AT A BASE', 'y');
    }
    if (this.hit('KeyC')) { this.camMode = (this.camMode + 1) % 4; this.camEye = null; this.camLook = null; this.flash(['CHASE CAMERA', 'FAR CAMERA', 'NOSE CAMERA', 'COCKPIT'][this.camMode], 1200); }
    if (this.hit('KeyV') && S.vtol && !this.heli.dead) {
      const H = this.heli;
      H.planeMode = !H.planeMode;
      if (H.planeMode) H.thr = 1;
      this.banner(H.planeMode ? 'PLANE MODE' : 'HOVER MODE', H.planeMode ? 'KEEP YOUR SPEED UP · W / S THROTTLE' : 'FLIES LIKE A HELICOPTER', '', 1.4);
      this.snd.bolt?.();
    }
    if (this.hit('KeyM')) { this.bigMap = !this.bigMap; this.$('bigmap').classList.toggle('hidden', !this.bigMap); }
    if (this.hit('KeyZ') && S.nvg) { this.nvgOn = this.nvgOn === false; this.applyDay(); this.feed(this.nvgOn === false ? 'NIGHT VISION OFF' : 'NIGHT VISION ON', 'y'); }
    if (this.hit('KeyL') && this.S.light) { this.lightMode = this.lightMode === 'on' ? 'off' : this.lightMode === 'off' ? 'auto' : 'on'; this.feed(`SEARCHLIGHT: ${this.lightMode.toUpperCase()}`, 'y'); }
    if (this.hit('KeyB')) this.dropSupplies();
  }

  // ---- the gadgets: searchlight, belly turret, electric skids, medical bay
  gadgets(dt) {
    const H = this.heli, S = this.S, L = this.horde.list;
    // searchlight: on at night (or when you say), pointing ahead and down
    const want = S.light && !H.dead && (this.lightMode === 'on' || ((this.lightMode || 'auto') === 'auto' && this.night > 0.35));
    this.lightOn = !!want;
    if (want) {
      const a = H.toWorld(mountAt(this.save.heli, 'light', [0, -1.55, -3.4])), b = H.toWorld(mountAt(this.save.heli, 'light', [0, -1.55 - 0.62 * 10, -3.4 - 0.78 * 10]));
      this.spot = { pos: a, dir: norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), cos: S.light === 2 ? 0.9 : 0.94, on: S.light };
      if (S.light === 2) {
        this.spotT = (this.spotT || 0) - dt;
        if (this.spotT <= 0) {
          this.spotT = 0.3;
          const sp = this.spot;
          for (const z of L) {
            if (!z.alive || z.st !== 'walk') continue;
            const v = [z.x - sp.pos[0], z.y + 1 - sp.pos[1], z.z - sp.pos[2]], d = Math.hypot(...v);
            if (d < 140 && (v[0] * sp.dir[0] + v[1] * sp.dir[1] + v[2] * sp.dir[2]) / d > sp.cos - 0.02) z.stun = 0.6;
          }
        }
      }
    } else this.spot = null;
    // drones: they fly alongside; armed ones pick off anything climbing at you or hanging off the skids
    const nd = S.drones ? (S.drones === 3 ? 2 : 1) : 0;
    this.drones = this.drones || [];
    while (this.drones.length < nd) this.drones.push({ pos: [...H.pos], cd: 0, aim: null });
    this.drones.length = nd;
    this.drones.forEach((d, k) => {
      const side = k === 0 ? 1 : -1, a = H.heading + side * 1.2 + Math.sin(this.t * 0.7 + k) * 0.25;
      const want = [H.pos[0] - Math.sin(a) * 9, H.pos[1] + 3.5 + Math.sin(this.t * 1.3 + k * 2) * 0.6, H.pos[2] - Math.cos(a) * 9];
      for (let i = 0; i < 3; i++) d.pos[i] += (want[i] - d.pos[i]) * Math.min(1, dt * 2.5);
      if (S.drones < 2 || H.dead) return;
      d.cd -= dt;
      let tg = null, bd = 70;
      for (const z of L) {
        if (!z.alive || z.st === 'fall') continue;
        const pri = z.st === 'grab' ? 0 : z.st === 'pile' ? 10 : 25;
        const dd = Math.hypot(z.x - d.pos[0], z.y + 1 - d.pos[1], z.z - d.pos[2]) + pri;
        if (dd < bd) { bd = dd; tg = z; }
      }
      d.aim = tg ? [tg.x, tg.y + tg.s, tg.z] : null;
      if (tg && d.cd <= 0) {
        d.cd = 0.16;
        const dir = norm([tg.x - d.pos[0] + (Math.random() - 0.5) * 0.5, tg.y + tg.s - d.pos[1], tg.z - d.pos[2] + (Math.random() - 0.5) * 0.5]);
        const zh = this.horde.hitRay(d.pos, dir, 90);
        this.tracer(d.pos, dir, zh ? zh.t : 50, -1);
        if (zh) this.bullet(zh.z, 16, [dir[0] * 4, 2, dir[2] * 4], [zh.z.x, zh.z.y + 1, zh.z.z], 'drone', dir);
        d.flash = 0.05;
        if (Math.random() < 0.3) this.snd.click?.(2600, 0.14, 1);
      }
      d.flash = Math.max(0, (d.flash || 0) - dt);
    });
    // incendiary rounds: the ones you set alight keep burning
    for (const z of L) if (z.burn > 0 && z.alive) { z.burn -= dt; this.horde.damage(z, 18 * dt, [0, 0.3, 0], 'fire'); if (Math.random() < dt * 6) this.fx.flame([z.x + (Math.random() - 0.5) * 0.5, z.y + z.s * (0.8 + Math.random()), z.z + (Math.random() - 0.5) * 0.5], [0, 1.5, 0], 0.6); }
    // repairs: on the ground (and in the air with a crew chief)
    if (S.repair && !H.dead && this.hp < S.hp) {
      const onGround = H.contacts >= 2 && Math.hypot(...H.vel) < 2;
      const rate = onGround ? (S.repair === 2 ? 9 : 3.5) : (S.repair === 2 ? 2 : 0);
      if (rate) { this.hp = Math.min(S.hp, this.hp + rate * dt); if (onGround && Math.random() < dt * 3) this.fx.sparks(H.toWorld([(Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 3]), 2, [1, 0.85, 0.4], 3, 0.3, 0.04, 1); }
    }
    // electric skids: a zap every few seconds throws everyone off
    this.zap = Math.max(0, (this.zap || 0) - dt);
    if (S.zap && !H.dead) {
      this.zapCd = (this.zapCd || 0) - dt;
      const grabs = L.filter((z) => z.alive && z.st === 'grab');
      if (grabs.length && this.zapCd <= 0) {
        this.zapCd = 3.5; this.zap = 0.35;
        for (const z of grabs) { z.st = 'fall'; z.slot = -1; z.vel = [(Math.random() - 0.5) * 10, 4, (Math.random() - 0.5) * 10]; this.horde.damage(z, 30, z.vel, 'zap'); }
        this.fx.sparks(H.toWorld([0, -1.95, 0.2]), 30, [0.5, 0.75, 1], 8, 0.4, 0.04, 2);
        this.snd.click?.(5200, 0.5, 4); this.feed('ZAP!', 'y');
      }
    }
    // medical bay: the team heals on board
    if (S.medbay) for (const m of this.save.team) if (m.aboard && !m.raid && m.hp > 0 && m.hp < m.max) m.hp = Math.min(m.max, m.hp + (S.medbay === 2 ? 12 : 4) * dt);
    // supply chutes on their way down
    for (const c of this.chutes || []) {
      c.y = Math.max(c.top, c.y - 7 * dt);
      if (!c.done && c.y <= c.top) { c.done = true; c.t = 6; this.fx.dust([c.x, c.top, c.z], 6); }
      if (c.done) c.t -= dt;
    }
    if (this.chutes) this.chutes = this.chutes.filter((c) => !c.done || c.t > 0);
  }
  dropSupplies() {
    const S = this.S, rd = this.raid, H = this.heli;
    if (!S.drops) { this.feed('NO SUPPLY CHUTES FITTED (HANGAR)', 'y'); return; }
    if (!rd || rd.done) { this.feed('NOBODY TO DROP SUPPLIES TO', 'y'); return; }
    if (Math.hypot(rd.b.x - H.pos[0], rd.b.z - H.pos[2]) > 160) { this.feed('GET CLOSER TO YOUR TEAM\'S BUILDING', 'y'); return; }
    if ((this.dropCd || 0) > this.run.t) { this.feed(`CHUTES READY IN ${Math.ceil(this.dropCd - this.run.t)}s`, 'y'); return; }
    this.dropCd = this.run.t + 40;
    for (const m of rd.alive()) { m.medkit++; m.grenade++; if (S.drops === 2 && m.armor === 'none') m.armor = 'vest'; }
    if (S.drops === 2) rd.boost = 1.4;
    const p = H.toWorld([-1.6, -1, 0.5]);
    (this.chutes = this.chutes || []).push({ x: rd.b.x + (Math.random() - 0.5) * 4, z: rd.b.z + (Math.random() - 0.5) * 4, y: p[1], top: rd.b.top });
    rd.say(`SUPPLIES! +MEDKITS +GRENADES${S.drops === 2 ? ' +ARMOUR' : ''}`);
    this.snd.grappleRelease?.(); this.feed('SUPPLIES AWAY', 'g');
  }

  // HOVER HOLD: with nothing pressed and the stick back in the middle, the autopilot stops you and holds the spot
  holdOn(ctl) {
    const H = this.heli;
    if (!this.S || !this.S.hover || H.dead) return false;
    const idle = !ctl.coll && !ctl.yaw && !ctl.mx && !ctl.my && !ctl.pk && !ctl.rk && !ctl.boost && Math.abs(H.stickP || 0) < 0.07 && (ctl.mode === 'easy' || Math.abs(H.stickR || 0) < 0.07);
    this.holdT = idle ? (this.holdT || 0) + 1 / 60 : 0;
    return this.holdT > 0.4;
  }
  // GROUND PROXIMITY WARNING: look ahead along where you're going; if you'll hit something in under 2 seconds, say so
  gpwsTick(dt) {
    const H = this.heli, S = this.S;
    this.gpT = Math.max(0, (this.gpT || 0) - dt);
    if (!S || !S.gpws || H.dead) return;
    const v = H.vel, sp = Math.hypot(v[0], v[1], v[2]);
    if (sp < 12 || this.gpT > 0) return;
    const h = this.world.raycast(H.pos, v.map((q) => q / sp), sp * 2);
    if (h && h.t > 2) { this.gpT = 2.5; this.banner('PULL UP', 'TERRAIN AHEAD', 'bad', 1); this.snd.tone?.(700, 700, 0.12, 0.12, 'square'); setTimeout(() => this.snd.tone?.(700, 700, 0.12, 0.12, 'square'), 180); }
  }
  podX() { const eq = capEq(this.save.eq, this.save.heli); return eq.rockets || eq.bombs ? 2.7 : 1.8; }
  podShot() {
    const H = this.heli, S = this.S, side = (this.podSide = -(this.podSide || 1));
    const o = H.toWorld(mountAt(this.save.heli, 'rockets', [side * this.podX(), -0.72, -1.6]));
    const ap = this.aimPoint().p, d = norm([ap[0] - o[0], ap[1] - o[1], ap[2] - o[2]]), sp = 0.016;
    const dir = norm([d[0] + (Math.random() - 0.5) * sp, d[1] + (Math.random() - 0.5) * sp, d[2] + (Math.random() - 0.5) * sp]);
    this.podFlash = 0.05; this.podSideNow = side;
    if (S.pods === 2) {
      this.shots.push({ kind: 'plasma', cannon: true, pod: true, dmg: 60, splash: 2.4, pos: o, vel: [H.vel[0] + dir[0] * 320, H.vel[1] + dir[1] * 320, H.vel[2] + dir[2] * 320], life: 2 });
      this.snd.burst?.(0.07, 700, 0.22);
      return;
    }
    const h = this.rayHit(o, dir, 420);
    if (Math.random() < 0.5) this.tracer(o, dir, h.t, -1);
    if (h.z) this.hitMark(this.bullet(h.z, 30, [dir[0] * 5, 2, dir[2] * 5], h.p, 'pod', dir));
    else if (h.sh) h.sh.hit(30, this);
    else if (h.w && Math.random() < 0.4) this.fx.impact(h.p, h.w.normal, h.w.box.color);
    this.sndP = (this.sndP || 0) + 1; if (this.sndP % 2 === 0) this.snd.burst?.(0.04, 1500, 0.1);
  }
  // the marksman: picks the most dangerous zombie in reach (screamers, riot police, brutes, whatever's on the skids)
  marksman(dt) {
    const S = this.S, H = this.heli;
    if (!S.sniper || H.dead || this.mode === 'down') return;
    this.snipeT = (this.snipeT || 0) - dt;
    this.snipeFlash = Math.max(0, (this.snipeFlash || 0) - dt);
    if (this.snipeT > 0) return;
    const mp = H.toWorld(mountAt(this.save.heli, 'door', [-1.2, 0.2, 1.4]));
    const W = { screamer: 5, riot: 4, brute: S.sniper === 2 ? 6 : 1, bloater: 3, runner: 2 };
    let best = null, bs = 0;
    for (const z of this.horde.list) {
      if (!z.alive) continue;
      const dx = z.x - mp[0], dz = z.z - mp[2], d = Math.hypot(dx, dz);
      if (d > 170 || d < 4) continue;
      const sc = (z.st === 'grab' ? 9 : W[z.type] || 1) + (z.st === 'pile' ? 2 : 0) - d / 120;
      if (sc <= bs) continue;
      const v = norm([dx, z.y + z.s * 1.5 - mp[1], dz]);
      if (this.world.raycast(mp, v, Math.hypot(d, z.y + z.s * 1.5 - mp[1]) - 0.8)) continue;
      best = z; bs = sc;
    }
    if (!best) { this.snipeT = 0.4; return; }
    this.snipeT = S.sniper === 2 ? 1.2 : 1.5;
    const v = norm([best.x - mp[0], best.y + best.s * 1.55 - mp[1], best.z - mp[2]]);
    const L = Math.hypot(best.x - mp[0], best.y + best.s * 1.55 - mp[1], best.z - mp[2]);
    this.tracer(mp, v, L, -1);
    this.snipeFlash = 0.08;
    { const l = qrot([-H.q[0], -H.q[1], -H.q[2], H.q[3]], v); this.snipeAim = [Math.atan2(-l[0], -l[2]), Math.asin(clamp(l[1], -1, 1))]; }
    const dmg = S.sniper === 2 ? 420 : 150;
    const k = this.horde.damage(best, dmg, [v[0] * 8, 3, v[2] * 8], 'ap');
    if (S.sniper === 2) { const o = [best.x, best.y + best.s, best.z], h2 = this.horde.hitRay(o, v, 30); if (h2 && h2.z !== best) this.horde.damage(h2.z, dmg * 0.6, [v[0] * 6, 2, v[2] * 6], 'ap'); }
    this.splat([best.x, best.y + best.s * 1.5, best.z], k);
    this.snd.boom?.(0.14); this.snd.burst?.(0.06, 2600, 0.2);
  }
  fireGun() {
    const H = this.heli, G = this.S.gun;
    let { d } = this.bore();
    const x = G.barrels === 2 ? (this.gunSide = -(this.gunSide || 1)) * (G.cannon ? 0.52 : 0.42) : 0;
    const o = H.toWorld(mountAt(this.save.heli, 'gun', [x * 0.78, -1.0, -4.7]));
    // a little aim help: on EASY, bullets bend towards a zombie just off the crosshair
    if (this.save.flight === 'easy') {
      let best = null, bc = Math.cos(0.06);
      for (const z of this.horde.list) {
        if (!z.alive) continue;
        const v = [z.x - o[0], z.y + z.s - o[1], z.z - o[2]], l = Math.hypot(v[0], v[1], v[2]);
        if (l > 300) continue;
        const c = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / l;
        if (c > bc) { bc = c; best = v.map((q) => q / l); }
      }
      if (best) d = best;
    }
    const sp = G.spread;
    const dir = norm([d[0] + (Math.random() - 0.5) * sp * 2, d[1] + (Math.random() - 0.5) * sp * 2, d[2] + (Math.random() - 0.5) * sp * 2]);
    this.flashT = 0.04;
    if (G.rail) {
      // straight through everything in a line, up to the first wall
      const w = this.world.raycast(o, dir, 450), end = w ? w.t : 450;
      let n = 0;
      for (const z of this.rayAll(o, dir, end)) { if (this.horde.damage(z, G.dmg, [dir[0] * 14, 4, dir[2] * 14], 'gun')) n++; }
      for (const sh of this.shootList()) { const v = [sh.pos[0] - o[0], sh.pos[1] - o[1], sh.pos[2] - o[2]], tc = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]; if (tc > 0 && tc < end && Math.hypot(v[0] - dir[0] * tc, v[1] - dir[1] * tc, v[2] - dir[2] * tc) < sh.r) sh.hit(G.dmg, this); }
      const to = o.map((c, i) => c + dir[i] * end);
      this.beam(o, to, [0.5, 0.9, 1], 0.32, 0.35);
      if (w) { this.fx.sparks(to, 16, [0.5, 0.9, 1], 9, 0.5, 0.08, 1); this.fx.impact(to, w.normal, w.box.color); }
      this.hitMark(n > 0); this.shake = Math.max(this.shake, 0.25);
      this.snd.tone?.(2400, 120, 0.3, 0.2, 'sawtooth'); this.snd.boom?.(0.25);
      return;
    }
    if (G.laser) {
      const h = this.rayHit(o, dir, 320);
      if (h.z) this.hitZombie(h.z, G.dmg, [dir[0] * 2, 1, dir[2] * 2], h.p, 'gun');
      else if (h.sh) h.sh.hit(G.dmg, this);
      this.beam(o, h.p, [1, 0.2, 0.12], 0.16, 0.06);
      if (Math.random() < 0.5) this.fx.sparks(h.p, 3, [1, 0.5, 0.2], 5, 0.3, 0.05, 1);
      this.sndN = (this.sndN || 0) + 1;
      if (this.sndN % 6 === 0) this.snd.tone?.(700 + Math.random() * 60, 600, 0.12, 0.06, 'sawtooth');
      return;
    }
    if (G.plasma || G.cannon) {
      if (G.cannon) { this.shots.push({ kind: 'plasma', cannon: true, pos: o, vel: [H.vel[0] + dir[0] * 300, H.vel[1] + dir[1] * 300, H.vel[2] + dir[2] * 300], life: 2 }); this.snd.boom?.(0.18); this.snd.burst?.(0.08, 900, 0.3); this.shake = Math.max(this.shake, 0.12); return; }
      this.shots.push({ kind: 'plasma', pos: o, vel: [H.vel[0] + dir[0] * 260, H.vel[1] + dir[1] * 260, H.vel[2] + dir[2] * 260], life: 2 });
      this.snd.tone?.(900, 200, 0.18, 0.12, 'sawtooth');
      return;
    }
    const h = this.rayHit(o, dir, 420);
    if (Math.random() < 0.6) this.tracer(o, dir, h.t, -1);
    // brass casings spill out of the gun
    if (Math.random() < 0.5) {
      const r = qrot(H.q, [1, 0, 0]);
      this.fx.spawnPiece(H.toWorld([x + 0.25, -1.2, -3.4]), [0.05, 0.05, 0.13], [H.vel[0] + r[0] * 3 + (Math.random() - 0.5), H.vel[1] - 1, H.vel[2] + r[2] * 3 + (Math.random() - 0.5)], [0.85, 0.65, 0.25], 1.4);
    }
    if (h.z) { this.hitMark(this.bullet(h.z, G.dmg, [dir[0] * 6, 2, dir[2] * 6], h.p, 'gun', dir)); }
    else if (h.sh) { h.sh.hit(G.dmg, this); this.hitMark(false); this.fx.sparks(h.p, 3, [0.5, 1, 0.3], 4, 0.4, 0.06, 1); }
    else if (h.w) { this.fx.impact(h.p, h.w.normal, h.w.box.color); if (Math.random() < 0.3) this.fx.dust(h.p, 2); }
    this.sndN = (this.sndN || 0) + 1;
    if (G.rate < 20 || this.sndN % 2 === 0) { this.snd.burst?.(0.06, 1500, 0.22); this.snd.burst?.(0.03, 5000, 0.08, 'highpass'); }
  }
  // every zombie a ray passes through (for the railgun), nearest first
  rayAll(o, d, maxT) {
    const out = [];
    for (const z of this.horde.list) {
      if (!z.alive) continue;
      const r = 0.6 * z.s, c = [z.x - o[0], z.y + z.s - o[1], z.z - o[2]], tc = c[0] * d[0] + c[1] * d[1] + c[2] * d[2];
      if (tc < 0 || tc > maxT) continue;
      if (Math.hypot(c[0] - d[0] * tc, (c[1] - d[1] * tc) / 1.7, c[2] - d[2] * tc) < r) out.push([tc, z]);
    }
    return out.sort((a, b) => a[0] - b[0]).map((a) => a[1]);
  }
  beam(from, to, col, w, life) {
    (this.beams = this.beams || []).push({ from, to, col, w, t: life, life });
    if (this.nfx) this.nfx.push(['L', ...from.map(q1), ...to.map(q1), ...col, w, life]);
  }
  tracer(o, dir, len, seat) {
    this.tracers.push({ from: o, dir, len, d: 0 });
    if (this.nfx) this.nfx.push(['t', q1(o[0]), q1(o[1]), q1(o[2]), q2(dir[0]), q2(dir[1]), q2(dir[2]), Math.round(len), seat]);
  }

  hitZombie(z, dmg, push, at, cause) {
    const killed = this.horde.damage(z, dmg, push, cause);
    this.fx.spawnPiece(at, [0.08, 0.08, 0.08], [push[0] * 0.2 + (Math.random() - 0.5) * 3, 2 + Math.random() * 2, push[2] * 0.2 + (Math.random() - 0.5) * 3], [0.35, 0.05, 0.04], 0.7);
    this.hitMark(killed);
    return killed;
  }
  // a bullet hitting a zombie, with whatever ammo you've loaded: armour-piercing ignores riot armour and carries on
  // into the one behind; incendiary sets them alight
  bullet(z, dmg, push, at, cause, dir) {
    const S = this.S, ap = S.ammo === 1 || (S.gun.pierce && cause === 'gun'), inc = S.ammo === 2;
    const k = this.horde.damage(z, dmg, push, ap ? 'ap' : cause);
    this.fx.spawnPiece(at, [0.08, 0.08, 0.08], [push[0] * 0.2 + (Math.random() - 0.5) * 3, 2 + Math.random() * 2, push[2] * 0.2 + (Math.random() - 0.5) * 3], [0.35, 0.05, 0.04], 0.7);
    if (inc && z.alive) z.burn = Math.max(z.burn || 0, 3.2);
    if (ap && dir) {
      const o = [at[0] + dir[0] * 0.9, at[1] + dir[1] * 0.9, at[2] + dir[2] * 0.9], h2 = this.horde.hitRay(o, dir, 30);
      if (h2 && h2.z !== z) this.horde.damage(h2.z, dmg * 0.7, push, 'ap');
    }
    return k;
  }
  hitMark(kill) { const h = this.$('hit'); h.classList.toggle('kill', !!kill); h.style.opacity = 1; this.hitT = kill ? 0.25 : 0.1; }

  fireRocket() {
    const H = this.heli, S = this.S;
    this.rocketSide = 1 - this.rocketSide;
    const x = (this.rocketSide ? 1 : -1) * (this.save.eq.rockets === 2 ? (this.rockets % 4 < 2 ? 1.35 : 2.15) : this.save.eq.rockets === 3 ? 1.8 : 1.75);
    const o = H.toWorld(mountAt(this.save.heli, 'rockets', [x, -0.66, -0.7]));
    const aim = this.aimPoint();
    const dir = norm([aim.p[0] - o[0], aim.p[1] - o[1], aim.p[2] - o[2]]);
    let target = null;
    if (S.homing) {
      const { d } = this.bore();
      let best = 0;
      for (const z of this.horde.list) {
        if (!z.alive) continue;
        const v = [z.x - o[0], z.y + z.s - o[1], z.z - o[2]], l = Math.hypot(v[0], v[1], v[2]);
        if (l > 320) continue;
        const cs = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / l;
        if (cs < 0.96) continue;
        const sc = cs * 10 + z.s * 3 + (z.type === 'titan' ? 50 : 0) - l * 0.01;
        if (sc > best) { best = sc; target = z; }
      }
    }
    this.shots.push({ kind: 'rocket', pos: o, vel: [H.vel[0] + dir[0] * 120, H.vel[1] + dir[1] * 120, H.vel[2] + dir[2] * 120], life: 4, target, homing: S.homing, laser: S.tpod && !target ? aim.p : null });
    this.snd.launch?.();
  }

  // MINI NUKE: a flash, a shock ring, a mushroom cloud, and nothing left standing nearby
  // a bloater bursting: a spray of muck that knocks down (and kills) the ones round it, and stings if you're right there
  burst(p) {
    this.horde.blast(p, 6.5, 140, 9, 'bloater');
    this.fx.sparks(p, 22, [0.6, 0.75, 0.2], 10, 0.9, 0.12, 2);
    this.fx.dust(p, 6);
    this.splat(p, true);
    const H = this.heli, d = Math.hypot(p[0] - H.pos[0], p[1] - H.pos[1], p[2] - H.pos[2]);
    if (d < 9 && !H.dead) this.hurt(12 * (1 - d / 9), p);
    this.snd.splat?.();
  }
  // THERMOBARIC: a fuel-air bomb. A cloud of fuel, then one huge fireball and a pressure wave.
  thermobaric(p) {
    const H = this.heli;
    this.blastAll(p, 26, 2600, 30, 'bomb');
    for (let i = 0; i < 6; i++) this.boom([p[0] + (Math.random() - 0.5) * 26, p[1] + Math.random() * 4, p[2] + (Math.random() - 0.5) * 26], 2.2);
    this.blasts.push({ pos: [p[0], p[1] + 4, p[2]], t: 0, size: 5.5, col: [1, 0.7, 0.3] });
    this.blasts.push({ pos: [p[0], p[1] + 0.5, p[2]], t: 0, size: 6, ring: true });
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.28, r = Math.random() * 18;
      this.smokes.push({ pos: [p[0] + Math.cos(a) * r, p[1] + 2 + Math.random() * 14, p[2] + Math.sin(a) * r], t: 0, life: 6 + Math.random() * 4, size: 5 + Math.random() * 5, drift: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2], fire: 0.5 });
    }
    this.fires.push({ pos: p, r: 18, t: 8, tick: 0, big: true });
    const d = Math.hypot(p[0] - H.pos[0], p[1] - H.pos[1], p[2] - H.pos[2]);
    if (d < 35) { this.hurt(180 * (1 - d / 35), H.pos); this.feed('TOO CLOSE TO THE BLAST!', 'r'); }
    this.shake = 0.9; this.whiteT = 0.5;
    this.banner('THERMOBARIC', 'THE WHOLE CROWD\'S GONE', 'good', 2);
    this.snd.boom?.(1.4); setTimeout(() => this.snd.boom?.(0.9), 180);
  }


  // SWARM: little missiles that each pick a different zombie near where you're aiming
  fireSwarm(n) {
    const H = this.heli, { d } = this.bore(), aim = this.aimPoint();
    const cands = this.horde.list.filter((z) => {
      if (!z.alive) return false;
      const v = [z.x - H.pos[0], z.y + z.s - H.pos[1], z.z - H.pos[2]], l = Math.hypot(v[0], v[1], v[2]);
      return l < 260 && (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / l > 0.82;
    }).sort((a, b) => Math.hypot(a.x - aim.p[0], a.z - aim.p[2]) - Math.hypot(b.x - aim.p[0], b.z - aim.p[2]));
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, o = H.toWorld(mountAt(this.save.heli, 'rockets', [side * 1.75, -0.7, -0.6]));
      const spr = [(Math.random() - 0.5) * 0.5, 0.15 + Math.random() * 0.2, (Math.random() - 0.5) * 0.5];
      const dir = norm(d.map((c, k) => c + spr[k]));
      this.shots.push({ kind: 'rocket', mini: true, pos: o, vel: [H.vel[0] + dir[0] * 70, H.vel[1] + dir[1] * 70, H.vel[2] + dir[2] * 70], life: 4.5, target: cands[i % Math.max(1, cands.length)] || null, homing: true });
    }
    this.snd.launch?.(); setTimeout(() => this.snd.launch?.(), 90);
  }

  boom(p, size = 1) {
    this.blasts.push({ pos: [...p], t: 0, size });
    if (this.nfx) this.nfx.push(['b', q1(p[0]), q1(p[1]), q1(p[2]), q1(size)]);
    this.boomFx(p, size);
  }
  boomFx(p, size) {
    this.fx.sparks(p, 18 * size, [1, 0.6, 0.15], 14 * Math.sqrt(size), 0.7, 0.12, 3);
    if (this.smokes) for (let i = 0; i < 5 + size * 3; i++) {
      if (this.smokes.length > 220) this.smokes.shift();
      this.smokes.push({ pos: [p[0] + (Math.random() - 0.5) * 3 * size, p[1] + Math.random() * 2, p[2] + (Math.random() - 0.5) * 3 * size], t: 0, life: 4 + Math.random() * 3, size: 1.5 + size * 1.4 * Math.random(), drift: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2] });
    }
    if (this.blasts) this.blasts.push({ pos: [p[0], Math.max(p[1] - 0.5, 0.3), p[2]], t: 0, size, ring: true });
    for (let i = 0; i < 10 * size; i++) this.fx.flame([p[0] + (Math.random() - 0.5) * 2 * size, p[1] + Math.random(), p[2] + (Math.random() - 0.5) * 2 * size], [(Math.random() - 0.5) * 6, 3, (Math.random() - 0.5) * 6], 3 * size);
    for (let i = 0; i < 8 * size; i++) {
      const s = 0.4 + Math.random() * 0.8 * size;
      this.fx.spawnPiece([p[0] + (Math.random() - 0.5) * 2, p[1] + 0.5, p[2] + (Math.random() - 0.5) * 2], [s, s, s], [(Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4], [0.22, 0.2, 0.19], 2 + Math.random() * 2);
      this.fx.debris[this.fx.debris.length - 1].grav = -0.08;
    }
    const e = this.eye || p, dc = Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]);
    this.snd.boom?.(Math.min(1.2, size * 0.8 * (dc < 80 ? 1 : 80 / dc)));
    this.shake = Math.max(this.shake || 0, clamp(size * 18 / (dc || 1), 0, 0.9));
  }
  blastAll(p, r, dmg, force, cause) {
    const n = this.horde.blast(p, r, dmg, force, cause);
    for (const sh of this.shootList()) { const d = Math.hypot(sh.pos[0] - p[0], sh.pos[1] - p[1], sh.pos[2] - p[2]); if (d < r + sh.r) sh.hit(dmg * (1 - clamp((d - sh.r) / r, 0, 0.8)), this); }
    if (n) this.hitMark(true);
    return n;
  }

  updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      const prev = [...s.pos];
      if (s.kind === 'rocket') {
        if (s.homing && s.target && s.target.alive) {
          const tz = s.target, v = norm([tz.x - s.pos[0], tz.y + tz.s - s.pos[1], tz.z - s.pos[2]]), sp = Math.hypot(...s.vel);
          const cur = norm(s.vel), k = Math.min(1, dt * (s.mini ? 6 : 3.2));
          s.vel = norm(cur.map((c, j) => c + (v[j] - c) * k)).map((c) => c * Math.min(160, sp + dt * 40));
        }
        if (s.laser) {
          // laser guided: keep steering at the spot under the crosshair (it follows the crosshair as you move it)
          if (this.mode === 'fly' || this.mode === 'wing') s.laser = this.aimPoint().p;
          const v = norm([s.laser[0] - s.pos[0], s.laser[1] - s.pos[1], s.laser[2] - s.pos[2]]), sp = Math.hypot(...s.vel), cur = norm(s.vel), k = Math.min(1, dt * 4);
          s.vel = norm(cur.map((c, j) => c + (v[j] - c) * k)).map((c) => c * sp);
        } else s.vel[1] -= 2 * dt;
        if (Math.random() < 0.8) { this.fx.spawnPiece(s.pos, [0.35, 0.35, 0.35], [0, 0.4, 0], [0.55, 0.55, 0.55], 1.1); this.fx.debris[this.fx.debris.length - 1].noGravity = true; }
        this.fx.flame(s.pos, [0, 0, 0], 1.6);
      } else if (s.kind === 'bomb') {
        s.vel[1] -= 9.8 * dt; s.t += dt;
        if (s.cluster && s.t > 0.6) {
          for (let j = 0; j < 6; j++) { const a = (j / 6) * Math.PI * 2; this.shots.push({ kind: 'bomblet', pos: [...s.pos], vel: [s.vel[0] + Math.cos(a) * 7, s.vel[1], s.vel[2] + Math.sin(a) * 7], life: 10 }); }
          this.fx.sparks(s.pos, 10, [1, 0.8, 0.3], 5, 0.4, 0.06, 0);
          this.shots.splice(i, 1); continue;
        }
      } else if (s.kind === 'bomblet' || s.kind === 'beacon' || s.kind === 'grenade') s.vel[1] -= 9.8 * dt;
      else if (s.kind === 'flare') { s.vel[1] -= 4 * dt; s.vel = s.vel.map((v) => v * Math.exp(-1.2 * dt)); if (Math.random() < 0.7) this.fx.sparks(s.pos, 1, [1, 0.85, 0.4], 2, 0.4, 0.06, 0); }
      else if (s.kind === 'plasma' && Math.random() < 0.7) { this.fx.spawnPiece(s.pos, [0.25, 0.25, 0.25], [0, 0, 0], [0.4, 0.9, 1], 0.25, 1); this.fx.debris[this.fx.debris.length - 1].noGravity = true; }
      for (let k = 0; k < 3; k++) s.pos[k] += s.vel[k] * dt;
      const d = [s.pos[0] - prev[0], s.pos[1] - prev[1], s.pos[2] - prev[2]], dl = Math.hypot(d[0], d[1], d[2]) || 1e-6;
      const dir = d.map((v) => v / dl);
      const h = this.rayHit(prev, dir, dl);
      if (h.t >= dl && s.life > 0) continue;
      this.explode(s, h.t < dl ? h.p : s.pos, h);
      this.shots.splice(i, 1);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) { const t = this.tracers[i]; t.d += dt * 700; if (t.d > t.len) this.tracers.splice(i, 1); }
    for (let i = this.blasts.length - 1; i >= 0; i--) { const b = this.blasts[i]; b.t += dt; if (b.t > 0.5) this.blasts.splice(i, 1); }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t -= dt; f.tick -= dt;
      if (f.t <= 0) { this.fires.splice(i, 1); continue; }
      for (let j = 0; j < (f.big ? 7 : 3); j++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * f.r; this.fx.flame([f.pos[0] + Math.cos(a) * r, f.pos[1] + 0.2, f.pos[2] + Math.sin(a) * r], [0, 1.5, 0], 3.2); }
      if (f.tick <= 0) {
        f.tick = 0.25;
        for (const z of this.horde.list) if (z.alive && z.st !== 'grab' && Math.hypot(z.x - f.pos[0], z.z - f.pos[2]) < f.r && Math.abs(z.y - f.pos[1]) < 4) { if (this.horde.damage(z, z.type === 'titan' ? 60 : 22, [0, 3, 0], 'fire')) this.hitMark(true); }
      }
    }
  }

  explode(s, p, h) {
    const S = this.S;
    if (s.kind === 'plasma') {
      const dmg = s.dmg ?? S.gun.dmg;
      this.blastAll(p, s.splash ?? S.gun.splash, dmg, 8, 'gun');
      if (h.z) this.hitZombie(h.z, dmg, [s.vel[0] * 0.03, 3, s.vel[2] * 0.03], p, 'gun');
      if (s.pod) { this.fx.sparks(p, 8, [1, 0.6, 0.15], 8, 0.4, 0.08, 1); this.blasts.push({ pos: p, t: 0.25, size: 0.4 }); }
      else if (s.cannon) { this.boomFx(p, 0.55); this.blasts.push({ pos: p, t: 0.2, size: 0.6 }); }
      else { this.fx.sparks(p, 12, [0.5, 0.95, 1], 7, 0.4, 0.07, 1); this.blasts.push({ pos: p, t: 0.25, size: 0.5, col: [0.5, 0.95, 1] }); }
      return;
    }
    if (s.kind === 'rocket') { this.blastAll(p, S.rocketR, S.rocketDmg, 16, 'rocket'); this.boom(p, s.mini ? 0.8 : 1.2); return; }
    if (s.kind === 'flare') return;
    if (s.kind === 'beacon') { this.beacons.push({ pos: [p[0], h.z ? this.groundAt(p[0], p[2]) : p[1], p[2]], t: 25, boom: S.beaconBoom }); this.fx.dust(p, 4); this.feed('BEACON DOWN · THEY\'RE ALL GOING TO IT', 'y'); return; }
    if (s.kind === 'bomb' && S.thermo) { this.thermobaric(p); return; }
    if (s.kind === 'bomb' && S.napalm) { this.blastAll(p, 12, 380, 14, 'bomb'); this.boom(p, 2.2); this.fires.push({ pos: p, r: 17, t: 14, tick: 0, big: true }); return; }
    if (s.kind === 'bomb') { this.blastAll(p, 10, 420, 18, 'bomb'); this.boom(p, 2.2); this.fires.push({ pos: p, r: 9, t: 8, tick: 0 }); return; }
    if (s.kind === 'grenade') { this.blastAll(p, 4.5, 110, 9, 'grenade'); this.boom(p, 0.8); return; }
    if (s.kind === 'bomblet') { this.blastAll(p, 7, 320, 15, 'bomb'); this.boom(p, 1.3); this.fires.push({ pos: p, r: 5, t: 5, tick: 0 }); }
  }

  // door guns: AI gunners (the upgrade, or GUNNER crew with rifles) or friends online, who aim themselves
  doorSeats() {
    const S = this.S, g = S.gunners || 0, gunners = this.save.team.filter((m) => m.aboard && !m.raid && m.hp > 0 && m.role === 'rifleman').length;
    return [0, 1].map((sd) => {
      const fr = this.coop && [...this.coop.friends.values()].find((f) => f.seat === sd);
      if (fr) return { friend: fr, rate: S.doorMini ? 16 : 11, dmg: S.doorMini ? 22 : 26 };
      if (sd < g) return { ai: true, rate: (S.doorMini ? 18 : 10) * (gunners ? 1.3 : 1), dmg: S.doorMini ? 20 : 24 };
      if (sd < g + gunners) return { ai: true, rate: 6, dmg: 15, rifle: true };
      return null;
    });
  }
  // can a gun at `mp` see zombie z, and where would it aim (in the helicopter's frame)?
  sight(mp, z, inv, range) {
    const tp = [z.x, z.y + z.s * 1.1, z.z], v = [tp[0] - mp[0], tp[1] - mp[1], tp[2] - mp[2]], l = Math.hypot(v[0], v[1], v[2]);
    if (l > range || l < 1) return null;
    const d = v.map((c) => c / l);
    const w = this.world.raycast(mp, d, l - 0.8);
    if (w) return null;                                   // a wall's in the way
    const lv = qrot(inv, v);
    return { l, yaw: Math.atan2(-lv[0], -lv[2]), pitch: Math.asin(clamp(lv[1] / l, -1, 1)) };
  }
  // pick the most dangerous zombie this gun can actually see and reach
  pickTarget(mp, inv, arc, range) {
    const H = this.heli;
    let best = null, bs = Infinity;
    for (const z of this.horde.list) {
      if (!z.alive || z.st === 'mag') continue;
      if (Math.abs(z.x - mp[0]) > range || Math.abs(z.z - mp[2]) > range) continue;
      const sg = this.sight(mp, z, inv, range);
      if (!sg) continue;
      const dy = Math.atan2(Math.sin(sg.yaw - arc.yaw), Math.cos(sg.yaw - arc.yaw));
      if (Math.abs(dy) > arc.half || sg.pitch < -1.35 || sg.pitch > 0.45) continue;
      // grabbers first, then climbers, spitters, things close to you, then whatever's nearest
      let sc = sg.l;
      if (z.st === 'grab') sc -= 1000;
      else if (z.st === 'climb' || z.st === 'roof') sc -= 30;
      if (z.type === 'screamer') sc -= 25;
      if (z.st === 'pile') sc -= 12;
      if (z.tgt && z.tgt.sticky) sc -= 15;
      if (sc < bs) { bs = sc; best = z; }
    }
    void H;
    return best;
  }
  // aim a gun at its target, and fire only when it's actually pointing at it, in short bursts
  aiGun(g, mp, inv, arc, range, dt) {
    g.retarget = (g.retarget ?? 0) - dt;
    if (!g.tgt || !g.tgt.alive || g.retarget <= 0 || !this.sight(mp, g.tgt, inv, range + 6)) { g.tgt = this.pickTarget(mp, inv, arc, range); g.retarget = 0.5; }
    const z = g.tgt, a = g.aim;
    if (!z) { a[0] += Math.atan2(Math.sin(arc.yaw - a[0]), Math.cos(arc.yaw - a[0])) * Math.min(1, dt * 3); a[1] += (-0.3 - a[1]) * Math.min(1, dt * 3); return false; }
    // lead a running zombie a little
    const lead = Math.hypot(z.x - mp[0], z.z - mp[2]) / 300;
    const tp = { x: z.x + (z.dx || 0) * z.spd * lead, y: z.y, z: z.z + (z.dz || 0) * z.spd * lead, s: z.s };
    const sg = this.sight(mp, tp, inv, range + 6) || this.sight(mp, z, inv, range + 6);
    if (!sg) return false;
    const ey = Math.atan2(Math.sin(sg.yaw - a[0]), Math.cos(sg.yaw - a[0])), ep = sg.pitch - a[1];
    const turn = Math.min(1, dt * 9);
    a[0] += ey * turn; a[1] += ep * turn;
    const onTarget = Math.abs(ey) < 0.06 && Math.abs(ep) < 0.06;
    // bursts: fire for a moment, rest for a moment
    g.burst = (g.burst ?? 0) - dt;
    if (g.burst < -0.35) g.burst = 0.7 + Math.random() * 0.5;
    return onTarget && g.burst > 0;
  }
  doorGuns(dt) {
    const H = this.heli, seats = this.doorSeats(), S = this.S;
    const inv = [-H.q[0], -H.q[1], -H.q[2], H.q[3]];
    this.doorAI = this.doorAI || [{ aim: this.doorAim[0] }, { aim: this.doorAim[1] }];
    for (let sd = 0; sd < 2; sd++) {
      const seat = seats[sd];
      this.doorFlash[sd] = Math.max(0, this.doorFlash[sd] - dt);
      if (!seat || H.dead || this.mode === 'down') continue;
      const side = sd === 0 ? 1 : -1, a = this.doorAim[sd];
      const mp = H.toWorld(mountAt(this.save.heli, 'door', [side * 1.25, 0.1, 0.6]));
      this.doorT[sd] -= dt;
      let fire = false;
      if (seat.friend) {
        const f = seat.friend;
        a[0] += Math.atan2(Math.sin(f.aim[0] - a[0]), Math.cos(f.aim[0] - a[0])) * Math.min(1, dt * 20); a[1] += (f.aim[1] - a[1]) * Math.min(1, dt * 20);
        fire = f.fire;
      } else {
        const g = this.doorAI[sd]; g.aim = a;
        fire = this.aiGun(g, mp, inv, { yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2, half: 1.35 }, seat.rifle ? 55 : 65, dt);
      }
      if (fire && S.doorGL && !seat.friend) {
        // Mk 19: a 40 mm grenade every half second, lobbed at the crowd
        if (this.doorT[sd] <= -0.45) {
          this.doorT[sd] = 0;
          const dl = qrot(H.q, [-Math.sin(a[0]) * Math.cos(a[1]), Math.sin(a[1]) + 0.04, -Math.cos(a[0]) * Math.cos(a[1])]);
          this.shots.push({ kind: 'grenade', pos: mp.map((c, i) => c + dl[i] * 1.5), vel: [H.vel[0] + dl[0] * 75, H.vel[1] + dl[1] * 75, H.vel[2] + dl[2] * 75], life: 6 });
          this.doorFlash[sd] = 0.08;
          this.snd.burst?.(0.08, 500, 0.25);
        }
      } else if (fire && this.doorT[sd] <= -1 / seat.rate) {
        this.doorT[sd] = 0;
        this.gunShot(mp, a, seat.friend ? 0.02 : 0.03, seat.dmg, seat.friend ? sd : -1, seat.friend ? `friend${sd}` : 'door', (k) => { if (k && seat.friend) seat.friend.kills++; });
        this.doorFlash[sd] = 0.05;
        this.snd.burst?.(0.05, seat.rifle ? 2200 : 1200, 0.12);
      }
    }
  }
  // one bullet from a mounted gun aimed [yaw, pitch] in the helicopter's frame
  gunShot(mp, a, spr, dmg, seat, cause, onKill) {
    const H = this.heli;
    const dl = qrot(H.q, [-Math.sin(a[0]) * Math.cos(a[1]), Math.sin(a[1]), -Math.cos(a[0]) * Math.cos(a[1])]);
    const o = mp.map((c, i) => c + dl[i] * 1.5);
    const dir = norm([dl[0] + (Math.random() - 0.5) * spr, dl[1] + (Math.random() - 0.5) * spr, dl[2] + (Math.random() - 0.5) * spr]);
    const h = this.rayHit(o, dir, 120);
    this.tracer(o, dir, h.t, seat);
    if (h.z) { const k = this.bullet(h.z, dmg, [dir[0] * 5, 2, dir[2] * 5], h.p, cause, dir); this.splat(h.p, k); onKill?.(k); }
    else if (h.sh) h.sh.hit(dmg, this);
    else if (h.w) this.fx.impact(h.p, h.w.normal, h.w.box.color);
  }

  turrets(dt) {
    const gt = this.save.base.guns || 0, RANGE = [75, 95, 115][gt];
    for (const f of this.fobs) for (const tu of f.turrets) {
      tu.flash = Math.max(0, tu.flash - dt);
      tu.cd -= dt;
      if (f.locked || f.wrecked || Math.abs(tu.pos[0] - this.heli.pos[0]) > 450 || Math.abs(tu.pos[2] - this.heli.pos[2]) > 450) continue;
      let tg = null, best = f.id === 'spire' ? RANGE : 75;
      tu.re = (tu.re || 0) - dt;
      if (tu.tg && tu.tg.alive && tu.re > 0) { tg = tu.tg; best = Math.hypot(tg.x - tu.pos[0], tg.z - tu.pos[2]); }
      else {
        tu.re = 0.6;
        for (const z of this.horde.list) {
          if (!z.alive || z.st === 'grab' || z.st === 'mag') continue;
          const d = Math.hypot(z.x - tu.pos[0], z.z - tu.pos[2]);
          if (d >= best) continue;
          const v = norm([z.x - tu.pos[0], z.y + z.s - tu.pos[1], z.z - tu.pos[2]]);
          if (this.world.raycast(tu.pos, v, Math.hypot(d, z.y + z.s - tu.pos[1]) - 0.8)) continue;
          best = d; tg = z;
        }
        tu.tg = tg;
      }
      if (!tg) continue;
      const want = Math.atan2(-(tg.x - tu.pos[0]), -(tg.z - tu.pos[2]));
      tu.yaw += Math.atan2(Math.sin(want - tu.yaw), Math.cos(want - tu.yaw)) * Math.min(1, dt * 5);
      if (tu.cd <= 0) {
        const tier = f.id === 'spire' ? gt : 0;
        tu.cd = [0.18, 0.55, 0.045][tier];
        const o = [tu.pos[0] - Math.sin(tu.yaw) * 1.4, tu.pos[1], tu.pos[2] - Math.cos(tu.yaw) * 1.4];
        const dir = norm([tg.x - o[0] + (Math.random() - 0.5), tg.y + tg.s - o[1], tg.z - o[2] + (Math.random() - 0.5)]);
        const zh = this.horde.hitRay(o, dir, 160);
        this.tracer(o, dir, zh ? zh.t : best, -1);
        tu.flash = 0.05;
        if (tier === 1) {
          // Bofors: a 40 mm shell that bursts
          const p = zh ? o.map((c, i) => c + dir[i] * zh.t) : [tg.x, tg.y + 1, tg.z];
          this.blastAll(p, 3.5, 70, 7, 'shell');
          this.fx.sparks(p, 8, [1, 0.6, 0.15], 9, 0.5, 0.1, 2); this.blasts.push({ pos: p, t: 0, size: 0.5 });
          if (Math.hypot(p[0] - this.heli.pos[0], p[2] - this.heli.pos[2]) < 200) this.snd.boom?.(0.12);
        } else if (zh) this.horde.damage(zh.z, 14, [dir[0] * 4, 2, dir[2] * 4], 'turret');
      }
    }
  }

  // wrecked bases come back after a while
  fobTick(dt) {
    for (const f of this.fobs) if (f.wrecked) { f.wreckT -= dt; if (f.wreckT <= 0) { f.wrecked = false; f.hp = f.max * 0.6; this.feed(`${f.name} IS BACK UP`, 'g'); } }
  }

  // the streets full of them: how many depends on how busy the place was (the city is packed), and it's worse at night
  ambientSpawns(dt) {
    const G = this.map.ground, C = this.map.city, night = this.night || 0, t = this.run.t;
    const dens = (x, z) => {
      const g = G.at(x, z);
      const isl = Math.abs(x - C.x) < C.iw && Math.abs(z - C.z) < C.il ? 1.5 : 1;
      return (0.00028 + g.town * 0.0075 * isl) * (1 + night * 0.5);
    };
    const cap = (this.save.gfx === 'potato' ? 1200 : this.save.gfx === 'low' ? 1900 : (this.ql || 0) >= 4 ? 2800 : 4600) * (1 + night * 0.25);
    const inCity = G.at(this.heli.pos[0], this.heli.pos[2]).town > 0.3;
    const mix = () => pickType(night, t, inCity);
    const wings = this.wingSpots().filter(([x, z]) => Math.hypot(x - this.heli.pos[0], z - this.heli.pos[2]) > 400);
    const centers = [this.heli.pos, ...wings.map(([x, z, y]) => [x, y, z])];
    this.popI = ((this.popI || 0) + (this.horde.popT - dt <= 0 ? 1 : 0)) % centers.length;
    this.horde.populate(dt, centers[this.popI], dens, cap, mix);
  }

  // ---------------------------------------------------------------- landing: what you can do where you are
  landing(dt) {
    const H = this.heli, S = this.S;
    const ok = !H.dead && this.mode === 'fly', spd = Math.hypot(...H.vel);
    const settled = ok && H.contacts >= 2 && spd < 3.5;
    // forgiving: anywhere over (or just next to) the roof / pad, low and slow, counts. You don't even have to touch down.
    const near = (b, up) => {
      const h = H.pos[1] - 1.92 - b.max[1];
      return ok && spd < (S.winch ? 8 : 6) && H.pos[0] > b.min[0] - 4 && H.pos[0] < b.max[0] + 4 && H.pos[2] > b.min[2] - 4 && H.pos[2] < b.max[2] + 4 && h > -2 && h < up;
    };
    this.atFob = this.fobs.find((f) => !f.locked && (f.pads ? f.pads.some((p) => near(p.box, 6)) : near(f.pad, 6))) || null;
    this.atMast = !this.atFob && ok ? this.director.list.find((e) => e.kind === 'mast' && !e.working && near(e.mast.pad, 6)) || null : null;
    this.atRoof = this.director.list.find((e) => e.kind === 'rescue' && e.roof.active && e.roof.count > 0 && near(e.roof.pick || e.roof.box, S.hoist ? 52 : S.winch ? 32 : 12)) || null;
    this.nearCrate = ok && spd < 6 ? this.director.list.find((e) => e.kind === 'crate' && e.landed && !e.carried && Math.hypot(e.x - H.pos[0], e.z - H.pos[2]) < (S.winch ? 30 : 20) && H.pos[1] - e.y < (S.winch ? 40 : 14)) || null : null;
    this.settled = settled;
    const team = this.save.team, aboard = team.filter((m) => m.aboard && !m.raid && m.hp > 0);
    const seatsFree = S.seats - aboard.length - this.riders;
    this.seatsFree = seatsFree;
    const acts = [];
    if (S.plane && !S.vtol && !H.dead && this.mode === 'fly') this.planeActs(acts);
    if (this.atRoof) acts.push(['KeyE', 'E', this.boarding ? `LOADING… ${this.atRoof.roof.count} LEFT` : seatsFree <= 0 ? 'CABIN FULL' : `PICK UP ${this.atRoof.roof.count}`, () => { this.boarding = true; }]);
    const f = this.atFob;
    if (f && !f.wrecked) {
      if (this.riders > 0 && !f.fuelOnly) acts.push(['KeyE', 'E', this.unloading ? 'DROPPING OFF…' : `DROP OFF ${this.riders}`, () => { this.unloading = true; }]);
      if (this.crate && this.crate.carried && !f.fuelOnly) acts.push(['KeyE', 'E', 'DROP THE CRATE', () => this.deliverCrate()]);
      const pct = (v) => `${Math.round(v * 100)}%`;
      acts.push(['Digit1', '1', this.fuel >= S.fuel - 0.5 ? 'FUEL FULL' : this.svc === 'fuel' ? `REFUELLING ${pct(this.fuel / S.fuel)}` : `REFUEL (${pct(this.fuel / S.fuel)})`, () => { this.svc = 'fuel'; this.snd.click?.(1800, 0.3); }, this.fuel >= S.fuel - 0.5]);
      if (!f.fuelOnly) {
        acts.push(['Digit2', '2', this.hp >= S.hp ? 'NO DAMAGE' : this.svc === 'fix' ? `REPAIRING ${pct(this.hp / S.hp)}` : `REPAIR (${pct(this.hp / S.hp)})`, () => { this.svc = 'fix'; this.snd.click?.(1800, 0.3); }, this.hp >= S.hp]);
        const full = this.rockets >= S.rockets && this.bombs >= S.bombs && this.heat <= 0 && this.beaconsLeft >= S.beacons && this.flaresLeft >= S.flares;
        acts.push(['Digit3', '3', full ? 'ARMED' : 'REARM', () => { this.rockets = S.rockets; this.bombs = S.bombs; this.beaconsLeft = S.beacons; this.flaresLeft = S.flares; this.heat = 0; this.overT = 0; this.snd.magIn?.(); setTimeout(() => this.snd.bolt?.(), 200); this.feed('REARMED', 'g'); }, full]);
        acts.push(['KeyH', 'H', 'HANGAR', () => { this.session.fob = f; this.toHangar(); }, true]);
        acts.push(['KeyT', 'T', 'TEAM', () => this.openTeam(), true]);
      }
    } else if (f && f.wrecked) this.svc = null;
    if (this.atMast) acts.push(['KeyE', 'E', `DROP THE ENGINEER AT ${this.atMast.name}`, () => this.atMast.start(this)]);
    if (this.nearCrate && !this.crate) acts.push(['KeyE', 'E', 'HOOK ON THE CRATE', () => { this.crate = this.nearCrate; this.crate.carried = true; this.feed('CRATE HOOKED ON · TAKE IT TO THE SPIRE', 'y'); this.snd.grab?.(); }]);
    // ---- your team: send them into a building, and pick them up again
    const rd = this.raid;
    this.atLoot = null;
    if (!rd && ok) {
      const lb = this.map.loot.find((b) => !b.cleared && near(b.box, S.hook ? 30 : 10));
      const db = !lb && settled ? this.map.loot.find((b) => !b.cleared && Math.hypot(b.door[0] - H.pos[0], b.door[2] - H.pos[2]) < 32 && Math.abs(H.pos[1] - 1.92 - b.base) < 3) : null;
      const b = lb || db;
      if (b) {
        this.atLoot = b;
        const label = `RAID ${LOOT_TYPES[b.loot].n} · ${b.floors} FLOOR${b.floors > 1 ? 'S' : ''}`;
        if (aboard.length) acts.push(['KeyR', 'R', `${label} (FROM THE ${lb ? 'ROOF' : 'STREET'})`, () => this.startRaid(b, lb ? 'roof' : 'street', aboard)]);
        else acts.push(['KeyT', 'T', team.length ? 'NOBODY FROM YOUR TEAM IS ON BOARD' : 'YOU NEED A TEAM TO RAID · PRESS T', () => this.openTeam(), true]);
      }
    }
    if (rd && rd.phase === 'waiting') {
      const b = rd.b;
      const here = rd.meet === 'roof' ? near(b.box, S.winch ? 32 : 12) : ok && spd < 6 && Math.hypot(b.door[0] - H.pos[0], b.door[2] - H.pos[2]) < 32 && H.pos[1] - 1.92 - b.base < (S.winch ? 30 : 4);
      if (here) acts.push(['KeyE', 'E', 'PICK UP YOUR TEAM', () => this.pickupTeam()]);
    }
    if (settled && !f && !this.scav && this.riders > 0) acts.push(['KeyQ', 'Q', 'SEND FOR FUEL', () => this.sendForFuel(), true]);
    if (settled && !f && !this.drop && this.fuel < S.fuel * 0.3) acts.push(['KeyG', 'G', `FUEL DROP ${this.dropCost() ? `⚙${this.dropCost()}` : 'FREE'}`, () => this.callDrop(), true]);
    // quick service: fuel and repairs fill up in about a second
    if (!f || f.wrecked) this.svc = null;
    const dep = this.save.base.depot || 0, svk = dep >= 2 ? 30 : dep === 1 ? 2.4 : 1.2;
    if (this.svc === 'fuel') { this.fuelUp(S.fuel * svk * dt); if (this.fuel >= S.fuel) { this.svc = null; this.feed('TANK FULL', 'g'); this.snd.checkpoint?.(); } }
    if (this.svc === 'fix') { this.hp = Math.min(S.hp, this.hp + S.hp * (dep >= 2 ? 30 : 1.2) * dt); if (this.hp >= S.hp) { this.svc = null; this.feed('ALL FIXED', 'g'); this.snd.checkpoint?.(); } }
    this.actions = acts;
    for (const [code, , , fn] of acts) if (this.hit(code) && !this.panel) { fn(); break; }
    // let go of the mouse when you land somewhere you can do something, so you can click the buttons
    if (settled && acts.length && !this.wasSettled && this.locked) this.unlockSoft();
    this.wasSettled = settled && acts.length > 0;
    if (!this.atRoof) this.boarding = false;
    if (!this.atFob) this.unloading = false;
    if (this.scav && !settled && H.pos[1] - this.scav.y > 8 && !this.scav.left) {
      this.scav.left = true;
      const n = this.scav.team.length;
      this.run.lost += n;
      this.feed(`YOU LEFT ${n} ${n === 1 ? 'PERSON' : 'PEOPLE'} BEHIND`, 'r');
      this.scav = null;
    }
    // boarding
    if (this.boarding && this.atRoof) {
      const r = this.atRoof.roof;
      this.boardT -= dt;
      if (seatsFree <= 0) { this.boarding = false; this.feed('CABIN FULL · FLY BACK TO THE SPIRE', 'y'); }
      else if (r.count <= 0) this.boarding = false;
      else if (this.boardT <= 0) {
        this.boardT = S.hoist ? 0.1 : 0.3;
        r.count--; this.riders++;
        const ang = (r.start - r.count) * 2.1 + r.wave;
        this.runners.push({ from: [r.x + Math.cos(ang) * 2.4, r.top, r.z + Math.sin(ang) * 2.4], to: H.toWorld([1.3, -1.5, 0.7]), t: 0 });
        this.snd.step?.(1);
        if (r.count <= 0) { r.active = false; this.boarding = false; this.feed('ROOF CLEARED · EVERYONE\'S ON BOARD', 'g'); this.snd.checkpoint?.(); }
      }
    }
    // dropping off
    if (f && !f.wrecked) {
      if (this.unloading && this.riders > 0) {
        this.unloadT -= dt;
        if (this.unloadT <= 0) {
          this.unloadT = this.save.base.depot >= 2 ? 0.08 : 0.2; this.riders--; this.run.rescued++; this.save.rescued++;
          this.addScrap(25); this.storyHit('rescued', 1);
          this.runners.push({ from: H.toWorld([1.3, -1.5, 0.7]), to: [f.padAt[0] + 20, f.padAt[1], f.padAt[2] + 18], t: 0 });
          this.snd.coins?.();
          if (Math.random() < 0.3 && this.save.pool.length < 6) {
            const v = { name: randName(), role: ROLE_IDS[Math.floor(Math.random() * ROLE_IDS.length)] };
            this.save.pool.push(v);
            this.feed(`${v.name} (${ROLES[v.role].n}) WANTS TO JOIN YOUR TEAM · PRESS T`, 'y');
          }
          if (this.riders === 0) { this.unloading = false; this.feed(`SURVIVORS SAFE · ${this.run.rescued} SAVED`, 'g'); }
        }
      }
      this.servicing = !!this.svc;
    } else this.servicing = false;
    // fuel runs
    if (this.scav) {
      const sc = this.scav;
      sc.t -= dt;
      if (sc.t <= 0) this.scavBack();
    }
    if (this.drop) {
      const d = this.drop;
      d.y -= 7 * dt;
      const g = this.groundAt(d.x, d.z);
      if (d.y <= g) {
        const amt = (this.save.base.depot || 0) ? 140 : 70;
        this.fuelUp(amt); this.drop = null; this.fx.dust([d.x, g, d.z], 12);
        this.feed(`FUEL DROP RECEIVED · +${amt} FUEL`, 'g'); this.snd.checkpoint?.();
      }
    }
    for (let i = this.runners.length - 1; i >= 0; i--) { const r = this.runners[i]; r.t += dt * (r.slow ? 0.25 : 1.6); if (r.t >= 1) this.runners.splice(i, 1); }
  }

  // ---- raids
  startRaid(b, entry, members) {
    const H = this.heli;
    for (const m of members) { m.raid = true; if (this.S.medbay) { const b = this.S.medbay === 2 ? 60 : 30; m.hp = Math.min(m.max + b, m.hp + b); } }
    const to = entry === 'roof' ? [b.stair[0] + 1.6, b.stair[1], b.stair[2]] : [b.door[0], b.door[1], b.door[2] - 1];
    members.forEach((m, i) => this.runners.push({ from: H.toWorld([1.3, -1.5, 0.7]), to: [to[0] + (i % 3) * 0.6, to[1], to[2] + Math.floor(i / 3) * 0.6], t: -i * 0.25, team: m }));
    this.raid = new Raid(b, members, entry, entry, LOOT_TYPES);
    this.raid.saves = this.S.medbay === 2 ? 1 : 0;
    this.raid.doorT = { kind: 'chase', sticky: true, r: 2.2, alive: true, x: b.door[0], z: b.door[2] - 3, field: `door${b.box.id}` };
    this.raid.noiseT = 4; this.raid.spawned = 0;
    this.banner(`TEAM IN · ${LOOT_TYPES[b.loot].n}`, `${b.floors} FLOOR${b.floors > 1 ? 'S' : ''} · WATCH THEM ON THE TRACKER`, '', 2.6);
    this.snd.radio?.(); this.snd.checkpoint?.();
  }
  raidTick(dt) {
    const rd = this.raid, b = rd.b, H = this.heli;
    if (!this.panel) { if (this.hit('KeyY')) this.raidCmd('roof'); if (this.hit('KeyU')) this.raidCmd('street'); if (this.hit('KeyK')) this.raidCmd('out'); }
    rd.tick(dt);
    if (rd.news !== rd.lastNews) { rd.lastNews = rd.news; this.feed(`TEAM: ${rd.news}`, rd.news.includes('BITTEN') ? 'r' : 'y'); if (rd.news.includes('BITTEN')) this.snd.fail?.(); }
    if (rd.wiped) {
      this.banner('THE TEAM DIDN\'T MAKE IT', `${LOOT_TYPES[b.loot].n} WAS TOO MUCH FOR THEM`, 'bad', 3.4);
      this.save.team = this.save.team.filter((m) => !rd.team.includes(m));
      if (rd.roofT) rd.roofT.active = false; rd.doorT.alive = false;
      this.raid = null; saveSave(this.save); return;
    }
    const close = Math.hypot(b.x - H.pos[0], b.z - H.pos[2]) < 650;
    rd.noiseT -= dt;
    if (rd.phase !== 'waiting') {
      // the shooting inside draws them to the front door
      if (close && rd.noiseT <= 0 && rd.spawned < 22) { rd.noiseT = 3.2; rd.spawned++; this.spawnAround(b.door[0], b.door[2], rd.doorT); }
      return;
    }
    // waiting at the meeting point: zombies come; the team holds them off
    if (rd.meet === 'roof' && !rd.roofT) rd.roofT = { kind: 'roof', box: b.box, top: b.top, x: b.x, z: b.z, active: true, count: 0, team: true };
    const tgt = rd.meet === 'roof' ? rd.roofT : rd.doorT;
    if (close && rd.noiseT <= 0 && rd.spawned < 40) { rd.noiseT = 2.6; rd.spawned++; this.spawnAround(b.x, b.z, tgt); }
    const spot = this.teamSpot(rd);
    for (const [i, m] of rd.alive().entries()) {
      m.shootT = (m.shootT || 0) - dt;
      if (m.shootT > 0) continue;
      const p = [spot[0] + (i % 3) * 0.9 - 0.9, spot[1] + 1.4, spot[2] + Math.floor(i / 3) * 0.9];
      let best = null, bd = 34;
      for (const z of this.horde.list) { if (!z.alive || z.st === 'grab') continue; const d = Math.hypot(z.x - p[0], z.y + 1 - p[1], z.z - p[2]); if (d < bd) { bd = d; best = z; } }
      if (!best) { m.shootT = 0.4; continue; }
      const W = WEAPONS[m.wpn];
      m.shootT = 0.75 / W.p + Math.random() * 0.2;
      const dir = norm([best.x - p[0], best.y + best.s - p[1], best.z - p[2]]);
      this.tracer(p, dir, bd, -1);
      if (Math.random() < 0.75) { const k = this.horde.damage(best, 16 * W.p, [dir[0] * 4, 2, dir[2] * 4], 'team'); if (k) m.kills++; }
      this.snd.burst?.(0.04, 1800, 0.06);
      m.flashT = 0.06;
    }
  }
  // where the team is standing right now (roof door or street door)
  teamSpot(rd) { const b = rd.b; return rd.meet === 'roof' ? [b.stair[0] + 2.4, b.top, b.stair[2] + 1.5] : [b.door[0], b.base, b.door[2] - 1.5]; }
  spawnAround(x, z, tgt) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * 6.28, r = 50 + Math.random() * 60, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (Math.abs(px) > WORLD - 10 || Math.abs(pz) > WORLD - 10 || this.horde.blockedAt(px, pz)) continue;
      const rr = Math.random();
      const zb = this.horde.spawn(rr < 0.2 ? 'runner' : rr > 0.92 ? 'crawler' : 'walker', px, pz, { tgt });
      zb.keep = true;
      return zb;
    }
    return null;
  }
  hurtTeam(dmg) {
    const rd = this.raid; if (!rd) return;
    const live = rd.alive(); if (!live.length) return;
    const v = live[Math.floor(Math.random() * live.length)];
    v.hp -= dmg * ARMORS[v.armor].k;
    if (v.hp < 40 && v.medkit > 0) { v.medkit--; v.hp = Math.min(v.max, v.hp + 50); this.feed(`${v.name} USED A MEDKIT`, 'y'); }
    if (v.hp <= 0) { v.hp = 0; rd.lost.push(v); this.feed(`${v.name} WAS BITTEN`, 'r'); this.snd.fail?.(); }
  }
  pickupTeam() {
    const rd = this.raid, H = this.heli, b = rd.b, L = rd.loot;
    const live = rd.alive(), spot = this.teamSpot(rd);
    live.forEach((m, i) => { m.raid = false; m.aboard = true; m.raids++; this.runners.push({ from: [spot[0] + i * 0.7, spot[1], spot[2]], to: H.toWorld([1.3, -1.5, 0.7]), t: -i * 0.2 }); });
    this.save.team = this.save.team.filter((m) => !rd.lost.includes(m));
    // the haul
    this.addScrap(L.scrap); this.fuelUp(L.fuel);
    const st = this.save.stash;
    st.medkit += L.medkit; st.grenade += L.grenade;
    for (const w of L.weapon) st[w] = (st[w] || 0) + 1;
    for (const a of L.armor) st[a] = (st[a] || 0) + 1;
    const room = Math.max(0, this.S.seats - this.save.team.filter((m) => m.aboard).length - this.riders);
    const surv = Math.min(room, L.survivor);
    this.riders += surv;
    const bits = [L.scrap && `⚙${L.scrap}`, L.fuel && `${L.fuel} FUEL`, L.medkit && `${L.medkit} MEDKIT${L.medkit > 1 ? 'S' : ''}`, L.grenade && `${L.grenade} GRENADE${L.grenade > 1 ? 'S' : ''}`, L.weapon.length && L.weapon.map((w) => WEAPONS[w].n).join(', '), L.armor.length && L.armor.map((a) => ARMORS[a].n).join(', '), surv && `${surv} SURVIVOR${surv > 1 ? 'S' : ''}`].filter(Boolean);
    this.banner(rd.lost.length ? `${live.length} OF ${rd.team.length} CAME BACK` : 'EVERYONE\'S BACK', bits.join(' · ') || 'NOTHING FOUND', rd.lost.length ? 'bad' : 'good', 3.4);
    if (L.survivor > surv) this.feed(`NO ROOM FOR ${L.survivor - surv} SURVIVOR${L.survivor - surv > 1 ? 'S' : ''} · THEY'LL WAIT`, 'y');
    b.cleared = true;
    if (rd.roofT) rd.roofT.active = false; rd.doorT.alive = false;
    for (const z of this.horde.list) if (z.tgt === rd.roofT || z.tgt === rd.doorT) { z.tgt = null; z.keep = false; }
    this.raid = null;
    this.save.events = (this.save.events || 0) + 1;
    saveSave(this.save);
    this.snd.finish?.();
  }

  sendForFuel() {
    const H = this.heli;
    const team = [];
    for (let i = 0; i < this.riders; i++) team.push({ name: randName() });
    if (!team.length) return;
    this.riders = 0;
    this.scav = { t: 18, team, y: H.pos[1], x: H.pos[0], z: H.pos[2] };
    for (const m of team) {
      const a = Math.random() * 6.28;
      this.runners.push({ from: H.toWorld([1.3, -1.5, 0.7]), to: [H.pos[0] + Math.cos(a) * 30, H.pos[1] - 1.9, H.pos[2] + Math.sin(a) * 30], t: 0, slow: true });
    }
    this.banner('FUEL RUN', `${team.length} WENT LOOKING FOR FUEL · WAIT FOR THEM (18s)`, '', 2.4);
    this.snd.radio?.();
  }
  scavBack() {
    const sc = this.scav;
    this.scav = null;
    const nearZ = this.horde.list.filter((z) => z.alive && Math.hypot(z.x - sc.x, z.z - sc.z) < 70).length;
    let back = 0, fuel = 0;
    const died = [];
    for (const m of sc.team) {
      const p = clamp(0.25 + nearZ * 0.012, 0.25, 0.7);
      if (Math.random() < p) { died.push(m); this.run.lost++; continue; }
      fuel += 14; back++;
    }
    this.riders += back;
    this.fuelUp(fuel);
    for (const m of died) this.feed(`${m.name} DIDN'T MAKE IT BACK`, 'r');
    this.banner(fuel ? `+${Math.round(fuel)} FUEL` : 'NO FUEL FOUND', `${sc.team.length - died.length} OF ${sc.team.length} CAME BACK`, died.length ? 'bad' : 'good', 2.6);
    if (died.length) this.snd.fail?.(); else this.snd.checkpoint?.();
  }
  dropCost() { return [150, 60, 0][this.save.base.depot || 0]; }
  callDrop() {
    const cost = this.dropCost();
    if (this.save.scrap < cost) { this.feed(`NOT ENOUGH SCRAP FOR A FUEL DROP (${cost})`, 'r'); this.snd.fail?.(); return; }
    this.save.scrap -= cost;
    const H = this.heli.pos, a = Math.random() * 6.28;
    this.drop = { x: H[0] + Math.cos(a) * 9, y: H[1] + 70, z: H[2] + Math.sin(a) * 9 };
    this.feed('FUEL DROP ON ITS WAY · HOLD ON', 'y');
    this.snd.checkpoint?.();
  }
  // ---- PLANES and the jobs: a plane can't land on a roof, so it calls in a DUSTOFF (an AI rescue helicopter from the
  // Spire) and keeps the area clear while it works. Masts get their engineer by parachute.
  planeActs(acts) {
    const H = this.heli, P = H.pos, D = this.director.list;
    const hd = (e) => Math.hypot(e.x - P[0], e.z - P[2]);
    const busy = (e) => (this.dustoffs || []).some((d) => d.ev === e);
    const job = D.filter((e) => ((e.kind === 'rescue' || e.kind === 'crash') && e.roof && e.roof.active && e.roof.count > 0) || (e.kind === 'crate' && e.landed && !e.carried && !e.dust && !e.done))
      .filter((e) => !busy(e) && hd(e) < 800).sort((a, b) => hd(a) - hd(b))[0];
    if (job) acts.push(['KeyE', 'E', `CALL A DUSTOFF TO THE ${job.kind === 'crate' ? 'SUPPLY DROP' : job.evac ? 'HOSPITAL' : 'SURVIVORS'} (${Math.round(hd(job))} M)`, () => this.callDustoff(job)]);
    const mast = D.find((e) => e.kind === 'mast' && !e.working && hd(e) < 260 && P[1] - e.mast.y < 300);
    if (mast) acts.push(['KeyE', 'E', `PARACHUTE THE ENGINEER IN AT ${mast.name}`, () => { mast.start(this); this.feed('ENGINEER AWAY · CHUTE OPEN', 'g'); }]);
  }
  callDustoff(ev, who) {
    const sp = this.map.spire, n = (this.dustoffs || []).length;
    if (n >= 3) { this.feed('ALL THREE DUSTOFFS ARE OUT · WAIT FOR ONE TO COME BACK', 'y'); return; }
    this.dustoffs = this.dustoffs || [];
    this.dustoffs.push({ ev, pos: [sp.padAt[0], sp.padAt[1] + 2, sp.padAt[2]], yaw: 0, phase: 'in', riders: 0, t: 0, rotorA: 0, hotT: 0, H: mat4() });
    this.feed(`${who ? `${who} CALLED A DUSTOFF · ` : ''}DUSTOFF ${n + 1} LAUNCHING FROM THE SPIRE · KEEP THE ${ev.kind === 'crate' ? 'DROP' : 'ROOF'} CLEAR`, 'g');
    this.radio(ev.kind === 'crate' ? 'Dustoff launching for the supply drop. Keep them off it till we\'ve got it hooked.' : 'Dustoff launching. We\'ll get them off that roof, pilot, you keep the dead off it.', 6);
    this.snd.checkpoint?.();
  }
  dustoffTick(dt) {
    const L = this.dustoffs; if (!L || !L.length) return;
    const sp = this.map.spire, home = [sp.padAt[0], sp.padAt[1] + 3, sp.padAt[2]];
    for (let i = L.length - 1; i >= 0; i--) {
      const d = L[i], e = d.ev, crate = e.kind === 'crate';
      d.t += dt; d.rotorA += dt * 26;
      const r = e.roof, spot = crate ? [e.x, e.y + 9, e.z] : [r.sx0 ?? r.x, r.top + 3.5, r.sz0 ?? r.z];
      const gone = crate ? e.done && !e.dust : !r.active || r.count <= 0;
      if (d.phase !== 'out' && gone && !d.riders && !e.dust) d.phase = 'out';
      const goal = d.phase === 'out' ? home : spot;
      // fly high between places, then come straight down
      const dx = goal[0] - d.pos[0], dz = goal[2] - d.pos[2], dh = Math.hypot(dx, dz);
      const wantY = dh > 60 ? Math.max(goal[1], home[1], this.groundAt(d.pos[0], d.pos[2])) + 150 : goal[1];
      const hs = Math.min(dh, 70 * dt), vs = clamp(wantY - d.pos[1], -16 * dt, 16 * dt);
      if (dh > 0.01) { d.pos[0] += (dx / dh) * hs; d.pos[2] += (dz / dh) * hs; if (dh > 5) d.yaw = Math.atan2(-dx, -dz); }
      d.pos[1] += vs;
      const there = dh < 2 && Math.abs(d.pos[1] - goal[1]) < 1.5;
      if (!there) continue;
      if (d.phase === 'in') d.phase = 'load';
      if (d.phase === 'load') {
        if (crate) { if (!e.dust) { e.dust = d; this.feed('DUSTOFF HAS THE CRATE HOOKED', 'g'); } d.loadT = (d.loadT || 0) + dt; if (d.loadT > 2) d.phase = 'out'; continue; }
        // a hot landing zone: zombies on the roof (or the pile right at the top) stop the loading
        const hot = this.horde.list.filter((z) => z.alive && Math.abs(z.x - r.x) < (r.sx || 14) / 2 + 3 && Math.abs(z.z - r.z) < (r.sz || 14) / 2 + 3 && z.y > r.top - 3).length;
        d.hotT -= dt;
        if (hot > 1) { if (d.hotT <= 0) { d.hotT = 5; this.feed(`DUSTOFF: ${hot} ON THE ROOF · CLEAR IT AND WE'LL LOAD`, 'y'); } continue; }
        d.loadT = (d.loadT || 0) - dt;
        if (d.loadT <= 0 && r.count > 0 && d.riders < 12) { d.loadT = 0.6; r.count--; d.riders++; if (r.count <= 0) r.active = false; }
        if (r.count <= 0 || d.riders >= 12) d.phase = 'out';
        continue;
      }
      // home: hand them over
      if (crate && e.dust) { e.dust = null; e.done = true; this.addScrap(250); this.save.events = (this.save.events || 0) + 1; this.banner('CRATE DELIVERED BY THE DUSTOFF', '+250 SCRAP', 'good', 2.2); this.storyHit('crate', 1); }
      if (d.riders) {
        const n = d.riders; d.riders = 0;
        if (this.run) this.run.rescued += n; this.save.rescued += n; this.addScrap(25 * n); this.storyHit('rescued', n);
        this.feed(`THE DUSTOFF BROUGHT ${n} HOME · +⚙${25 * n}`, 'g'); this.snd.coins?.();
      }
      if (!crate && r.active && r.count > 0) { d.phase = 'in'; d.loadT = 0; this.feed('DUSTOFF GOING BACK FOR THE REST', 'g'); }
      else L.splice(i, 1);
    }
  }
  // the dustoffs to draw: the host's own, or (for friends) the ones the host told us about
  dustList() {
    if (!this.client) return this.dustoffs || [];
    const cl = this.client;
    return (cl.dos || []).map((q, i) => {
      const d = (cl.doH || (cl.doH = []))[i] || (cl.doH[i] = { H: mat4() });
      return Object.assign(d, { pos: [q[0], q[1], q[2]], yaw: q[3] / 100, riders: q[4], phase: ['in', 'load', 'out'][q[5]] || 'in', crate: !!q[6], id: q[7], rotorA: this.t * 26 });
    });
  }
  dustMarks() {
    return this.dustList().map((d) => ({ p: [d.pos[0], d.pos[1] + 4, d.pos[2]], col: '#7dff9a', icon: '✚', text: 'DUSTOFF', sub: d.phase === 'load' ? ((d.ev ? d.ev.kind === 'crate' : d.crate) ? 'HOOKING THE CRATE' : `LOADING · ${d.riders} ABOARD`) : d.phase === 'out' ? `HEADING HOME${d.riders ? ` · ${d.riders} ABOARD` : ''}` : 'ON ITS WAY' }));
  }
  dustoffParts(out) {
    const L = this.dustList(), e = this.eye; if (!L.length || !e) return;
    for (const d of L) {
      if (Math.hypot(d.pos[0] - e[0], d.pos[2] - e[2]) > 1600) continue;
      qmat(d.H, [0, Math.sin(d.yaw / 2), 0, Math.cos(d.yaw / 2)], d.pos);
      try { for (const p of chopperParts({ door: 1, cabin: 2, winch: 1 }, { ...PAINT.rescue, camo: 0, nose: 'none', tailArt: 'bands' }, { rotorA: d.rotorA, tailA: d.rotorA * 2.6, rpm: 1, spin: 0, t: this.t, riders: d.riders, crew: [], rockets: 0, rocketMax: 0, bombs: 0, bombMax: 0, doorAim: [[-1.57, -0.3], [1.57, -0.3]], doorFlash: [0, 0] }, d.H, 'warhorse')) out.push(p); } catch (err) { console.error(err); }
    }
  }
  deliverCrate() {
    const c = this.crate;
    c.carried = false; c.done = true; this.crate = null;
    this.addScrap(250); this.fuelUp(this.S.fuel);
    this.save.events = (this.save.events || 0) + 1;
    this.banner('CRATE DELIVERED', '+250 SCRAP · FUEL TOPPED UP', 'good', 2.2); this.snd.finish?.();
    this.storyHit('crate', 1);
  }

  addScrap(n) { if (this.run) this.run.scrap += n; this.save.scrap += n; }
  feed(t, c = '') {
    const f = this.$('feed'), d = document.createElement('div');
    d.textContent = t; d.className = c; f.prepend(d);
    while (f.children.length > 6) f.lastChild.remove();
    setTimeout(() => d.remove(), 2500);
    if (this.nfx) this.nfx.push(['f', t, c]);
  }
  banner(t, s, cls = '', dur = 2) {
    const b = this.$('banner'); b.className = `da-banner ${cls}`; b.querySelector('b').textContent = t; b.querySelector('span').textContent = s; b.style.opacity = 1;
    clearTimeout(this.banT); this.banT = setTimeout(() => { b.style.opacity = 0; }, dur * 1000);
    if (this.nfx) this.nfx.push(['B', t, s, cls, dur]);
  }

  hordeEvents() {
    const H = this.heli, run = this.run;
    for (const ev of this.horde.events) {
      if (ev.type === 'kill') {
        run.kills++;
        this.storyHit('kills', 1);
        if (ev.z.type === 'bloater') this.burst([ev.z.x, ev.z.y + 1.1, ev.z.z]);
        this.splat([ev.z.x, ev.z.y, ev.z.z], true);
        const T = TYPES[ev.z.type];
        this.addScrap(Math.round(T.scrap * (1 + (this.night || 0) * 0.5)));
        if (this.nfx) this.nfx.push(['k', q1(ev.z.x), q1(ev.z.y), q1(ev.z.z), ZT.indexOf(ev.z.type)]);
        if (false) {
          const p = [ev.z.x, 8, ev.z.z];
          for (let i = 0; i < 6; i++) setTimeout(() => this.boom([p[0] + (Math.random() - 0.5) * 16, 2 + Math.random() * 14, p[2] + (Math.random() - 0.5) * 16], 2.5), i * 220);
          this.save.titans++;
          this.banner('TITAN DOWN', `+${T.scrap} SCRAP`, 'good', 3.5);
          this.snd.finish?.();
        }
      } else if (ev.type === 'eaten') {
        ev.roof.eaten = (ev.roof.eaten || 0) + 1;
        run.lost++;
        this.feed('A SURVIVOR WAS GRABBED', 'r');
        if (ev.roof.count <= 0) { ev.roof.active = false; this.banner('SURVIVORS LOST', 'THE ZOMBIES GOT TO THEM FIRST', 'bad', 2); this.snd.fail?.(); }
      } else if (ev.type === 'hitHeli') {
        if (this.mode === 'down') continue;
        this.hurt(ev.shot.dmg, ev.shot.pos);
        if (ev.shot.kind === 'glob') this.fx.sparks(ev.shot.pos, 14, [0.4, 1, 0.2], 5, 0.6, 0.08, 1);
        else { this.fx.sparks(ev.shot.pos, 14, [0.6, 0.55, 0.5], 6, 0.8, 0.2, 2); this.snd.meleeWall?.('smash'); }
        this.feed(ev.shot.kind === 'glob' ? 'ACID HIT' : ev.shot.kind === 'car' ? 'THE TITAN THREW A CAR AT YOU' : 'HIT BY RUBBLE', 'r');
      } else if (ev.type === 'claw') { if (this.mode !== 'down') this.hurt(ev.dmg, H.pos); }
      else if (ev.type === 'grab') { this.feed('ZOMBIE ON THE SKIDS · CLIMB FAST OR SWING ABOUT TO SHAKE IT OFF', 'r'); this.snd.grab?.(); }
      else if (ev.type === 'shook') this.snd.grappleRelease?.();
      else if (ev.type === 'baseHit') {
        const f = ev.fob;
        if (f.wrecked) continue;
        f.hp -= ev.dmg;
        if (!f.warnT || run.t - f.warnT > 10) { f.warnT = run.t; this.feed(`${f.name} IS UNDER ATTACK`, 'r'); }
        if (f.hp <= 0) {
          f.hp = 0; f.wrecked = true; f.wreckT = 120;
          this.banner(`${f.name} WRECKED`, 'NO FUEL OR REPAIRS THERE FOR 2 MINUTES', 'bad', 2.6); this.snd.fail?.();
          for (const z of this.horde.list) if (z.tgt === f) { z.tgt = null; z.keep = false; }
        }
      } else if (ev.type === 'scream') {
        this.feed('A SCREAMER SPOTTED YOU · THE HORDE IS COMING', 'r');
        const zp = ev.z;
        for (let i = 0; i < 10; i++) { const n = this.spawnAround(zp.x, zp.z, null); if (n) { n.angry = 14; n.keep = false; } }
        this.snd.tone?.(1400, 300, 0.9, 0.2, 'sawtooth');
      } else if (ev.type === 'hitTeam') { this.hurtTeam(ev.z.type === 'runner' ? 8 : 6); }
      else if (ev.type === 'hitTarget' && this.raid && ev.tgt === this.raid.doorT) { if (this.raid.phase === 'waiting' && this.raid.meet === 'street') this.hurtTeam(6); }
      else if (ev.type === 'hitTarget') {
        const e = this.director.list.find((x) => (x.trucks && x.trucks.includes(ev.tgt)) || x.tgt === ev.tgt);
        if (e && e.hitTarget) e.hitTarget(ev.tgt, ev.dmg, this);
      }
      else if (ev.type === 'throw' && ev.big) this.snd.slam?.(0.6);
      else if (ev.type === 'stomp') { const d = Math.hypot(ev.z.x - H.pos[0], ev.z.z - H.pos[2]); if (d < 120) { this.shake = Math.max(this.shake, 0.4 * (1 - d / 120)); this.snd.boom?.(0.4 * (1 - d / 120)); this.fx.dust([ev.z.x, 0.3, ev.z.z], 10); } }
    }
    this.horde.events.length = 0;
  }

  ambient(dt) {
    const H = this.heli, ce = this.eye || H.pos;
    this.ambT = (this.ambT || 0) + dt;
    if (this.ambT > 0.06) {
      this.ambT = 0;
      for (const b of this.map.burning) {
        if (Math.abs(b[0] - ce[0]) > 220 || Math.abs(b[2] - ce[2]) > 220) continue;
        this.fx.flame([b[0] + (Math.random() - 0.5) * 1.5, b[1], b[2] + (Math.random() - 0.5) * 3], [0, 1, 0], 3);
        if (Math.random() < 0.3) { this.fx.spawnPiece([b[0], b[1] + 1.5, b[2]], [1.1, 1.1, 1.1], [(Math.random() - 0.5), 1.5, (Math.random() - 0.5)], [0.12, 0.11, 0.1], 3.5); this.fx.debris[this.fx.debris.length - 1].grav = -0.04; }
      }
      const hpk = this.hp / this.S.hp;
      if (hpk < 0.5 && this.mode !== 'down') {
        const p = H.toWorld([0, 1.5, 1.8]);
        this.fx.spawnPiece(p, [0.6, 0.6, 0.6], [H.vel[0] * 0.3, 1.5, H.vel[2] * 0.3], hpk < 0.25 ? [0.08, 0.08, 0.08] : [0.3, 0.3, 0.3], 1.6);
        this.fx.debris[this.fx.debris.length - 1].grav = -0.05;
        if (hpk < 0.25) this.fx.flame(p, [0, 1, 0], 2.4);
      }
      for (const e of this.director.list) if (e.kind === 'rescue' && e.roof.count > 0 && Math.abs(e.x - ce[0]) < 300 && Math.abs(e.z - ce[2]) < 300) this.fx.sparks([(e.roof.sx0 ?? e.x) + 2.2, e.roof.top + 0.6, (e.roof.sz0 ?? e.z) - 2.2], 1, [0.3, 1, 0.3], 1.5, 0.8, 0.12, 4);
      for (const f of this.fobs) if (f.wrecked && Math.abs(f.padAt[0] - ce[0]) < 300 && Math.abs(f.padAt[2] - ce[2]) < 300) this.fx.flame([f.padAt[0] + (Math.random() - 0.5) * 30, 0.5, f.padAt[2] + (Math.random() - 0.5) * 30], [0, 1, 0], 4);
    }
    if (H.boost > 0.2) for (const x of [-1, 1]) { const p = H.toWorld([x, 1.32, 3]); this.fx.spawnPiece(p, [0.3, 0.3, 0.3], [0, 0, 0], [0.5, 0.75, 1], 0.2, 1); this.fx.debris[this.fx.debris.length - 1].noGravity = true; }
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.dmgT = Math.max(0, this.dmgT - dt * 1.2);
    this.ageSmoke(dt);
    // rotor wash kicks up dust when you're low
    if (this.agl < 14 && H.rpm > 0.7 && this.mode === 'fly') {
      this.washT = (this.washT || 0) - dt;
      if (this.washT <= 0) {
        this.washT = 0.05;
        const a = Math.random() * 6.28, r = 3 + Math.random() * 6, g = this.groundAt(H.pos[0], H.pos[2]);
        const k = 1 - this.agl / 14;
        this.fx.spawnPiece([H.pos[0] + Math.cos(a) * r, g + 0.3, H.pos[2] + Math.sin(a) * r], [0.5 * k + 0.2, 0.5 * k + 0.2, 0.5 * k + 0.2], [Math.cos(a) * 9 * k, 0.8, Math.sin(a) * 9 * k], [0.62, 0.58, 0.5], 0.8);
        this.fx.debris[this.fx.debris.length - 1].noGravity = true;
      }
    }
  }
  ageSmoke(dt) { for (let i = this.smokes.length - 1; i >= 0; i--) { const s = this.smokes[i]; s.t += dt; if (s.t > s.life) this.smokes.splice(i, 1); } }

  pause(on) {
    const p = this.$('pause');
    if (on) {
      if (this.mode !== 'fly' && this.mode !== 'gunner' && this.mode !== 'wing') return;
      this.mode = this.mode === 'gunner' ? 'gpause' : this.mode === 'wing' ? 'wpause' : 'pause';
      const gun = this.mode === 'gpause' || this.mode === 'wpause';
      p.innerHTML = `<h2>PAUSED</h2><p>${this.mode === 'wpause' ? 'You\'re online: your helicopter is still out there!' : gun ? 'You\'re still in the door. The pilot keeps flying.' : this.coop ? 'Your friends are still flying with you — the game keeps going.' : 'Your chopper is hovering. Zombies are waiting.'}</p>
        <div class="row"><button class="alt" data-x="gfx" type="button">GRAPHICS: ${GFXNAME[this.save.gfx || 'auto']}</button></div><div class="row"><button data-x="resume" type="button">RESUME</button>${gun ? '' : '<button class="alt" data-x="team" type="button">TEAM</button>'}<button class="alt" data-x="quit" type="button">${gun ? 'LEAVE' : 'QUIT TO TITLE'}</button></div>`;
      p.querySelector('[data-x=gfx]').onclick = (e) => { this.save.gfx = GFXNEXT[this.save.gfx || 'auto']; this.ql = null; this.pfT = 0; this.pfN = 0; saveSave(this.save); e.target.textContent = `GRAPHICS: ${GFXNAME[this.save.gfx]}`; };
      p.querySelector('[data-x=resume]').onclick = () => { this.pause(false); this.lock(); };
      p.querySelector('[data-x=team]')?.addEventListener('click', () => { this.pause(false); this.openTeam(); });
      p.querySelector('[data-x=quit]').onclick = () => { this.pause(false); this.close(); };
      p.classList.remove('hidden'); this.stopAudio();
    } else if (this.mode === 'pause' || this.mode === 'gpause' || this.mode === 'wpause') { this.mode = this.mode === 'gpause' ? 'gunner' : this.mode === 'wpause' ? 'wing' : 'fly'; p.classList.add('hidden'); this.startAudio(); }
  }

  // ---------------------------------------------------------------- the TEAM screen: crew and friends
  openTeam() {
    const panel = this.$('panel');
    this.panel = 'team';
    if (this.locked) this.unlockSoft();
    const s = this.save, st = s.stash;
    const atBase = this.mode === 'hangar' || (this.atFob && !this.atFob.wrecked && this.mode === 'fly');
    const col = (c) => `rgb(${c.map((v) => Math.round(v * 255))})`;
    const dis = atBase ? '' : 'disabled';
    const cards = s.team.map((m, i) => `
      <div class="da-cm" style="--c:${col(ROLES[m.role].col)}">
        <small>${ROLES[m.role].n}${m.raid ? ' · IN A BUILDING' : ''}</small><b>${m.name}</b>
        <div class="da-hpb"><i style="width:${Math.round((m.hp / m.max) * 100)}%"></i></div>
        <p>${WEAPONS[m.wpn].n} · ${ARMORS[m.armor].n}<br>${m.medkit} MEDKIT · ${m.grenade} GRENADE${m.pack ? ' · BIG PACK' : ''}<br>${m.kills} KILLS · ${m.raids} RAIDS</p>
        ${m.raid ? '' : `<div class="da-btns">
          <button data-a="aboard" data-i="${i}" class="${m.aboard ? '' : 'alt'}" ${dis}>${m.aboard ? 'ON BOARD ✓' : 'AT THE SPIRE'}</button>
          <button class="alt" data-a="wpn" data-i="${i}" ${dis}>GUN ▸</button><button class="alt" data-a="arm" data-i="${i}" ${dis}>ARMOUR ▸</button>
          <button class="alt" data-a="medkit" data-i="${i}" ${dis}>+MEDKIT</button><button class="alt" data-a="grenade" data-i="${i}" ${dis}>+GRENADE</button>
          <button class="alt" data-a="pack" data-i="${i}" ${dis}>${m.pack ? 'PACK ✓' : '+PACK'}</button><button class="alt" data-a="bye" data-i="${i}" ${dis}>DISMISS</button></div>`}
      </div>`).join('');
    const cost = (s.base && s.base.clinic >= 2) ? 0 : recruitCost(s.team);
    const shop = [...Object.entries(WEAPONS).filter(([k]) => k !== 'pistol').map(([k, w]) => [k, w.n, w.cost, `POWER ${w.p}`]),
      ...Object.entries(ARMORS).filter(([k]) => k !== 'none').map(([k, a]) => [k, a.n, a.cost, `${Math.round((1 - a.k) * 100)}% LESS DAMAGE`]),
      ...Object.entries(ITEMS).map(([k, it]) => [k, it.n, it.cost, it.d])];
    const stashTxt = Object.entries(st).filter(([, n]) => n > 0).map(([k, n]) => `${(WEAPONS[k] || ARMORS[k] || ITEMS[k] || { n: k }).n} ×${n}`).join(' · ') || 'EMPTY';
    const friends = this.coop ? [...this.coop.friends.values()] : [];
    panel.innerHTML = `<button class="alt close" data-x="close" type="button">CLOSE ✕</button><h2>YOUR TEAM</h2>
      <p>They ride in the cabin (one seat each) and raid buildings for you: land on a building with a sign and press <b>R</b>.${atBase ? '' : ' <b style="color:#ffcf3a">Land at the Spire to change gear or recruit.</b>'}</p>
      <div class="da-crew">${cards || '<p>Nobody yet. Recruit someone below.</p>'}</div>
      <h3>RECRUIT · ${cost ? `⚙${cost}` : 'FREE'}${s.team.length >= 8 ? ' · TEAM FULL (8)' : ''}</h3>
      <div class="da-recruit"><input data-x="rname" maxlength="12" placeholder="NAME" value="${randName()}">
        ${ROLE_IDS.map((r) => `<button class="alt" data-role="${r}" style="border-left:4px solid ${col(ROLES[r].col)}" title="${ROLES[r].d}" ${dis || (s.team.length >= 8 || s.scrap < cost ? 'disabled' : '')}>${ROLES[r].n}</button>`).join('')}</div>
      <p class="da-roles">${ROLE_IDS.map((r) => `<b style="color:${col(ROLES[r].col)}">${ROLES[r].n}</b> ${ROLES[r].d}`).join('<br>')}</p>
      ${s.pool.length ? `<h3>SURVIVORS WHO WANT TO JOIN (FREE)</h3><div class="da-crew">${s.pool.map((m, i) => `<div class="da-cm" style="--c:${col((ROLES[m.role] || ROLES.rifleman).col)}"><small>${(ROLES[m.role] || ROLES.rifleman).n}</small><b>${m.name}</b><button data-pool="${i}" type="button" ${dis || (s.team.length >= 8 ? 'disabled' : '')}>RECRUIT</button></div>`).join('')}</div>` : ''}
      <h3>ARMOURY · ⚙ ${s.scrap.toLocaleString('en-GB')}</h3>
      <p>IN STORE: ${stashTxt}</p>
      <div class="da-shop">${shop.map(([k, n, c, d]) => `<button class="alt" data-buy="${k}" data-cost="${c}" ${dis || (s.scrap < c ? 'disabled' : '')}><b>${n}</b><small>${d}</small><span>⚙${c}</span></button>`).join('')}</div>
      <h3>FRIENDS ONLINE</h3>
      <p>${this.coop ? `Your server <b>${this.coop.info.name}</b> is open · code <b>${this.coop.code}</b> · ${this.coop.friends.size} friend${this.coop.friends.size === 1 ? '' : 's'} on.` : 'Make a server and friends can join you: in your doors, or flying their own helicopters.'}</p>
      <button data-x="online" type="button">🌐 ONLINE ▶</button>
      <p data-x="netmsg"></p>`;
    panel.classList.remove('hidden');
    const redo = () => { saveSave(s); this.snd.click?.(2000, 0.2); this.openTeam(); if (this.mode === 'hangar') this.renderHangar(); };
    panel.querySelector('[data-x=close]').onclick = () => this.closePanel();
    const cycle = (m, key, list, none) => {
      const opts = list.filter((k) => k === none || k === m[key] || (st[k] || 0) > 0);
      const next = opts[(opts.indexOf(m[key]) + 1) % opts.length];
      if (next === m[key]) return;
      if (m[key] !== none) st[m[key]] = (st[m[key]] || 0) + 1;
      if (next !== none) st[next]--;
      m[key] = next;
    };
    panel.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => {
      const m = s.team[+b.dataset.i], a = b.dataset.a;
      if (a === 'aboard') m.aboard = !m.aboard;
      else if (a === 'wpn') cycle(m, 'wpn', Object.keys(WEAPONS), 'pistol');
      else if (a === 'arm') cycle(m, 'armor', Object.keys(ARMORS), 'none');
      else if (a === 'medkit' || a === 'grenade') { if ((st[a] || 0) > 0) { st[a]--; m[a]++; } else { this.flashPanel('NONE IN STORE · BUY SOME BELOW'); return; } }
      else if (a === 'pack') { if (m.pack) { m.pack = false; st.pack = (st.pack || 0) + 1; } else if ((st.pack || 0) > 0) { st.pack--; m.pack = true; } else { this.flashPanel('NO BACKPACKS IN STORE'); return; } }
      else if (a === 'bye') {
        if (m.wpn !== 'pistol') st[m.wpn] = (st[m.wpn] || 0) + 1;
        if (m.armor !== 'none') st[m.armor] = (st[m.armor] || 0) + 1;
        st.medkit += m.medkit; st.grenade += m.grenade; if (m.pack) st.pack = (st.pack || 0) + 1;
        s.team.splice(+b.dataset.i, 1);
      }
      redo();
    }; });
    panel.querySelectorAll('[data-role]').forEach((b) => { b.onclick = () => {
      if (s.team.length >= 8 || s.scrap < cost) return;
      s.scrap -= cost;
      const nm = panel.querySelector('[data-x=rname]').value.trim().replace(/[^A-Za-z0-9 '-]/g, '') || randName();
      s.team.push(newMember(nm, b.dataset.role));
      this.snd.checkpoint?.(); redo();
    }; });
    panel.querySelectorAll('[data-pool]').forEach((b) => { b.onclick = () => {
      if (s.team.length >= 8) return;
      const v = s.pool.splice(+b.dataset.pool, 1)[0];
      s.team.push(newMember(v.name, ROLES[v.role] ? v.role : 'rifleman'));
      this.snd.checkpoint?.(); redo();
    }; });
    panel.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => {
      const c = +b.dataset.cost; if (s.scrap < c) return;
      s.scrap -= c; st[b.dataset.buy] = (st[b.dataset.buy] || 0) + 1; this.snd.coins?.(); redo();
    }; });
    panel.querySelector('[data-x=online]')?.addEventListener('click', () => this.openOnline());
  }
  // THE SPIRE: the story so far, the people living there, and what you can build
  openSpire() {
    const panel = this.$('panel');
    this.panel = 'spire';
    if (this.locked) this.unlockSoft();
    const s = this.save, st = s.story, pop = this.population(), beds = BEDS[s.base.bunks || 0];
    const ch = CHAPTERS[st.ch];
    const story = new Story(s, this.map);
    const chap = ch ? `<div class="da-chap"><b style="color:#ffd23a;font:900 14px var(--font);letter-spacing:.15em">CHAPTER ${st.ch + 1} OF ${CHAPTERS.length} · ${ch.n}</b><p>"${ch.brief}"</p>${ch.goals.map((g) => { const h = Math.min(g.n, story.have(g)); return `<em class="${h >= g.n ? 'ok' : ''}">${h >= g.n ? '✔' : '▸'} ${g.t}${g.n > 1 ? ` · ${h}/${g.n}` : ''}</em>`; }).join('')}<p style="color:#ffcf3a">REWARD ⚙${ch.reward.toLocaleString('en-GB')}</p></div>`
      : `<div class="da-chap"><b style="color:#7dff9a;font:900 14px var(--font);letter-spacing:.15em">THE STORY IS DONE · FREE FLIGHT</b><p>"The Spire's safe and the radio never stops. Keep flying."</p></div>`;
    const bars = CHAPTERS.map((_, i) => `<i class="${i < st.ch ? 'd' : i === st.ch ? 'c' : ''}"></i>`).join('');
    const atBase = this.mode === 'hangar' || (this.atFob && this.mode === 'fly');
    const ups = BASE.map((b) => {
      const cur = s.base[b.id] || 0, nx = b.tiers[cur + 1], top = !nx;
      const T = b.tiers[cur];
      if (top) return `<button class="own" type="button" disabled><b>${b.icon} ${b.name}: ${T.n}</b>${T.d}<small>✔ DONE</small></button>`;
      const lack = pop < nx.pop, poor = s.scrap < nx.cost;
      return `<button class="${lack ? 'lock' : ''}" type="button" data-b="${b.id}" ${lack || poor || !atBase ? 'disabled' : ''}><b>${b.icon} ${b.name} → ${nx.n}</b>${nx.d}<small>⚙${nx.cost.toLocaleString('en-GB')} · NEEDS ${nx.pop} PEOPLE${lack ? ` (YOU HAVE ${pop})` : ''}</small><small style="color:#9aa">NOW: ${T.n}</small></button>`;
    }).join('');
    panel.innerHTML = `<button class="alt close" data-x="close" type="button">CLOSE ✕</button><h2>THE SPIRE</h2>
      <h3>THE STORY</h3><div class="da-chaps">${bars}</div>${chap}
      <h3>PEOPLE · ${pop} LIVING HERE</h3>
      <p>Everyone you rescue moves in. People with a bed go out scavenging: <b>${this.workers()} of ${pop}</b> have one (${beds} beds), bringing in <b style="color:#7dff9a">⚙${this.income()} a minute</b> while you fly. More people also unlock bigger things to build.</p>
      <h3>BUILD · ⚙ ${s.scrap.toLocaleString('en-GB')}</h3>${atBase ? '' : '<p style="color:#ffcf3a">Land at the Spire to build.</p>'}
      <div class="da-base">${ups}</div>`;
    panel.classList.remove('hidden');
    panel.querySelector('[data-x=close]').onclick = () => this.closePanel();
    panel.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => {
      const sl = BASE.find((q) => q.id === b.dataset.b), cur = s.base[sl.id] || 0, nx = sl.tiers[cur + 1];
      if (!nx || s.scrap < nx.cost || pop < nx.pop) return;
      s.scrap -= nx.cost; s.base[sl.id] = cur + 1; saveSave(s);
      this.snd.coins?.(); setTimeout(() => this.snd.finish?.(), 200);
      if (this.mode === 'hangar') this.renderHangar();
      this.openSpire();
    }; });
  }
  flashPanel(t) { const m = this.$('panel').querySelector('[data-x=netmsg]'); if (m) m.textContent = t; }
  closePanel() { this.panel = null; this.$('panel').classList.add('hidden'); }

  // ---------------------------------------------------------------- online: the pilot's side (the server)
  // the ONLINE panel: make a server (with a name, public or private), see who's on it, or go and join someone else's
  openOnline() {
    const panel = this.$('panel');
    this.panel = 'online';
    if (this.locked) this.unlockSoft();
    let me = ''; try { me = (localStorage.getItem('deadair.name') || '').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 12); } catch { /* ignore */ }
    const C = this.coop;
    if (C) {
      const fr = [...C.friends.values()];
      panel.innerHTML = `<button class="alt close" data-x="close" type="button">CLOSE ✕</button><h2>YOUR SERVER</h2>
        <p><b style="font-size:20px">${C.info.name}</b> · ${C.info.pub ? 'PUBLIC: it\'s in everyone\'s server list' : 'PRIVATE: only people with the code can join'}</p>
        <p>The code to join:</p><div class="da-code">${C.code}</div>
        <h3>PLAYERS · ${fr.length + 1} OF 6</h3>
        <p>★ ${C.info.host || 'YOU'} · PILOT (THE HOST)</p>
        ${fr.map((f) => `<p>${f.pilot ? '🚁' : '🔫'} ${f.name} · ${f.pilot ? `FLYING A ${(HELIS[f.kind] || HELIS.warhorse).n}` : f.seat >= 0 ? `${f.seat === 0 ? 'RIGHT' : 'LEFT'} DOOR GUNNER` : 'JOINING…'} · ${f.kills} KILLS <button class="alt" data-kick="${f.id}" type="button" style="padding:2px 8px;font-size:12px">KICK</button></p>`).join('') || '<p>Nobody yet. Up to 2 friends can ride in your doors, and 3 can fly their own helicopters.</p>'}
        <div class="row"><button class="alt" data-x="pub" type="button">MAKE IT ${C.info.pub ? 'PRIVATE' : 'PUBLIC'}</button><button class="alt" data-x="stophost" type="button">CLOSE THE SERVER</button></div>`;
    } else {
      panel.innerHTML = `<button class="alt close" data-x="close" type="button">CLOSE ✕</button><h2>PLAY ONLINE</h2>
        <h3>MAKE A SERVER</h3>
        <p>You're the host: your world, your story. Friends join as door gunners or fly their own helicopters next to you.</p>
        <p>SERVER NAME<br><input data-x="sname" maxlength="22" value="${me ? `${me}'S SERVER` : 'DEAD AIR SERVER'}" style="font:800 20px var(--font);width:320px;padding:6px 8px"></p>
        <p>YOUR NAME<br><input data-x="hname" maxlength="12" value="${me}" placeholder="NICKNAME" style="font:800 20px var(--font);width:220px;padding:6px 8px"></p>
        <div class="da-seg" data-x="vis"><button type="button" data-v="1" class="on">PUBLIC</button><button type="button" data-v="0">PRIVATE (CODE ONLY)</button></div>
        <p style="font-size:12px;opacity:.7">Public servers show up in everyone's list. Use a nickname, not your real name.</p>
        <div class="row"><button data-x="make" type="button">MAKE SERVER ▶</button></div>
        <h3>JOIN A SERVER</h3><p>See the servers that are on now, or type a friend's code.</p>
        <div class="row"><button class="alt" data-x="join" type="button">FIND A SERVER ▶</button></div>`;
    }
    panel.insertAdjacentHTML('beforeend', '<p data-x="netmsg"></p>');
    panel.classList.remove('hidden');
    panel.querySelector('[data-x=close]').onclick = () => this.closePanel();
    let pub = true;
    panel.querySelectorAll('[data-x=vis] button').forEach((b) => { b.onclick = () => { pub = b.dataset.v === '1'; panel.querySelectorAll('[data-x=vis] button').forEach((q) => q.classList.toggle('on', q === b)); }; });
    panel.querySelector('[data-x=make]')?.addEventListener('click', () => {
      const clean = (v, n) => v.replace(/[^A-Za-z0-9 '!?-]/g, '').trim().slice(0, n).toUpperCase();
      const name = clean(panel.querySelector('[data-x=sname]').value, 22) || 'DEAD AIR SERVER', host = clean(panel.querySelector('[data-x=hname]').value, 12);
      try { if (host) localStorage.setItem('deadair.name', host); } catch { /* ignore */ }
      this.flashPanel('MAKING THE SERVER…');
      this.startHosting({ name, host, pub }).then(() => this.openOnline(), (e) => this.flashPanel(e.message));
    });
    panel.querySelector('[data-x=join]')?.addEventListener('click', () => { this.closePanel(); this.showJoin(true); });
    panel.querySelector('[data-x=stophost]')?.addEventListener('click', () => { this.stopCoop(); this.openOnline(); });
    panel.querySelector('[data-x=pub]')?.addEventListener('click', () => { const C2 = this.coop; if (!C2) return; C2.info.pub = !C2.info.pub; C2.tr.advertise?.(this.serverInfo()); this.openOnline(); });
    panel.querySelectorAll('[data-kick]').forEach((b) => { b.onclick = () => { const C2 = this.coop; const f = C2 && C2.friends.get(b.dataset.kick); if (!f) return; C2.tr.sendTo(f.id, { k: 'kicked' }); C2.tr.kick?.(f.id); C2.friends.delete(f.id); this.feed(`${f.name} WAS KICKED`, 'y'); this.advertise(); this.openOnline(); }; });
  }
  serverInfo() { const C = this.coop; return { name: C.info.name, host: C.info.host, pub: C.info.pub, n: C.friends.size + 1, max: 6, ch: (this.save.story.ch || 0) + 1, world: this.save.seed }; }
  advertise() { if (this.coop) this.coop.tr.advertise?.(this.serverInfo()); }
  async startHosting(opts = {}) {
    if (this.coop) return;
    const tr = makeTransport(), code = code5();
    await tr.listen(code);
    this.coop = { tr, code, friends: new Map(), hsT: 0, zsT: 0, evT: 0, fxT: 0, wgT: 0, info: { name: opts.name || 'DEAD AIR SERVER', host: opts.host || '', pub: opts.pub !== false } };
    this.advertise();
    this.nfx = []; this.nidMap = new Map();
    tr.onPeer = (id) => {
      if (this.coop.friends.size >= 5) { tr.sendTo(id, { k: 'full' }); tr.kick?.(id); return; }
      this.coop.friends.set(id, { id, seat: -1, pilot: false, aim: [-Math.PI / 2, -0.3], fire: false, kills: 0, name: 'FRIEND', col: FRIEND_COLS[0] });
    };
    tr.onData = (id, m) => {
      const f = this.coop?.friends.get(id); if (!f || !m) return;
      if (m.k === 'aim') { f.aim = [clamp(+m.a[0] || 0, -Math.PI, Math.PI), clamp(+m.a[1] || 0, -1.4, 0.6)]; f.fire = !!m.f; }
      else if (m.k === 'hi') this.friendHello(f, m);
      else if (m.k === 'wp' && f.pilot) this.wingPose(f, m);
      else if (m.k === 'hits' && f.pilot) this.wingHits(f, m);
      else if (m.k === 'kit' && f.pilot) {
        f.kind = HELIS[m.kind] ? m.kind : f.kind; f.eq = m.eq && typeof m.eq === 'object' ? m.eq : f.eq;
        f.paint = { ...(PAINT[m.paint] || PAINT.olive), ...(m.dc || {}), camo: (CAMO[m.dc && m.dc.camo] || {}).k || 0 };
        if (f.wh) Object.assign(f.wh, { kind: f.kind, eq: f.eq, paint: f.paint });
      }
      else if (m.k === 'board' && f.pilot) {
        const e = this.director.list.find((q) => q.id === m.id && q.kind === 'rescue' && q.roof.active && q.roof.count > 0);
        if (e) { e.roof.count--; tr.sendTo(id, { k: 'boarded', id: m.id }); if (e.roof.count <= 0) { e.roof.active = false; this.feed(`${f.name} CLEARED A ROOF`, 'g'); } }
      } else if (m.k === 'dust' && f.pilot) {
        // a friend in a plane called a dustoff
        const e = this.director.list.find((q) => q.id === m.id);
        if (e && !(this.dustoffs || []).some((d) => d.ev === e) && (((e.kind === 'rescue' || e.kind === 'crash') && e.roof && e.roof.active && e.roof.count > 0) || (e.kind === 'crate' && e.landed && !e.carried && !e.dust && !e.done))) this.callDustoff(e, f.name);
        else tr.sendTo(id, { k: 'cr' });
      } else if (m.k === 'vh' && f.pilot) {
        const e = this.director.list.find((q) => q.kind === 'vats'), v = e && e.vats[m.i | 0];
        if (v) e.hit(v, clamp(+m.d || 0, 0, 3000), this);
      } else if (m.k === 'mast' && f.pilot) {
        const e = this.director.list.find((q) => q.id === m.id && q.kind === 'mast' && !q.working);
        if (e) { e.start(this); this.feed(`${f.name}'S ENGINEER IS ON THE WAY DOWN`, 'g'); }
      } else if (m.k === 'drop' && f.pilot) {
        const n = clamp(Math.round(+m.n || 0), 0, 40); if (!n) return;
        if (this.run) this.run.rescued += n; this.save.rescued += n; this.addScrap(25 * n); this.storyHit('rescued', n);
        this.feed(`${f.name} BROUGHT ${n} SURVIVOR${n > 1 ? 'S' : ''} HOME`, 'g');
        tr.sendTo(id, { k: 'cr', s: 25 * n });
      }
    };
    tr.onLeave = (id) => { const f = this.coop?.friends.get(id); if (!f) return; this.coop.friends.delete(id); this.feed(`${f.name} LEFT`, 'y'); this.advertise(); if (this.panel === 'team' || this.panel === 'online') this.reopen(); };
  }
  reopen() { if (this.panel === 'team') this.openTeam(); else if (this.panel === 'online') this.openOnline(); }
  // a friend said hello: which job do they want (and is there room)?
  friendHello(f, m) {
    const C = this.coop, tr = C.tr, all = [...C.friends.values()];
    f.name = String(m.name || 'FRIEND').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 12).toUpperCase() || 'FRIEND';
    const usedSeats = new Set(all.filter((q) => q !== f && q.seat >= 0).map((q) => q.seat));
    const usedWings = new Set(all.filter((q) => q !== f && q.pilot).map((q) => q.slot));
    const seat = !usedSeats.has(0) ? 0 : !usedSeats.has(1) ? 1 : -1, slot = [0, 1, 2].find((k) => !usedWings.has(k)) ?? -1;
    let role = m.role === 'wing' ? (slot >= 0 ? 'wing' : seat >= 0 ? 'gun' : null) : (seat >= 0 ? 'gun' : slot >= 0 ? 'wing' : null);
    if (!role) { tr.sendTo(f.id, { k: 'full' }); tr.kick?.(f.id); C.friends.delete(f.id); return; }
    const base = { k: 'init', seed: this.save.seed, eq: this.save.eq, paint: this.save.paint, dc: (({ camo, nose, tailArt, num }) => ({ camo, nose, tailArt, num }))(paintFor(this.save)), hk: this.save.heli, fort: !!this.save.story.fort, masts: this.save.story.masts };
    if (role === 'gun') {
      f.seat = seat; f.col = FRIEND_COLS[seat]; f.aim = [seat === 0 ? -Math.PI / 2 : Math.PI / 2, -0.3];
      tr.sendTo(f.id, { ...base, seat, role: 'gun' });
      this.feed(`${f.name} JOINED · ${seat === 0 ? 'RIGHT' : 'LEFT'} DOOR`, 'g');
    } else {
      f.pilot = true; f.slot = slot; f.kind = HELIS[m.kind] ? m.kind : 'warhorse';
      f.eq = m.eq && typeof m.eq === 'object' ? m.eq : {};
      f.paint = { ...(PAINT[m.paint] || PAINT.olive), ...(m.dc || {}), camo: (CAMO[m.dc && m.dc.camo] || {}).k || 0 };
      f.clawT = 0; f.trT = 0;
      tr.sendTo(f.id, { ...base, role: 'wing', pad: slot });
      this.feed(`${f.name} JOINED · FLYING A ${(HELIS[f.kind]).n}`, 'g');
    }
    this.snd.checkpoint?.();
    this.advertise();
    if (this.panel) this.reopen();
  }
  wingPose(f, m) {
    if (!Array.isArray(m.p) || !Array.isArray(m.q) || m.p.length !== 3 || m.q.length !== 4) return;
    const num = (a) => a.map((v) => (Number.isFinite(+v) ? +v : 0));
    const now = performance.now(), t = Number.isFinite(+m.t) ? +m.t : now;
    f.tgt = { t, p: num(m.p), q: num(m.q), v: Array.isArray(m.v) ? num(m.v) : [0, 0, 0], r: +m.r || 0, f: !!m.f, d: Array.isArray(m.d) ? norm(num(m.d)) : [0, 0, -1], dead: !!m.dead, rd: +m.rd || 0, at: now };
    // keep the last second or so of where they were, stamped with THEIR clock, to play back smoothly
    const off = now - t; f.off = f.off == null ? off : Math.min(f.off, off);
    f.buf = f.buf || [];
    if (!f.buf.length || t > f.buf[f.buf.length - 1].t) f.buf.push(f.tgt);
    if (f.buf.length > 24) f.buf.shift();
  }
  // where something was at time t, from a buffer of stamped snapshots: in between two of them, or a little past the last
  static sample(buf, t) {
    if (!buf || !buf.length) return null;
    let i = buf.length - 1;
    while (i > 0 && buf[i].t > t) i--;
    const a = buf[i], b = buf[Math.min(i + 1, buf.length - 1)];
    const k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0, over = Math.max(0, Math.min(0.25, (t - Math.max(a.t, b.t)) / 1000));
    const p = a.p.map((v, j) => v + (b.p[j] - v) * k + (b.v ? b.v[j] * over : 0));
    let qb = b.q; if (a.q[0] * qb[0] + a.q[1] * qb[1] + a.q[2] * qb[2] + a.q[3] * qb[3] < 0) qb = qb.map((v) => -v);
    return { p, q: norm4(a.q.map((v, j) => v + (qb[j] - v) * k)), last: b };
  }
  // a wingman's bullets, rockets and bombs: their game says what it hit, this game does the damage (and pays them)
  wingHits(f, m) {
    const CAUSE = ['gun', 'pod', 'door', 'rocket', 'bomb', 'fire', 'grenade', 'drone', 'ap', 'shell', 'zap'];
    let kills = 0, scrap = 0;
    const pay = (z) => { kills++; scrap += TYPES[z.type] ? TYPES[z.type].scrap : 2; };
    for (const h of (Array.isArray(m.z) ? m.z : []).slice(0, 400)) {
      const z = this.nidMap && this.nidMap.get(h[0]);
      if (!z || !z.alive) continue;
      if (this.horde.damage(z, clamp(+h[1] || 0, 0, 3000), [0, 1.5, 0], CAUSE[h[2]] || 'gun')) pay(z);
    }
    for (const b of (Array.isArray(m.b) ? m.b : []).slice(0, 40)) {
      const p = [+b[0] || 0, +b[1] || 0, +b[2] || 0], r = clamp(+b[3] || 0, 0, 30), dmg = clamp(+b[4] || 0, 0, 3000);
      const before = this.horde.list.filter((z) => z.alive && Math.abs(z.x - p[0]) < r + 1 && Math.abs(z.z - p[2]) < r + 1);
      this.blastAll(p, r, dmg, clamp(+b[5] || 8, 0, 30), CAUSE[b[6]] || 'rocket');
      for (const z of before) if (!z.alive) pay(z);
      if (b[7]) { this.blasts.push({ pos: p, t: 0, size: clamp(+b[7], 0.3, 3) }); this.fx.sparks(p, 10, [1, 0.6, 0.15], 9, 0.5, 0.1, 2); }
    }
    if (kills) { f.kills += kills; this.coop.tr.sendTo(f.id, { k: 'cr', n: kills, s: scrap }); }
  }
  // every frame: move the wingmen's helicopters smoothly to where they said they are, show their guns firing, and
  // let the zombies claw at anyone hovering too low
  wingTick(dt) {
    const C = this.coop; if (!C) return;
    for (const f of C.friends.values()) {
      if (!f.pilot || !f.tgt) continue;
      const T = f.tgt, w = f.wh || (f.wh = { pos: [...T.p], q: [...T.q], H: mat4(), rotorA: 0, tailA: 0, kind: f.kind, eq: f.eq, paint: f.paint });
      // play them back 160 ms in the past, smoothly between the updates either side (messages arrive in clumps)
      f.off += dt * 4;
      const S2 = HeliGame.sample(f.buf, performance.now() - f.off - 160), want = S2 ? S2.p : T.p;
      if (Math.hypot(want[0] - w.pos[0], want[1] - w.pos[1], want[2] - w.pos[2]) > 40) w.pos = [...want];
      const k = damp(30, dt);
      for (let i = 0; i < 3; i++) w.pos[i] += (want[i] - w.pos[i]) * k;
      let q = S2 ? S2.q : T.q; if (q[0] * w.q[0] + q[1] * w.q[1] + q[2] * w.q[2] + q[3] * w.q[3] < 0) q = q.map((v) => -v);
      w.q = norm4(w.q.map((v, i) => v + (q[i] - v) * k));
      qmat(w.H, w.q, w.pos);
      w.rpm = T.r; w.rotorA += w.rpm * 26 * dt; w.tailA += w.rpm * 70 * dt; w.fire = T.f && !T.dead; w.dead = T.dead; w.rd = T.rd; w.vs = Math.hypot(T.v[0], T.v[2]); w.v = T.v;
      if (w.fire) {
        f.trT -= dt;
        if (f.trT <= 0) { f.trT = 0.08; const o = qrot(w.q, [0, -1.05, -5]).map((c, i) => c + w.pos[i]); this.tracer(o, T.d, 150, 10 + f.slot); }
      }
      f.clawT -= dt;
      if (f.clawT <= 0 && !T.dead) {
        f.clawT = 0.5;
        let n = 0;
        for (const z of this.horde.list) if (z.alive && Math.abs(z.x - w.pos[0]) < 3.2 && Math.abs(z.z - w.pos[2]) < 3.2 && Math.abs(z.y + z.s * 1.6 - (w.pos[1] - 1.9)) < 2.2) n++;
        if (n) C.tr.sendTo(f.id, { k: 'hurt', d: n * 4 });
      }
    }
  }
  // name tags for everyone else online: where your friends' helicopters are (and the host's, if you joined)
  friendMarks() {
    const out = [], col = '#5ad8ff';
    const tag = (pos, name, sub) => out.push({ p: [pos[0], pos[1] + 5, pos[2]], col, icon: '🚁', text: name, sub, friend: true });
    if (this.coop) for (const f of this.coop.friends.values()) { if (f.pilot && f.wh && !f.wh.dead) tag(f.wh.pos, f.name, `${f.kills} KILLS`); }
    const cl = this.client;
    if (cl && cl.wing) {
      if (cl.heli && cl.hs && cl.hs.m === 'f') tag(cl.heli.pos, cl.hx && cl.hx.hn ? cl.hx.hn : 'HOST', 'THE HOST');
      for (const o of cl.wings) if (o.id !== cl.myId && o.h && o.h.pos && !o.h.dead) { const i = cl.wx && cl.wx.get(o.id); tag(o.h.pos, i ? i.name : 'FRIEND', ''); }
    } else if (cl) for (const o of cl.wings) if (o.h && o.h.pos && !o.h.dead) { const i = cl.wx && cl.wx.get(o.id); tag(o.h.pos, i ? i.name : 'FRIEND', ''); }
    return out;
  }
  pilotDist(x, z) {
    let d = Math.hypot(x - this.heli.pos[0], z - this.heli.pos[2]);
    if (this.coop) for (const f of this.coop.friends.values()) if (f.pilot && f.wh && !f.wh.dead) d = Math.min(d, Math.hypot(x - f.wh.pos[0], z - f.wh.pos[2]));
    return d;
  }
  // things you can shoot that aren't zombies (the growth vats): the host's own, or, for friends, stand-ins that tell the host
  shootList() {
    if (!this.client) return this.director.shootables(this);
    const out = [];
    for (const e of this.client.evs || []) if (e.k === 'vats' && Array.isArray(e.v)) for (let i = 0; i < e.v.length; i++) {
      const v = e.v[i]; if (!(v[3] > 0)) continue;
      out.push({ pos: [v[0], v[1], v[2]], r: 4.5, hit: (d) => { this.vatHits = (this.vatHits || 0) + d; this.vatI = i; } });
    }
    return out;
  }
  // smashed growth vats stay smashed: hide them (from the save, or for friends from what the host says)
  syncVats(evs) {
    const L = this.map.lab; if (!L) return;
    const gone = new Set((this.save.story && this.save.story.vats) || []);
    if (evs) for (const e of evs) if (e.k === 'vats' && Array.isArray(e.v)) e.v.forEach((v, i) => { if (!(v[3] > 0)) gone.add(i); });
    L.vats.forEach((v, i) => { for (const b of v.parts) b.hidden = gone.has(i); });
  }
  // a deep roar: low growl swept down, plus a rush of noise
  roar(vol = 0.5, dist = 0) {
    const c = this.snd.ctx; if (!c || this.save.sfx === false) return;
    const k = vol * (dist ? Math.max(0.15, 1 - dist / 900) : 1), t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(32, t + 2);
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.setValueAtTime(103, t); o2.frequency.exponentialRampToValueAtTime(45, t + 1.8);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(180, t + 2);
    const n = c.createBufferSource(); n.buffer = this.snd.noise; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(150, t + 2); bp.Q.value = 1.5;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55 * k, t + 0.25); g.gain.setTargetAtTime(0, t + 1.4, 0.35);
    o.connect(lp); o2.connect(lp); n.connect(bp).connect(g); lp.connect(g); g.connect(this.snd.master);
    o.start(t); o2.start(t); n.start(t, Math.random()); o.stop(t + 3); o2.stop(t + 3); n.stop(t + 3);
  }
  // the giants: their footsteps shake the ground (and you), leave prints and kick up dust; you hear them coming
  bossFeel(dt) {
    const cl = this.client, me = cl ? (cl.heli || this.heli) : this.heli;
    if (!me) return;
    const list = cl ? [...(cl.zs ? cl.zs.values() : [])].filter((z) => z.boss) : this.horde.list.filter((z) => z.boss && z.alive);
    if (cl) for (const e of cl.evs || []) if (e.k === 'boss' && e.w) { const z = list.sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z))[0]; if (z && !(z.atk > 0)) z.atk = 1; }
    this.prints = this.prints || [];
    for (const z of list) {
      if (cl && z.atk > 0) z.atk = Math.max(0, z.atk - dt / 0.8);
      if (z.lx != null) { const d = Math.hypot(z.x - z.lx, z.z - z.lz); if (d < 20) z.walkD = (z.walkD || 0) + d; }
      z.lx = z.x; z.lz = z.z;
      const stride = z.s * (z.type === 'mother' ? 0.35 : 0.55);
      z.bph = (z.walkD || 0) / stride;
      const step = Math.floor(z.bph / Math.PI);
      const dist = Math.hypot(z.x - me.pos[0], z.y - me.pos[1], z.z - me.pos[2]);
      if (z.lastStep != null && step !== z.lastStep) {
        const sd = step % 2 ? 1 : -1, c = Math.cos(z.yaw), sn = Math.sin(z.yaw), fx = z.x + sd * 0.45 * z.s * c, fz = z.z - sd * 0.45 * z.s * sn;
        if (dist < 650) {
          this.shake = Math.max(this.shake || 0, 0.55 * (1 - dist / 650) * (z.type === 'goliath' ? 1 : 0.6));
          this.snd.boom?.(0.35 * (1 - dist / 700));
          for (let k = 0; k < 2; k++) this.smokes.push({ pos: [fx + (Math.random() - 0.5) * z.s, z.y + 1, fz + (Math.random() - 0.5) * z.s], t: 0, life: 2.5 + Math.random() * 1.5, size: z.s * 0.35, drift: [(Math.random() - 0.5), (Math.random() - 0.5)] });
        }
        if (z.type !== 'mother') { this.prints.push([fx, this.groundAt(fx, fz) + 0.05, fz, z.yaw, z.s]); if (this.prints.length > 70) this.prints.shift(); }
      }
      z.lastStep = step;
      // first time you see one: its name in big letters, and a roar
      const key = z.nid || z.id;
      this.bossSeen = this.bossSeen || new Set();
      if (dist < 750 && !this.bossSeen.has(key)) {
        this.bossSeen.add(key);
        const B = BOSSES[z.type];
        if (B) { this.banner(`☠ ${B.n} ☠`, B.sub, 'bad', 4.5); this.roar(0.8, dist); this.shake = Math.max(this.shake || 0, 0.6); }
      }
    }
    // friends: send the damage they did to the vats to the host
    if (cl && this.vatHits > 0 && (this.vatT = (this.vatT || 0) + dt) > 0.25) { cl.tr.send({ k: 'vh', i: this.vatI, d: Math.round(this.vatHits) }); this.vatHits = 0; this.vatT = 0; }
  }
  // flying over the places in the story for the first time: the radio tells you what you're looking at
  siteTick(dt) {
    if ((this.siteT = (this.siteT || 0) - dt) > 0) return;
    this.siteT = 0.5;
    const P = (this.client ? this.client.heli : this.heli)?.pos, M = this.map, seen = this.save.sites = this.save.sites || {};
    if (!P) return;
    const sites = [];
    if (M.lab) sites.push(['lab', M.lab, "That's Halden Biolab. Army research. Look at the hall: something tore its way out through the wall. Something big. And those footprints... pilot, they're the size of cars."]);
    const L = M.lairs || {};
    if (L.goliath) sites.push(['goliath', L.goliath, "Red Rock Quarry. The cars down there have been crushed flat and stacked like firewood. Something's been carrying them here. That's a den, pilot."]);
    if (L.spitter) sites.push(['spitter', L.spitter, "Kessler Chemicals. That green stuff has eaten right through the concrete... and there are tracks going in and out of it. Whatever lives here drinks it."]);
    if (L.mother) sites.push(['mother', L.mother, "Those are... eggs. Hundreds of them, inside a wall of cars. Pilot, get some height. I don't want to meet whatever laid them."]);
    for (const [k, site, text] of sites) {
      if (seen[k] || Math.hypot(site.x - P[0], site.z - P[2]) > 380) continue;
      seen[k] = 1; saveSave(this.save);
      this.radio(text, 10);
      this.feed(`FOUND: ${site.name}`, 'g');
      if (k !== 'lab') this.storyHit('lair', 1);
    }
  }
  // everyone flying who a boss can throw things at: you, and friends flying their own aircraft
  pilots() {
    const out = [];
    if (this.heli && !this.heli.dead && (this.mode === 'fly' || this.mode === 'pause')) out.push({ pos: this.heli.pos, vel: this.heli.vel, hurt: (d, at) => this.hurt(d, at) });
    if (this.coop) for (const f of this.coop.friends.values()) if (f.pilot && f.wh && !f.wh.dead) out.push({ pos: f.wh.pos, vel: f.wh.v || [0, 0, 0], hurt: (d) => this.coop.tr.sendTo(f.id, { k: 'hurt', d: Math.round(d) }) });
    return out;
  }
  wingSpots() { return this.coop ? [...this.coop.friends.values()].filter((f) => f.pilot && f.wh && !f.wh.dead).map((f) => [f.wh.pos[0], f.wh.pos[2], f.wh.pos[1]]) : []; }
  stopCoop() {
    if (this.coop) { try { this.coop.tr.close(); } catch { /* ignore */ } }
    this.coop = null; this.nfx = null; this.nidMap = null;
    if (this.client) { try { this.client.tr.close(); } catch { /* ignore */ } this.unwireHorde(); this.client = null; }
  }
  coopHostTick(dt) {
    const C = this.coop;
    if (!C || !C.friends.size) { if (this.nfx) this.nfx.length = 0; return; }
    if (this.mode !== 'hangar') this.wingTick(dt);
    const send = (m) => { for (const id of C.friends.keys()) C.tr.sendTo(id, m); };
    C.hsT -= dt; C.zsT -= dt; C.evT -= dt; C.fxT -= dt;
    const H = this.mode === 'hangar' ? this.hangarHeli : this.heli, S = this.S || statsFor(this.save.eq, this.save.heli);
    if (C.hsT <= 0) {
      C.hsT = 1 / 15;
      const wg = [...C.friends.values()].filter((f) => f.pilot && f.wh).map((f) => [f.id, ...f.wh.pos.map(q1), ...f.wh.q.map((v) => Math.round(v * 1000) / 1000), q2(f.wh.rpm || 0), f.wh.fire ? 1 : 0, f.wh.dead ? 1 : 0, f.wh.rd || 0]);
      send({ k: 'hs', w: wg.length ? wg : undefined, t: Math.round(performance.now()), p: H.pos.map(q2), q: H.q.map((v) => Math.round(v * 1000) / 1000), v: H.vel.map(q1), rpm: q2(H.rpm), b: q2(H.boost || 0),
        hp: Math.round(this.hp || 0), fu: Math.round(this.fuel || 0), rd: this.riders || 0,
        da: (this.doorAim || []).map((a) => a.map(q2)), df: (this.doorFlash || [0, 0]).map((v) => (v > 0 ? 1 : 0)),
        fl: this.flashT > 0 ? 1 : 0, sp: q1(this.spin || 0), m: this.mode === 'hangar' ? 'h' : this.mode === 'down' ? 'd' : 'f' });
    }
    // the things that hardly change, once a second
    C.hxT = (C.hxT ?? 0) - dt;
    if (C.hxT <= 0) {
      C.hxT = 1;
      send({ k: 'hx', hpm: S.hp, fum: S.fuel, cr: this.save.team.filter((m) => m.aboard && !m.raid && m.hp > 0).slice(0, 4).map((c) => ROLE_IDS.indexOf(c.role)), sc: this.save.scrap, kl: this.run?.kills || 0,
        fr: [...C.friends.values()].filter((f) => f.seat >= 0).map((f) => [f.seat, f.kills]), eq: this.save.eq, pt: this.save.paint, hk: this.save.heli, rk: this.rockets, bm: this.bombs, td: this.tod,
        hn: this.coop.info.host || 'HOST', fort: !!this.save.story.fort, masts: this.save.story.masts, st: this.story ? this.story.lines() : null, sw: this.map.spire.wrecked ? 1 : 0,
        wx: [...C.friends.values()].filter((f) => f.pilot).map((f) => [f.id, f.name, f.kind, f.eq, f.paint, f.kills]) });
    }
    if (C.zsT <= 0 && this.mode !== 'hangar') {
      C.zsT = 1 / 10;
      // each friend gets the zombies round them: the door gunners round this helicopter, wingmen round their own
      const groups = new Map();
      for (const f of C.friends.values()) {
        const c = f.pilot && f.wh ? f.wh.pos : H.pos, key = f.pilot && f.wh ? f.id : 'host';
        if (!groups.has(key)) groups.set(key, { c, ids: [] });
        groups.get(key).ids.push(f.id);
      }
      const far = (C.zfT = (C.zfT || 0) - 1) <= 0;
      if (far) C.zfT = 7;
      for (const { c: P, ids } of groups.values()) {
        const dd = (z) => Math.abs(z.x - P[0]) + Math.abs(z.z - P[2]);
        const all = this.horde.list.filter((z) => z.alive);
        all.sort((a, b) => dd(a) - dd(b));
        const near = all.slice(0, 220).filter((z) => dd(z) < 300);
        const out = [];
        if (far) {
          // everything else (hordes included), nearest first, as simple figures: x, y, z, shirt
          const fz = [];
          for (let i = near.length; i < all.length && fz.length < 4000 * 4; i++) { const z = all[i]; fz.push(Math.round(z.x), Math.round(z.y), Math.round(z.z), (z.id || 0) % 9); }
          for (const id of ids) C.tr.sendTo(id, { k: 'zf', f: fz, v: 2 });
        }
        for (const z of near) {
          if (!z.nid) { z.nid = (this.nidN = (this.nidN || 0) + 1); this.nidMap.set(z.nid, z); }
          out.push(z.nid, Math.round(z.x * 10), Math.round(z.y * 10), Math.round(z.z * 10), Math.round(z.yaw * 100), ZT.indexOf(z.type), ZS.indexOf(z.st), z.hitT > 0 ? 1 : 0);
        }
        for (const z of all) if (z.boss && !near.includes(z) && dd(z) < 1800) {
          if (!z.nid) { z.nid = (this.nidN = (this.nidN || 0) + 1); this.nidMap.set(z.nid, z); }
          out.push(z.nid, Math.round(z.x * 10), Math.round(z.y * 10), Math.round(z.z * 10), Math.round(z.yaw * 100), ZT.indexOf(z.type), ZS.indexOf(z.st), z.hitT > 0 ? 1 : 0);
        }
        const msg = { k: 'zs', t: Math.round(performance.now()), z: out };
        for (const id of ids) C.tr.sendTo(id, msg);
      }
      // forget the numbers of zombies that are gone
      if ((C.gcT = (C.gcT || 0) + 1) % 50 === 0) for (const [n, z] of this.nidMap) if (!z.alive) this.nidMap.delete(n);
    }
    if (C.evT <= 0 && this.mode !== 'hangar') {
      C.evT = 1 / 4;
      send({ k: 'ev', do: (this.dustoffs || []).map((d) => [...d.pos.map(q1), Math.round(d.yaw * 100), d.riders, ['in', 'load', 'out'].indexOf(d.phase), d.ev.kind === 'crate' ? 1 : 0, d.ev.id]), e: this.director.list.map((e) => ({ ...e.net(), id: e.id, mk: e.marker(this) })), sh: this.shots.filter((s) => s.kind === 'rocket' || s.kind === 'bomb' || s.kind === 'plasma').map((s) => [s.kind[0], ...s.pos.map(q1), ...s.vel.map(q1)]) });
    }
    if (this.nfx && this.nfx.length && C.fxT <= 0) { C.fxT = 1 / 10; send({ k: 'fx', f: this.nfx.splice(0, 80) }); this.nfx.length = 0; }
  }
  titanEv() { const P = this.heli.pos; return this.director.list.filter((e) => e.kind === 'boss' && e.z0 && e.z0.alive).sort((a, b) => Math.hypot(a.x - P[0], a.z - P[2]) - Math.hypot(b.x - P[0], b.z - P[2]))[0]; }
  // the nearest boss (if one's close): its name and health
  bossNear(P) {
    const L = this.client ? (this.client.evs || []).filter((e) => e.k === 'boss').map((e) => ({ x: e.x, z: e.z, n: BOSSES[e.b] ? BOSSES[e.b].n : 'BOSS', h: e.h, m: e.m }))
      : this.director.list.filter((e) => e.kind === 'boss' && e.z0 && e.z0.alive).map((e) => ({ x: e.x, z: e.z, n: BOSSES[e.bk].n, h: e.z0.hp, m: e.z0.max }));
    return L.filter((b) => Math.hypot(b.x - P[0], b.z - P[2]) < 900).sort((a, b) => Math.hypot(a.x - P[0], a.z - P[2]) - Math.hypot(b.x - P[0], b.z - P[2]))[0] || null;
  }
  // the boss health bar at the top of the screen
  bossBar(b) {
    const el = this.$('boss');
    el.classList.toggle('hidden', !b);
    if (!b) return;
    if (el.dataset.n !== b.n) { el.dataset.n = b.n; el.firstChild.textContent = b.n; }
    el.style.setProperty('--p', clamp(b.h / b.m, 0, 1).toFixed(3));
  }

  // ---------------------------------------------------------------- online: a friend's side
  // the JOIN screen: the public servers that are on right now, or a code; and whether to ride in a door or fly
  showJoin(fromHangar) {
    this.load();
    const j = this.$('join');
    this.active = true; this.mode = 'joining'; this.joinBack = !!fromHangar;
    this.root.classList.remove('hidden');
    for (const k of ['hangar', 'hud', 'pause', 'end']) this.$(k).classList.add('hidden');
    let name = ''; try { name = localStorage.getItem('deadair.name') || ''; } catch { /* ignore */ }
    let role = 'wing';
    j.innerHTML = `<div class="da-card" style="width:min(620px,94vw)"><h2>JOIN A SERVER</h2>
      <p>HOW DO YOU WANT TO PLAY?</p>
      <div class="da-seg" data-x="role"><button type="button" data-r="wing" class="on">🚁 FLY MY OWN HELICOPTER</button><button type="button" data-r="gun">🔫 RIDE IN THE DOOR</button></div>
      <p><input data-x="name" maxlength="12" placeholder="YOUR NICKNAME" value="${name.replace(/[^\w ]/g, '')}" style="font-size:20px;letter-spacing:.1em;width:260px"></p>
      <h3 style="margin:10px 0 4px;font:900 14px var(--font);letter-spacing:.2em;color:#7dff9a">SERVERS ON NOW <small data-x="relays" style="color:#9aa;letter-spacing:.05em;font-weight:700"></small></h3>
      <div class="da-srv" data-x="list"><p style="opacity:.7">LOOKING FOR SERVERS…</p></div>
      <p>OR TYPE A CODE: <input data-x="code" maxlength="5" placeholder="CODE" autocomplete="off" style="width:130px"></p>
      <p data-x="msg"></p><div class="row"><button data-x="go" type="button">JOIN WITH CODE</button><button class="alt" data-x="back" type="button">BACK</button></div></div>`;
    j.classList.remove('hidden');
    const code = j.querySelector('[data-x=code]'), msg = j.querySelector('[data-x=msg]'), list = j.querySelector('[data-x=list]');
    j.querySelectorAll('[data-x=role] button').forEach((b) => { b.onclick = () => { role = b.dataset.r; j.querySelectorAll('[data-x=role] button').forEach((q) => q.classList.toggle('on', q === b)); }; });
    const go = async (c) => {
      const nm = j.querySelector('[data-x=name]').value.replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 12) || 'FRIEND';
      try { localStorage.setItem('deadair.name', nm); } catch { /* ignore */ }
      if (!c || c.length !== 5) { msg.textContent = 'THE CODE IS 5 LETTERS.'; return; }
      msg.textContent = 'CONNECTING…';
      this.stopList?.(); this.stopList = null;
      try { await this.joinCoop(c, nm, role, (t) => { msg.textContent = t; }); } catch (e) { msg.textContent = e.message || 'COULDN\'T JOIN.'; }
    };
    this.stopList?.();
    this.stopList = listServers((rows) => {
      if (!list.isConnected) return;
      if (rows === null) { list.innerHTML = '<p>COULDN\'T REACH THE SERVER LIST. YOU CAN STILL USE A CODE.</p>'; return; }
      if (!rows.length) { list.innerHTML = '<p style="opacity:.7">NO PUBLIC SERVERS YET (THEY CAN TAKE 5 SECONDS TO SHOW UP). YOUR FRIEND MAKES ONE IN THE HANGAR → 🌐 ONLINE, SET TO PUBLIC. OR TYPE THEIR CODE BELOW.</p>'; return; }
      list.innerHTML = rows.map((r) => `<button type="button" data-c="${r.code}" ${r.n >= r.max ? 'disabled' : ''}><span>${r.name}<br><small>${r.host ? `HOST ${r.host} · ` : ''}CHAPTER ${r.ch}</small></span><span>${r.n}/${r.max} ${r.n >= r.max ? 'FULL' : 'JOIN ▶'}</span></button>`).join('');
      list.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => go(b.dataset.c); });
    }, (ok, all) => { const r = j.querySelector('[data-x=relays]'); if (r) r.textContent = `· ${ok} OF ${all} RELAYS CONNECTED`; });
    j.querySelector('[data-x=go]').onclick = () => go(code.value.trim().toUpperCase());
    code.onkeydown = (e) => { if (e.key === 'Enter') go(code.value.trim().toUpperCase()); };
    j.querySelector('[data-x=back]').onclick = () => { this.stopList?.(); this.stopList = null; j.classList.add('hidden'); if (this.joinBack) this.toHangar(); else this.close(); };
  }
  async joinCoop(code, name, role, onStatus) {
    const tr = makeTransport();
    const cl = this.client = { tr, seat: 0, heli: null, zs: new Map(), evs: [], shots: [], aim: [0, -0.3], sendT: 0, fire: false, kills: 0, hs: null, role, wings: [], hz: new Map(), hbl: [] };
    tr.onData = (m) => this.clientData(m);
    tr.onLeave = () => { if (this.client !== cl) return; this.stopCoop(); this.close(); setTimeout(() => alert('The server closed (the host left).'), 50); };
    const myId = await tr.connect(code, onStatus);
    cl.myId = myId || tr.id;
    const s = this.save;
    tr.send({ k: 'hi', name, role, kind: s.heli, eq: capEq(s.eq, s.heli), paint: s.paint, dc: (({ camo, nose, tailArt, num }) => ({ camo, nose, tailArt, num }))(s) });
    onStatus?.('WAITING FOR THE HOST…');
  }
  clientData(m) {
    const cl = this.client; if (!cl || !m) return;
    if (m.k === 'full') { const e = this.$('join').querySelector('[data-x=msg]'); if (e) e.textContent = 'THAT SERVER IS FULL.'; return; }
    if (m.k === 'kicked') { this.stopCoop(); this.close(); setTimeout(() => alert('The host removed you from the server.'), 50); return; }
    if (m.k === 'init') {
      this.stopList?.(); this.stopList = null;
      if (m.seed) this.load(m.seed);
      if (this.map.fort) this.map.fort.locked = !m.fort;
      for (const mm of this.map.masts || []) mm.on = (m.masts || []).includes(mm.n);
      cl.eq = m.eq; cl.paint = m.paint; cl.dc = m.dc; cl.hk = m.hk || 'warhorse';
      cl.heli = new Chopper(); cl.heli.reset([0, 50, 0], 0, statsFor(m.eq, cl.hk));
      this.horde.clear(); this.fx.clear(); this.blasts = []; this.tracers = []; this.runners = [];
      this.$('join').classList.add('hidden'); this.$('hud').classList.remove('hidden');
      if (m.role === 'wing') { this.wingStart(m.pad || 0); return; }
      cl.seat = m.seat;
      cl.aim = [m.seat === 0 ? -Math.PI / 2 : Math.PI / 2, -0.3];
      this.root.classList.add('da-gunner');
      this.$('help').innerHTML = `YOU'RE IN THE <b>${m.seat === 0 ? 'RIGHT' : 'LEFT'} DOOR</b> · <kbd>MOUSE</kbd> AIM · <kbd>CLICK</kbd> FIRE · <kbd>ESC</kbd> MENU`;
      this.helpT = 15;
      this.mode = 'gunner';
      this.startAudio();
      this.lock();
      return;
    }
    const now = performance.now();
    if (m.t != null) { const off = now - m.t; cl.off = cl.off == null ? off : Math.min(cl.off, off); }
    if (m.k === 'hx') {
      cl.hx = m; cl.hs = Object.assign(cl.hs || {}, m); if (m.td != null) { this.tod = m.td; this.applyDay(); }
      cl.story = m.st || null;
      if (this.map.fort) this.map.fort.locked = !m.fort;
      for (const mm of this.map.masts || []) mm.on = (m.masts || []).includes(mm.n);
      if (this.map.spire) this.map.spire.wrecked = !!m.sw;
      cl.wx = new Map((m.wx || []).map((w) => [w[0], { name: w[1], kind: w[2], eq: w[3], paint: w[4], kills: w[5] }]));
    }
    if (m.k === 'hs' && Array.isArray(m.w)) this.clientWings(m.w, m.t);
    else if (m.k === 'hs') cl.wings = [];
    if (m.k === 'hs') {
      cl.hs = Object.assign({ hpm: 1, fum: 1, cr: [], fr: [], kl: 0, sc: 0, rk: 0, bm: 0 }, cl.hx || {}, m);
      cl.hb = cl.hb || [];
      if (!cl.hb.length || m.t > cl.hb[cl.hb.length - 1].t) cl.hb.push({ t: m.t, p: m.p, q: m.q, v: m.v });
      if (cl.hb.length > 30) cl.hb.shift();
    }
    else if (m.k === 'hurt') { if (cl.wing && this.mode === 'wing') this.hurt(clamp(+m.d || 0, 0, 200), this.heli.pos); }
    else if (m.k === 'cr') { if (m.s) { this.save.scrap += m.s; this.run && (this.run.scrap += m.s); } if (m.n) { this.run && (this.run.kills += m.n); this.hitMark(true); } }
    else if (m.k === 'boarded') { if (cl.wing) { this.riders++; this.snd.step?.(1); cl.boardWait = false; } }
    else if (m.k === 'zf') { this.horde.farCrowd = m.f; this.horde.farStride = m.v === 2 ? 4 : 3; }
    else if (m.k === 'zs') {
      const seen = new Set(), z = m.z;
      let i = 0;
      while (i < z.length) {
        if (z[i] === -1) { i += 3; continue; }
        const id = z[i];
        let p = cl.zs.get(id);
        const type = ZT[z[i + 5]] || 'walker';
        if (!p) {
          p = this.horde.spawnRaw ? this.horde.spawnRaw(type, z[i + 1] / 10, z[i + 3] / 10) : this.horde.spawn(type, z[i + 1] / 10, z[i + 3] / 10); p.nid = id; p.y = z[i + 2] / 10; p.yaw = z[i + 4] / 100;
          cl.zs.set(id, p);
        }
        p.hb = p.hb || [];
        if (!p.hb.length || m.t > p.hb[p.hb.length - 1][0]) p.hb.push([m.t, z[i + 1] / 10, z[i + 2] / 10, z[i + 3] / 10, z[i + 4] / 100]);
        if (p.hb.length > 6) p.hb.shift();
        p.st = ZS[z[i + 6]] || 'walk'; if (z[i + 7]) p.hitT = 0.1; p.cd = 0;
        seen.add(id);
        i += 8;
      }
      for (const [id, p] of cl.zs) if (!seen.has(id)) { p.alive = false; cl.zs.delete(id); }
      this.horde.list = this.horde.list.filter((q) => q.alive);
    } else if (m.k === 'ev') { cl.evAt = this.t; cl.evs = m.e || []; this.syncVats(cl.evs); cl.shots = m.sh || []; cl.dos = Array.isArray(m.do) ? m.do.slice(0, 6) : []; }
    else if (m.k === 'fx') {
      for (const f of m.f || []) {
        if (f[0] === 't') { if (f[8] !== (cl.wing ? 10 + (cl.pad || 0) : cl.seat)) this.tracers.push({ from: [f[1], f[2], f[3]], dir: [f[4], f[5], f[6]], len: f[7], d: 0 }); }
        else if (f[0] === 'b') { this.blasts.push({ pos: [f[1], f[2], f[3]], t: 0, size: f[4] }); this.boomFx([f[1], f[2], f[3]], f[4]); }
        else if (f[0] === 'k') {
          const p = [...cl.zs.values()].find((z) => Math.abs(z.x - f[1]) < 1.5 && Math.abs(z.z - f[3]) < 1.5) || this.horde.spawn(ZT[f[4]] || 'walker', f[1], f[3]);
          p.y = f[2]; this.realKill ? this.realKill(p) : this.horde.kill(p, [0, 3, 0]); this.horde.events.length = 0;
          if (p.nid != null) cl.zs.delete(p.nid);
        } else if (f[0] === 'f') this.feed(f[1], f[2]);
        else if (f[0] === 'B') this.banner(f[1], f[2], f[3], f[4]);
        else if (f[0] === 'R') this.radio(f[1], f[2]);
      }
    }
  }
  // the other wingmen, as the host last saw them (stamped with the host's clock)
  clientWings(list, t) {
    const cl = this.client, keep = [];
    for (const w of list) {
      const [id, x, y, z, qx, qy, qz, qw, rpm, fire, dead, rd] = w;
      let o = cl.wings.find((q) => q.id === id);
      if (!o) o = { id, buf: [], h: { pos: [x, y, z], q: [qx, qy, qz, qw], H: mat4(), rotorA: 0, tailA: 0 } };
      if (!o.buf.length || t > o.buf[o.buf.length - 1].t) o.buf.push({ t, p: [x, y, z], q: [qx, qy, qz, qw] });
      if (o.buf.length > 24) o.buf.shift();
      Object.assign(o.h, { rpm, fire: !!fire, dead: !!dead, rd });
      const info = cl.wx && cl.wx.get(id);
      if (info) Object.assign(o.h, { kind: info.kind, eq: info.eq, paint: info.paint });
      o.h.kind = o.h.kind || 'warhorse';
      keep.push(o);
    }
    cl.wings = keep;
  }
  // play the host's helicopter and the zombies back a little in the past, smoothly between the updates either side
  // (updates over the internet arrive in uneven clumps; chasing the newest one is what made it stutter)
  clientSync(dt) {
    const cl = this.client, H = cl.heli, hs = cl.hs;
    if (cl.off != null) cl.off += dt * 4;                       // let the clock estimate drift up so a lucky fast message doesn't stick
    const rt = performance.now() - (cl.off || 0) - 140;
    const at = (buf, t, get) => {
      if (!buf || !buf.length) return null;
      let i = buf.length - 1;
      while (i > 0 && get(buf[i], 't') > t) i--;
      const a = buf[i], b = buf[Math.min(i + 1, buf.length - 1)];
      const ta = get(a, 't'), tb = get(b, 't');
      const k = tb > ta ? clamp((t - ta) / (tb - ta), 0, 1) : 0;
      return { a, b, k, over: Math.max(0, Math.min(0.3, (t - Math.max(ta, tb)) / 1000)) };
    };
    if (hs && cl.hb && cl.hb.length) {
      const r = at(cl.hb, rt, (o) => o.t);
      const { a, b, k, over } = r;
      const want = a.p.map((v, i) => v + (b.p[i] - v) * k + b.v[i] * over);
      if (Math.hypot(want[0] - H.pos[0], want[1] - H.pos[1], want[2] - H.pos[2]) > 40) H.pos = [...want];
      const kk = damp(30, dt);
      for (let i = 0; i < 3; i++) H.pos[i] += (want[i] - H.pos[i]) * kk;
      let qb = b.q; if (a.q[0] * qb[0] + a.q[1] * qb[1] + a.q[2] * qb[2] + a.q[3] * qb[3] < 0) qb = qb.map((v) => -v);
      let q = norm4(a.q.map((v, i) => v + (qb[i] - v) * k));
      if (q[0] * H.q[0] + q[1] * H.q[1] + q[2] * H.q[2] + q[3] * H.q[3] < 0) q = q.map((v) => -v);
      H.q = norm4(H.q.map((v, i) => v + (q[i] - v) * kk));
      H.vel = b.v; H.rpm = hs.rpm; H.boost = hs.b;
      qmat(H.H, H.q, H.pos);
      if (hs.eq) cl.eq = hs.eq; if (hs.pt) cl.paint = hs.pt; if (hs.hk && hs.hk !== cl.hk) { cl.hk = hs.hk; cl.heli.stats = statsFor(cl.eq, cl.hk); }
    }
    H.rotorA += H.rpm * 26 * dt; H.tailA += H.rpm * 70 * dt;
    const zt = rt - 60;            // zombies come less often, so a touch further back
    for (const p of cl.zs.values()) {
      const r = at(p.hb, zt, (o) => o[0]);
      if (!r) continue;
      const { a, b, k } = r;
      const x = a[1] + (b[1] - a[1]) * k, z = a[3] + (b[3] - a[3]) * k;
      const sp = Math.hypot(x - p.x, z - p.z) / Math.max(dt, 1e-3);
      p.x = x; p.y = a[2] + (b[2] - a[2]) * k; p.z = z;
      p.yaw = a[4] + Math.atan2(Math.sin(b[4] - a[4]), Math.cos(b[4] - a[4])) * k;
      p.ph += dt * Math.min(9, 1.5 + sp * 2.4);
      p.hitT = Math.max(0, p.hitT - dt);
    }
    // the other wingmen: played back like the host's helicopter
    for (const o of cl.wings) {
      const w = o.h, S2 = HeliGame.sample(o.buf, rt); if (!S2) continue;
      const kk = damp(30, dt);
      if (Math.hypot(S2.p[0] - w.pos[0], S2.p[1] - w.pos[1], S2.p[2] - w.pos[2]) > 40) w.pos = [...S2.p];
      for (let i = 0; i < 3; i++) w.pos[i] += (S2.p[i] - w.pos[i]) * kk;
      let q = S2.q; if (q[0] * w.q[0] + q[1] * w.q[1] + q[2] * w.q[2] + q[3] * w.q[3] < 0) q = q.map((v) => -v);
      w.q = norm4(w.q.map((v, i) => v + (q[i] - v) * kk));
      qmat(w.H, w.q, w.pos); w.rotorA += (w.rpm || 0) * 26 * dt; w.tailA += (w.rpm || 0) * 70 * dt;
    }
    return rt;
  }

  // ---- WINGMAN: flying your own helicopter on someone else's server. This game flies it and fires its guns; the
  // host's game owns the zombies, so anything you hit is sent over and the host does the damage.
  wingStart(pad) {
    const cl = this.client, s = this.save, S = statsFor(s.eq, s.heli);
    cl.wing = true; cl.pad = pad;
    this.root.classList.remove('da-gunner'); this.root.classList.add('da-wing');
    S.rotorTier = s.eq.rotor; this.S = S;
    const sp0 = this.spawnFor(S, pad);
    this.heli = new Chopper();
    this.heli.reset(sp0.pos, sp0.yaw, S);
    this.run = { t: 0, kills: 0, rescued: 0, lost: 0, scrap: 0 };
    this.session = { fob: this.map.spire };
    this.story = null;
    this.hp = S.hp; this.fuel = S.fuel;
    this.heat = 0; this.overT = 0; this.gunT = 0; this.spinV = 0; this.flashT = 0;
    this.rockets = S.rockets; this.rocketT = 0; this.rocketRegen = 0; this.rocketSide = 0;
    this.bombs = S.bombs; this.bombT = 0; this.siren = 0; this.raid = null; this.riders = 0;
    this.shield = 0; this.shieldHit = 0; this.shieldT = 0; this.flaresLeft = S.flares; this.flareRegen = 0; this.beaconsLeft = S.beacons; this.beacons = []; this.mag = []; this.beams = [];
    this.shots = []; this.tracers = []; this.blasts = []; this.fires = []; this.runners = []; this.splats = [];
    this.boardT = 0; this.unloadT = 0; this.unloading = false; this.boarding = false; this.suppressUsed = false;
    this.doorAim = [[-Math.PI / 2, -0.3], [Math.PI / 2, -0.3]]; this.doorT = [0, 0]; this.doorTgt = [null, null]; this.doorFlash = [0, 0];
    this.shake = 0; this.dmgT = 0; this.camMode = this.camMode || 0; this.camEye = null; this.camLook = null; this.scav = null; this.drop = null; this.crate = null;
    this.wireHorde();
    this.applyDay();
    this.help(true);
    this.helpT = 14;
    this.mode = 'wing';
    this.banner('WINGMAN', `FLYING WITH ${cl.hx ? 'THE HOST' : 'YOUR FRIEND'} · RESCUE, FIGHT, STAY CLOSE`, '', 3);
    this.startAudio();
    this.lock();
  }
  // on a wingman's machine the zombies are copies of the host's: hits get collected up and sent over
  wireHorde() {
    const hd = this.horde, cl = this.client;
    const CAUSE = ['gun', 'pod', 'door', 'rocket', 'bomb', 'fire', 'grenade', 'drone', 'ap', 'shell', 'zap'];
    hd.damage = (z, dmg, push, cause) => {
      if (!z.alive || z.nid == null) return false;
      const e = cl.hz.get(z.nid) || [0, 0]; e[0] += dmg; e[1] = Math.max(0, CAUSE.indexOf(cause)); cl.hz.set(z.nid, e);
      z.hitT = 0.12;
      return false;
    };
    hd.blast = (p, r, dmg, force, cause) => {
      cl.hbl.push([q1(p[0]), q1(p[1]), q1(p[2]), q1(r), Math.round(dmg), Math.round(force || 8), Math.max(0, CAUSE.indexOf(cause)), 0]);
      let n = 0; for (const z of hd.list) if (z.alive && Math.hypot(z.x - p[0], z.z - p[2]) < r) { n++; z.hitT = 0.12; }
      return n;
    };
  }
  unwireHorde() { if (this.horde) { delete this.horde.damage; delete this.horde.blast; } }
  wingFrame(dt) {
    const cl = this.client;
    if (!cl || !cl.heli) return;
    this.clientSync(dt);
    const H = this.heli, S = this.S, live = this.mode === 'wing';
    this.run.t += dt;
    const ctrl = live && !this.panel;
    const k = (c) => (ctrl && this.key(c) ? 1 : 0);
    const ctl = {
      coll: H.dead ? 0 : k('KeyW') - k('KeyS'), yaw: k('KeyA') - k('KeyD'),
      mx: ctrl && this.locked ? this.mx : 0, my: ctrl && this.locked ? this.my : 0,
      pk: k('ArrowUp') - k('ArrowDown'), rk: k('ArrowRight') - k('ArrowLeft'),
      boost: ctrl && (this.key('ShiftLeft') || this.key('ShiftRight')) && this.fuel > 0,
      mode: this.save.flight || 'easy', assist: this.save.flight !== 'pro', sens: this.save.sens, invert: this.save.invert,
      engineOn: !this.wDown, noFuel: this.fuel <= 0,
    };
    ctl.hold = this.holdOn(ctl);
    H.extraMass = 0;
    H.step(dt, ctl, this.world);
    this.edge(dt);
    const easy = this.save.flight === 'easy';
    for (const ev of H.events) {
      if (ev.type === 'impact') { this.hurt(ev.speed * (ev.hard ? 14 : 9) * (easy ? 0.5 : 1) * (S.gpws ? 0.7 : 1), ev.point); this.fx.sparks(ev.point, 12, [1, 0.8, 0.4], 7, 0.5, 0.05, 2); this.snd.meleeWall?.('smash'); this.shake = Math.max(this.shake, 0.5); }
      else if (ev.type === 'rotor') { this.rotorHitT = (this.rotorHitT || 0) - dt; if (this.rotorHitT <= 0) { this.rotorHitT = 0.15; this.hurt(S.toughBlades ? 2 : easy ? 7 : 14, ev.point); } }
    }
    H.events.length = 0;
    this.gpwsTick(dt);
    if (H.dead && !this.wDown && (H.contacts || H.pos[1] < 1)) this.wingCrash();
    if (this.wDown) { this.wDown -= dt; if (this.wDown <= 0) this.wingRespawn(); }
    this.burnFuel(dt, ctl);
    if (live && !H.dead && !this.panel && !this.wDown) this.weapons(dt);
    this.upkeep(dt);
    this.doorGuns(dt);
    this.marksman(dt);
    this.updateShots(dt);
    this.gadgets(dt);
    this.wingLanding(dt);
    const aglHit = this.world.raycast([H.pos[0], H.pos[1] - 2, H.pos[2]], [0, -1, 0], 1000);
    this.agl = aglHit ? aglHit.t : 1000;
    for (let i = this.blasts.length - 1; i >= 0; i--) { const b = this.blasts[i]; b.t += dt; if (b.t > 0.5) this.blasts.splice(i, 1); }
    this.fx.update(dt); this.ageSmoke(dt);
    // tell the host where we are (20 a second) and what we hit (15 a second)
    cl.sendT -= dt;
    if (cl.sendT <= 0) {
      cl.sendT = 1 / 15;
      const { d } = this.bore();
      const firing = live && this.locked && (this.btn.has(0) || this.clk.has(0) || this.key('KeyF')) && this.overT <= 0 && !H.dead;
      cl.tr.send({ k: 'wp', t: Math.round(performance.now()), p: H.pos.map(q2), q: H.q.map((v) => Math.round(v * 1000) / 1000), v: H.vel.map(q1), r: q2(H.rpm), f: firing ? 1 : 0, d: d.map(q2), dead: H.dead || this.wDown ? 1 : 0, rd: this.riders });
    }
    cl.hitT = (cl.hitT || 0) - dt;
    if (cl.hitT <= 0 && (cl.hz.size || cl.hbl.length)) {
      cl.hitT = 1 / 10;
      cl.tr.send({ k: 'hits', z: [...cl.hz].map(([n, e]) => [n, Math.round(e[0]), e[1]]), b: cl.hbl.splice(0, 40) });
      cl.hz.clear();
    }
    this.camera(dt);
    this.hud(dt);
    this.audio();
  }
  // back out of the hangar onto the server, with whatever you just changed
  wingReturn() {
    const cl = this.client, s = this.save, S = statsFor(s.eq, s.heli);
    S.rotorTier = s.eq.rotor; this.S = S;
    this.closePanel();
    this.$('hangar').classList.add('hidden'); this.$('hud').classList.remove('hidden');
    this.wDown = 0; this.wingRespawn();
    this.flaresLeft = S.flares; this.beaconsLeft = S.beacons; this.heat = 0; this.overT = 0; this.riders = 0;
    cl.tr.send({ k: 'kit', kind: s.heli, eq: capEq(s.eq, s.heli), paint: s.paint, dc: (({ camo, nose, tailArt, num }) => ({ camo, nose, tailArt, num }))(s) });
    this.applyDay();
    this.mode = 'wing';
    this.startAudio();
    this.lock();
  }
  wingCrash() {
    const p = this.heli.pos;
    this.boomFx(p, 3);
    this.heli.vel = [0, 0, 0]; this.heli.rpm = 0;
    this.wDown = 6;
    if (this.riders) { this.feed(`${this.riders} SURVIVOR${this.riders > 1 ? 'S' : ''} DIDN'T MAKE IT`, 'r'); this.riders = 0; }
    this.banner('SHOT DOWN', 'BACK IN THE AIR IN A FEW SECONDS', 'bad', 3);
  }
  wingRespawn() {
    this.wDown = 0;
    const S = this.S, sp0 = this.spawnFor(S, this.client.pad || 0);
    this.heli = new Chopper();
    this.heli.reset(sp0.pos, sp0.yaw, S);
    this.hp = S.hp; this.fuel = S.fuel; this.rockets = S.rockets; this.bombs = S.bombs; this.suppressUsed = false; this.camEye = null;
    this.feed('BACK ON THE PAD · GOOD AS NEW', 'g');
  }
  // what a wingman can do where they are: fuel and fix at a base, pick people up off roofs, drop them at a base
  wingLanding(dt) {
    const H = this.heli, S = this.S, cl = this.client;
    const ok = !H.dead && this.mode === 'wing' && !this.wDown, spd = Math.hypot(...H.vel);
    const settled = ok && H.contacts >= 2 && spd < 3.5;
    const nearBox = (b, up) => { const h = H.pos[1] - 1.92 - b.max[1]; return ok && spd < (S.winch ? 8 : 6) && H.pos[0] > b.min[0] - 4 && H.pos[0] < b.max[0] + 4 && H.pos[2] > b.min[2] - 4 && H.pos[2] < b.max[2] + 4 && h > -2 && h < up; };
    this.atFob = this.fobs.find((f) => !f.locked && (f.pads ? f.pads.some((p) => nearBox(p.box, 6)) : nearBox(f.pad, 6))) || null;
    const reach = S.hoist ? 52 : S.winch ? 32 : 12;
    const roof = ok && spd < 8 ? cl.evs.find((e) => (e.k === 'rescue' || e.k === 'crash') && e.n > 0 && Math.abs(e.x - H.pos[0]) < 16 && Math.abs(e.z - H.pos[2]) < 16 && H.pos[1] - 1.9 - e.y > -2 && H.pos[1] - 1.9 - e.y < reach) : null;
    this.settled = settled;
    const seatsFree = S.seats - this.riders;
    const acts = [];
    if (roof) acts.push(['KeyE', 'E', this.boarding ? `LOADING… ${roof.n} LEFT` : seatsFree <= 0 ? 'CABIN FULL' : `PICK UP ${roof.n}`, () => { this.boarding = true; }]);
    // planes: call the host's dustoffs, and drop engineers on the masts, just like the host can
    if (ok && S.plane && !S.vtol) {
      const P = H.pos, hd = (e) => Math.hypot(e.x - P[0], e.z - P[2]), busy = new Set((cl.dos || []).map((q) => q[7]));
      const job = cl.evs.filter((e) => (((e.k === 'rescue' || e.k === 'crash') && e.n > 0) || (e.k === 'crate' && e.l && !e.c && !e.dz && !e.dn)) && !busy.has(e.id) && hd(e) < 800).sort((a, b) => hd(a) - hd(b))[0];
      if (job && (cl.dustAsk || 0) < this.t) acts.push(['KeyE', 'E', (cl.dos || []).length >= 3 ? 'ALL THREE DUSTOFFS ARE OUT' : `CALL A DUSTOFF TO THE ${job.k === 'crate' ? 'SUPPLY DROP' : 'SURVIVORS'} (${Math.round(hd(job))} M)`, () => { cl.tr.send({ k: 'dust', id: job.id }); cl.dustAsk = this.t + 3; this.feed('DUSTOFF REQUESTED', 'g'); this.snd.checkpoint?.(); }, (cl.dos || []).length >= 3]);
      const mast = cl.evs.find((e) => e.k === 'mast' && !e.wk && hd(e) < 260 && P[1] - (e.my || 0) < 300);
      if (mast && (cl.mastAsk || 0) < this.t) acts.push(['KeyE', 'E', `PARACHUTE THE ENGINEER IN AT ${mast.nm || 'THE MAST'}`, () => { cl.tr.send({ k: 'mast', id: mast.id }); cl.mastAsk = this.t + 5; this.feed('ENGINEER AWAY · CHUTE OPEN', 'g'); }]);
    }
    const f = this.atFob;
    if (f && !f.wrecked) {
      if (this.riders > 0) acts.push(['KeyE', 'E', `DROP OFF ${this.riders}`, () => { cl.tr.send({ k: 'drop', n: this.riders }); this.feed(`${this.riders} SURVIVORS SAFE`, 'g'); this.riders = 0; this.snd.coins?.(); }]);
      const pct = (v) => `${Math.round(v * 100)}%`;
      acts.push(['Digit1', '1', this.fuel >= S.fuel - 0.5 ? 'FUEL FULL' : `REFUEL (${pct(this.fuel / S.fuel)})`, () => { this.svc = 'fuel'; }, this.fuel >= S.fuel - 0.5]);
      acts.push(['Digit2', '2', this.hp >= S.hp ? 'NO DAMAGE' : `REPAIR (${pct(this.hp / S.hp)})`, () => { this.svc = 'fix'; }, this.hp >= S.hp]);
      const full = this.rockets >= S.rockets && this.bombs >= S.bombs;
      acts.push(['Digit3', '3', full ? 'ARMED' : 'REARM', () => { this.rockets = S.rockets; this.bombs = S.bombs; this.beaconsLeft = S.beacons; this.flaresLeft = S.flares; this.heat = 0; this.overT = 0; this.snd.magIn?.(); this.feed('REARMED', 'g'); }, full]);
      acts.push(['KeyH', 'H', 'HANGAR', () => { if (this.riders > 0) { cl.tr.send({ k: 'drop', n: this.riders }); this.riders = 0; } this.toHangar(); }, true]);
    }
    if (!f || f.wrecked) this.svc = null;
    if (this.svc === 'fuel') { this.fuelUp(S.fuel * 1.5 * dt); if (this.fuel >= S.fuel) this.svc = null; }
    if (this.svc === 'fix') { this.hp = Math.min(S.hp, this.hp + S.hp * 1.5 * dt); if (this.hp >= S.hp) this.svc = null; }
    this.servicing = !!this.svc;
    this.actions = acts;
    for (const [code, , , fn] of acts) if (this.hit(code) && !this.panel) { fn(); break; }
    if (settled && acts.length && !this.wasSettled && this.locked) this.unlockSoft();
    this.wasSettled = settled && acts.length > 0;
    if (!roof) this.boarding = false;
    this.atRoof = null;
    if (this.boarding && roof) {
      this.boardT -= dt;
      if (seatsFree <= 0) this.boarding = false;
      else if (this.boardT <= 0 && !cl.boardWait) { this.boardT = S.hoist ? 0.15 : 0.35; cl.boardWait = true; setTimeout(() => { cl.boardWait = false; }, 900); cl.tr.send({ k: 'board', id: roof.id }); }
    }
  }

  gunnerFrame(dt) {
    const cl = this.client;
    if (!cl || !cl.heli) return;
    const H = cl.heli, hs = cl.hs;
    this.clientSync(dt);
    // aiming: the mouse turns the gun, within what the door allows
    const side = cl.seat === 0 ? 1 : -1, live = this.mode === 'gunner';
    if (live && this.locked) {
      const k = 0.0025 * (this.save.sens || 1);
      cl.aim[0] -= this.mx * k; cl.aim[1] = clamp(cl.aim[1] - this.my * k * (this.save.invert ? -1 : 1), -1.35, 0.55);
      const c = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      cl.aim[0] = c + clamp(Math.atan2(Math.sin(cl.aim[0] - c), Math.cos(cl.aim[0] - c)), -1.45, 1.45);
    }
    cl.fire = live && this.locked && (this.btn.has(0) || this.clk.has(0));
    cl.sendT -= dt;
    if (cl.sendT <= 0) { cl.sendT = 1 / 15; cl.tr.send({ k: 'aim', a: cl.aim.map((v) => Math.round(v * 1000) / 1000), f: cl.fire ? 1 : 0 }); }
    const a = cl.aim, dl = qrot(H.q, [-Math.sin(a[0]) * Math.cos(a[1]), Math.sin(a[1]), -Math.cos(a[0]) * Math.cos(a[1])]);
    const gunAt = H.toWorld(mountAt(cl.hk, 'door', [side * 1.25, 0.1, 0.6]));
    // your own shots show straight away (the pilot's game decides what they hit)
    cl.fireT = (cl.fireT || 0) - dt;
    cl.flash = Math.max(0, (cl.flash || 0) - dt);
    if (cl.fire && cl.fireT <= 0) {
      cl.fireT = 1 / 11;
      const o = gunAt.map((c, i) => c + dl[i] * 1.5), dir = norm(dl.map((v) => v + (Math.random() - 0.5) * 0.025));
      const w = this.world.raycast(o, dir, 180), zh = this.horde.hitRay(o, dir, w ? w.t : 180);
      this.tracers.push({ from: o, dir, len: zh ? zh.t : w ? w.t : 180, d: 0 });
      if (zh) { this.hitMark(false); zh.z.hitT = 0.1; } else if (w) this.fx.impact(o.map((c, i) => c + dir[i] * w.t), w.normal, w.box.color);
      cl.flash = 0.05;
      this.snd.burst?.(0.05, 1200, 0.16);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) { const t = this.tracers[i]; t.d += dt * 700; if (t.d > t.len) this.tracers.splice(i, 1); }
    for (let i = this.blasts.length - 1; i >= 0; i--) { const b = this.blasts[i]; b.t += dt; if (b.t > 0.5) this.blasts.splice(i, 1); }
    this.fx.update(dt); this.ageSmoke(dt);
    this.shake = Math.max(0, (this.shake || 0) - dt * 1.6);
    // camera: over the gunner's shoulder
    const up = qrot(H.q, [0, 1, 0]);
    let eye = gunAt.map((c, i) => c + dl[i] * 0.25 + up[i] * 0.42);
    if (this.shake > 0) eye = eye.map((c) => c + (Math.random() - 0.5) * this.shake * 0.4);
    this.eye = eye;
    const st = {
      rotorA: H.rotorA, tailA: H.tailA, rpm: H.rpm, vs: Math.hypot(H.vel[0], H.vel[2]), tk: H.stats && H.stats.vtol ? H.tiltK : null, spin: hs ? hs.sp : 0, t: this.t, riders: hs ? hs.rd : 0, boost: H.boost,
      crew: hs ? hs.cr.map((r) => ({ col: (ROLES[ROLE_IDS[r]] || ROLES.rifleman).col })) : [],
      doorAim: [0, 1].map((sd) => (sd === cl.seat ? cl.aim : hs && hs.da[sd] ? hs.da[sd] : [sd === 0 ? -1.57 : 1.57, -0.3])),
      doorFlash: [0, 1].map((sd) => (sd === cl.seat ? cl.flash : hs ? hs.df[sd] * 0.05 : 0)),
      doorFriend: [0, 1].map((sd) => (sd === cl.seat ? { col: FRIEND_COLS[sd], self: true } : hs && hs.fr.some((f) => f[0] === sd) ? { col: FRIEND_COLS[sd] } : null)),
      flash: hs && hs.fl ? 0.04 : 0, rockets: hs ? hs.rk : 0, rocketMax: statsFor(cl.eq, cl.hk).rockets, bombs: hs ? hs.bm : 0, bombMax: statsFor(cl.eq, cl.hk).bombs,
    };
    const parts = hs && hs.m === 'd' ? [] : chopperParts(capEq(cl.eq, cl.hk), cl.dc ? { ...(PAINT[cl.paint] || PAINT.olive), ...cl.dc } : PAINT[cl.paint] || PAINT.olive, st, H.H, cl.hk);
    this.draw(eye, dl, 0, parts, this.extraParts(true), H.pos, 0.0045);
    this.gunnerHud(dt);
  }
  gunnerHud(dt) {
    const cl = this.client, hs = cl.hs;
    if (!hs) return;
    this.helpT = Math.max(0, (this.helpT || 0) - dt);
    this.$('help').style.opacity = this.helpT > 0 ? 1 : 0;
    const setM = (id, p, hot) => { const m = this.$(id); m.style.setProperty('--p', clamp(p, 0, 1).toFixed(3)); m.classList.toggle('hot', !!hot); };
    setM('hpm', hs.hp / hs.hpm, hs.hp / hs.hpm < 0.3);
    setM('fuelm', hs.fu / hs.fum, hs.fu / hs.fum < 0.2);
    this.$('fueltxt').textContent = `${Math.round((hs.fu / hs.fum) * 100)}%`;
    this.$('heatm').classList.add('hidden'); this.$('boostm').classList.add('hidden');
    const me = hs.fr.find((f) => f[0] === cl.seat);
    this.$('right').innerHTML = `<div><small>YOUR KILLS</small>${me ? me[1] : 0}</div><div><small>TEAM KILLS</small>${hs.kl}</div><div><small>ON BOARD</small>${hs.rd}</div><div><small>PILOT'S SCRAP</small>⚙ ${hs.sc}</div>`;
    this.$('alt').textContent = hs.m === 'h' ? 'IN THE HANGAR' : `ALT ${Math.round(cl.heli.pos[1])}M`;
    this.$('spd').textContent = `${Math.round(Math.hypot(...hs.v) * 3.6)} KM/H`;
    this.$('cross').style.display = '';
    this.hitT = Math.max(0, (this.hitT || 0) - dt); if (this.hitT <= 0) this.$('hit').style.opacity = 0;
    this.$('acts').replaceChildren(); this.$('status').textContent = '';
    this.$('warn').classList.toggle('hidden', hs.m !== 'h'); this.$('warn').textContent = hs.m === 'h' ? 'THE PILOT IS IN THE HANGAR' : '';
    const fm = this.friendMarks();
    this.markers([...cl.evs.map((e) => e.mk), ...fm, ...this.dustMarks()], cl.heli.pos);
    this.minimap(cl.heli.pos, cl.heli.heading, [...cl.evs.map((e) => e.mk), ...fm], [...cl.zs.values()]);
    this.eventsList(cl.evs.map((e) => e.mk), cl.heli.pos);
    this.bossBar(this.bossNear(cl.heli.pos));
  }

  // ---------------------------------------------------------------- camera, HUD, sound
  camera(dt) {
    const H = this.heli;
    const f = H.fwd, fl = Math.hypot(f[0], f[2]) || 1, ff = [f[0] / fl, 0, f[2] / fl];
    const sp = Math.hypot(...H.vel);
    let eye, look;
    if (this.camMode === 3) {
      // in the pilot's seat: look out along the nose; the dash and the canopy frame are drawn over the top
      eye = H.toWorld(seatFor(this.save.heli));
      const nf = H.toWorld([0, -0.12, -10]);
      look = norm([nf[0] - eye[0], nf[1] - eye[1], nf[2] - eye[2]]);
    } else if (this.camMode === 2) { eye = H.toWorld([0, -0.2, -3.9]); look = this.bore().d; }
    else {
      const far = this.camMode === 1;
      const dive = Math.max(0, -H.pitch);
      const cm = (AIRFRAMES[this.save.heli] || AIRFRAMES.warhorse).cam, dist = ((far ? 30 : 18) + sp * 0.06) * cm, hgt = ((far ? 14 : 9) + dive * (far ? 16 : 12)) * (0.6 + cm * 0.4);
      const want = [H.pos[0] - ff[0] * dist, H.pos[1] + hgt, H.pos[2] - ff[2] * dist];
      if (!this.camEye) { this.camEye = want; this.camLook = null; }
      const k = damp(9, dt);
      for (let i = 0; i < 3; i++) this.camEye[i] += (want[i] - this.camEye[i]) * k;
      const v = [this.camEye[0] - H.pos[0], this.camEye[1] - H.pos[1], this.camEye[2] - H.pos[2]], vl = Math.hypot(...v);
      const hit = this.world.raycast(H.pos, v.map((c) => c / vl), vl);
      eye = hit ? H.pos.map((c, i) => c + (v[i] / vl) * Math.max(3, hit.t - 0.6)) : [...this.camEye];
      eye[1] = Math.max(eye[1], this.terrain.heightAt(eye[0], eye[2]) + 1.2, WATER + 0.6);
      const { o, d } = this.bore();
      const tgt = [o[0] + d[0] * 70, Math.max(o[1] + d[1] * 70, H.pos[1] - 25) - 1, o[2] + d[2] * 70];
      const want2 = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
      if (!this.camLook) this.camLook = want2;
      this.camLook = norm(this.camLook.map((c, i) => c + (want2[i] - c) * damp(10, dt)));
      look = this.camLook;
    }
    if (this.shake > 0) { const s = this.shake * 0.5; eye = eye.map((c) => c + (Math.random() - 0.5) * s); }
    this.eye = eye;
    const roll = this.camMode >= 2 ? -H.rollL : -H.rollL * 0.3;
    const S = this.S, s = this.save;
    const fr = this.coop ? [...this.coop.friends.values()] : [];
    const st = {
      rotorA: H.rotorA, tailA: H.tailA, rpm: H.rpm, vs: Math.hypot(H.vel[0], H.vel[2]), tk: H.stats && H.stats.vtol ? H.tiltK : null, spin: (this.spin = (this.spin || 0) + this.spinV * dt * 40), t: this.t, install: null, riders: this.riders,
      crew: s.team.filter((m) => m.aboard && !m.raid && m.hp > 0).slice(0, 4).map((m) => ({ col: ROLES[m.role].col })),
      rockets: this.rockets, rocketMax: S.rockets, bombs: this.bombs, bombMax: S.bombs, boost: H.boost, doorAim: this.doorAim, doorFlash: this.doorFlash, flash: this.flashT,
      shieldK: S.shield ? this.shield / S.shield : 0, shieldHit: this.shieldHit, flares: S.flares ? this.flaresLeft / S.flares : 0,
      tailAim: this.tailAI?.aim, tailFlash: this.tailFlash, magnetOn: this.mag.length > 0,
      siren: this.siren > 0, nvgOn: S.nvg && this.nvgOn !== false && (this.nvNow || 0) > 0.05, beacons: S.beacons ? this.beaconsLeft / S.beacons : 0, lightOn: this.lightOn, tYaw: this.tYaw || 0, zap: this.zap || 0,
      cable: this.boarding && this.atRoof && S.winch ? Math.max(0.8, H.pos[1] - 1 - this.atRoof.roof.top) : this.mag.length ? 4.6 : 0.8,
      charge: S.gun.rail ? clamp(1 - this.gunT, 0, 1) : 1,
      podFlash: this.podFlash || 0, podSide: this.podSideNow, snipeAim: this.snipeAim, snipeFlash: this.snipeFlash || 0,
      doorFriend: [0, 1].map((sd) => { const f = fr.find((q) => q.seat === sd); if (f) return { col: f.col }; const rf = s.team.filter((m) => m.aboard && !m.raid && m.hp > 0 && m.role === 'rifleman'); return sd >= (S.gunners || 0) && rf.length > sd - (S.gunners || 0) ? { col: ROLES.rifleman.col } : null; }),
    };
    const parts = this.mode === 'down' || this.camMode === 3 ? [] : chopperParts(capEq(s.eq, s.heli), paintFor(s), st, H.H, s.heli);
    this.lastParts = parts;
    this.draw(eye, look, roll, parts, this.extraParts(false), H.pos, 0.0038);
  }

  // survivors, scenarios, turrets, shots, blasts, tracers
  extraParts(client) {
    const out = [];
    const P = (p, r, s, col, o = {}) => { const mm = new Float32Array(16); compose(mm, p, r, s); out.push({ model: mm, scale: s, color: col, emissive: o.em || 0, shape: o.shape, alpha: o.alpha, mat: o.mat, tex: o.tex }); };
    const person = (x, y, z, yaw, wave, i) => {
      const sh = [[0.8, 0.2, 0.2], [0.2, 0.4, 0.8], [0.9, 0.8, 0.3], [0.9, 0.9, 0.9], [0.3, 0.7, 0.4]][Math.abs(i) % 5];
      P([x, y + 0.45, z], [0, yaw, 0], [0.22, 0.9, 0.22], [0.15, 0.17, 0.22], { shape: 0.05 });
      P([x, y + 1.2, z], [0, yaw, 0], [0.44, 0.6, 0.26], sh, { shape: 0.06 });
      P([x, y + 1.68, z], [0, yaw, 0], [0.26, 0.28, 0.26], [0.86, 0.68, 0.55], { shape: 'sphere' });
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      for (const sd of [-1, 1]) {
        const a = wave ? 2.5 + Math.sin(this.t * 9 + i * 1.7 + sd) * 0.45 : 0.25 + Math.sin(this.t * 10 + sd * 2) * 0.4;
        const ox = sd * 0.3 + sd * Math.sin(a) * 0.3;
        P([x + ox * c, y + 1.45 - Math.cos(a) * 0.3, z - ox * sn], [0, yaw, sd * a], [0.12, 0.6, 0.12], sh, { shape: 0.04 });
      }
    };
    // supply chutes floating down to your team
    for (const c of (!client && this.chutes) || []) crateParts(P, c.x, c.y, c.z, c.done, false, this.t, null);
    // one of your team: helmet and vest in their job's colour, and their gun
    const soldier = (x, y, z, yaw, m) => {
      const c = Math.cos(yaw), sn = Math.sin(yaw), col = ROLES[m.role].col, L = (lx, ly, lz) => [x + lx * c + lz * sn, y + ly, z - lx * sn + lz * c];
      for (const sd of [-1, 1]) P(L(sd * 0.12, 0.45, 0), [0, yaw, 0], [0.2, 0.9, 0.22], [0.2, 0.22, 0.18], { shape: 'cylY' });
      P(L(0, 1.18, 0), [0, yaw, 0], [0.48, 0.62, 0.3], [0.25, 0.27, 0.22], { shape: 0.06, mat: 'cloth' });
      P(L(0, 1.2, -0.05), [0, yaw, 0], [0.5, 0.45, 0.32], m.armor === 'none' ? [0.25, 0.27, 0.22] : col.map((v) => v * 0.7), { shape: 0.05 });
      P(L(0, 1.68, 0), [0, yaw, 0], [0.26, 0.28, 0.26], [0.86, 0.68, 0.55], { shape: 'sphere' });
      P(L(0, 1.79, 0), [0, yaw, 0], [0.32, 0.18, 0.34], col, { shape: 'sphere' });
      P(L(0.12, 1.25, -0.4), [0, yaw, 0], [0.08, 0.1, m.wpn === 'pistol' ? 0.3 : 0.8], [0.1, 0.1, 0.1], { mat: 'metal' });
      if (m.flashT > 0) { m.flashT -= 1 / 60; P(L(0.12, 1.25, -0.9), [0, 0, 0], [0.2, 0.2, 0.2], [1, 0.8, 0.4], { em: 1, shape: 'sphere', alpha: 0.8 }); }
    };
    if (client || this.client) {
      const cl = this.client;
      for (const e of cl.evs) {
        if (e.k === 'convoy') convoyParts(P, e.t);
        if (e.k === 'crash') wreckParts(P, e.wx, e.y, e.wz, e.yw, this.t);
        if (e.k === 'rescue' || e.k === 'crash') {
          for (let i = 0; i < e.n; i++) { const a = (e.s - e.n + i) * 2.1 + e.w; person(e.x + Math.cos(a) * 1.8, e.y, e.z + Math.sin(a) * 1.8, -a, true, i); }
          if (e.n > 0) P([e.x + 2.2, e.y + 45, e.z - 2.2], [0, 0, 0], [1.8, 90, 1.8], [0.3, 1, 0.35], { em: 1, shape: 'cylY', alpha: 0.18 });
        } else if (e.k === 'crate') crateParts(P, e.x, e.y, e.z, e.l, e.c, this.t, cl.heli);
        else if (e.k === 'boss' && Array.isArray(e.p)) {
          // what the boss threw, carried on from where the host last saw it
          const a = Math.min(0.5, this.t - (cl.evAt || this.t));
          for (const q of e.p.slice(0, 20)) {
            const gr = q[0] === 'r' ? 9.8 : 5, pos = [q[1] + q[6] * a, q[2] + q[7] * a - 0.5 * gr * a * a, q[3] + q[8] * a];
            if (q[0] === 'r') P(pos, [q[4] + a * 4, (q[4] + a * 4) * 0.7, 0], [2.0, 1.4, 4.2], CARS[q[5]] || CARS[0], { shape: 0.15, mat: 'paint' });
            else P(pos, [0, 0, 0], [1.3, 1.3, 1.3], [0.55, 1, 0.2], { em: 1, shape: 'sphere' });
          }
        }
      }
      for (const s of cl.shots) {
        const v = norm([s[4], s[5], s[6]]), ang = [Math.asin(clamp(v[1], -1, 1)), Math.atan2(-v[0], -v[2]), 0];
        if (s[0] === 'r') { P([s[1], s[2], s[3]], ang, [0.2, 0.2, 1.1], [0.85, 0.85, 0.8], { shape: 'cyl' }); this.fx.flame([s[1], s[2], s[3]], [0, 0, 0], 1.2); }
        else if (s[0] === 'b') P([s[1], s[2], s[3]], ang, [0.4, 0.4, 0.95], [0.3, 0.32, 0.25], { shape: 'sphere' });
        else P([s[1], s[2], s[3]], ang, [0.35, 0.35, 1.6], [0.5, 0.95, 1], { em: 1, shape: 'sphere', alpha: 0.9 });
        for (let i = 0; i < 3; i++) s[1 + i] += s[4 + i] / 60;
      }
    }
    if (!client) {
      for (const e of this.director.list) e.parts(P, this.t, person, this.heli);
      for (const rn of this.runners || []) {
        const k = Math.max(0, rn.slow ? (rn.t < 0.5 ? rn.t * 2 : 1) : rn.t), p = rn.from.map((c, i) => c + (rn.to[i] - c) * k);
        if (rn.slow && rn.t >= 0.5) continue;
        p[1] = rn.from[1] + (rn.to[1] - rn.from[1]) * k + Math.sin(k * Math.PI) * 0.4;
        person(p[0], p[1], p[2], Math.atan2(-(rn.to[0] - rn.from[0]), -(rn.to[2] - rn.from[2])), false, Math.floor(rn.from[0]));
      }
      if (this.drop) crateParts(P, this.drop.x, this.drop.y, this.drop.z, false, false, this.t);
      if (this.raid && this.raid.phase === 'waiting') {
        const sp = this.teamSpot(this.raid), H = this.heli.pos;
        this.raid.alive().forEach((m, i) => {
          const x = sp[0] + (i % 3) * 0.9 - 0.9, y = sp[1], z = sp[2] + Math.floor(i / 3) * 0.9;
          const yaw = Math.atan2(-(x - this.raid.b.x), -(z - this.raid.b.z)) + Math.PI + Math.sin(this.t * 0.7 + i) * 0.8;
          soldier(x, y, z, yaw, m);
        });
        // a smoke flare so you can find them
        P([sp[0] + 2, sp[1] + 0.3, sp[2] + 2], [0, 0, 0], [0.4, 0.4, 0.4], [1, 0.3, 0.2], { em: 1, shape: 'sphere' });
        P([sp[0] + 2, sp[1] + 40, sp[2] + 2], [0, 0, 0], [1.5, 80, 1.5], [1, 0.35, 0.25], { em: 1, shape: 'cylY', alpha: 0.14 });
        void H;
      }
      if (this.mode !== 'down' && this.heli.rpm > 0.5) {
        // the searchlight under the nose, pointing where the gun points
        const { o, d } = this.bore(), L = 40, c = o.map((v, i) => v + d[i] * (L / 2 + 0.5));
        const ang = [Math.asin(clamp(d[1], -1, 1)), Math.atan2(-d[0], -d[2]), 0];
        P(c, ang, [3.2, 3.2, L], [1, 0.93, 0.75], { em: 1, shape: 'cyl', alpha: 0.05 });
        P(c, ang, [1.4, 1.4, L], [1, 0.95, 0.8], { em: 1, shape: 'cyl', alpha: 0.05 });
        P(this.heli.toWorld([0, -0.7, -3.75]), ang, [0.35, 0.35, 0.1], [1, 0.95, 0.8], { em: 1, shape: 'cyl' });
      }
      if (this.boarding && this.atRoof) {
        // a rope ladder down from the door
        const top = this.heli.toWorld([1.3, -1.2, 0.7]), bot = [top[0], this.atRoof.roof.top, top[2]], l = top[1] - bot[1];
        if (l > 0.5) {
          for (const dx of [-0.25, 0.25]) P([top[0] + dx, bot[1] + l / 2, top[2]], [0, 0, 0], [0.04, l, 0.04], [0.55, 0.45, 0.3], {});
          for (let y = 0.4; y < l; y += 0.45) P([top[0], bot[1] + y, top[2]], [0, 0, 0], [0.55, 0.05, 0.06], [0.45, 0.35, 0.22], {});
        }
      }
      for (const f of this.fobs) for (const tu of f.turrets) {
        if (f.locked) continue;
        if (Math.abs(tu.pos[0] - this.heli.pos[0]) > 500 || Math.abs(tu.pos[2] - this.heli.pos[2]) > 500) continue;
        P(tu.pos, [0, tu.yaw, 0], [1.1, 0.8, 1.4], [0.25, 0.28, 0.22], { shape: 0.08, mat: 'metal' });
        P([tu.pos[0] - Math.sin(tu.yaw) * 1.2, tu.pos[1] + 0.1, tu.pos[2] - Math.cos(tu.yaw) * 1.2], [0, tu.yaw, 0], [0.16, 0.16, 1.6], [0.12, 0.12, 0.13], { shape: 'cyl', mat: 'metal' });
        if (tu.flash > 0) P([tu.pos[0] - Math.sin(tu.yaw) * 2.1, tu.pos[1] + 0.1, tu.pos[2] - Math.cos(tu.yaw) * 2.1], [0, 0, 0], [0.4, 0.4, 0.4], [1, 0.8, 0.4], { em: 1, shape: 'sphere', alpha: 0.8 });
      }
      for (const s of this.shots || []) {
        const v = norm(s.vel), ang = [Math.asin(clamp(v[1], -1, 1)), Math.atan2(-s.vel[0], -s.vel[2]), 0];
        if (s.kind === 'rocket') { P(s.pos, ang, [0.2, 0.2, 1.1], [0.85, 0.85, 0.8], { shape: 'cyl' }); P(s.pos.map((c, i) => c - v[i] * 0.7), [0, 0, 0], [0.5, 0.5, 0.5], [1, 0.75, 0.3], { em: 1, shape: 'sphere', alpha: 0.9 }); }
        else if (s.kind === 'grenade') P(s.pos, ang, [0.12, 0.12, 0.2], [0.3, 0.33, 0.22], { shape: 'sphere' });
        else if (s.kind === 'bomb' || s.kind === 'bomblet') P(s.pos, ang, s.kind === 'bomb' ? [0.4, 0.4, 0.95] : [0.25, 0.25, 0.4], [0.3, 0.32, 0.25], { shape: 'sphere' });
        else if (s.kind === 'plasma') P(s.pos, ang, s.cannon ? [0.18, 0.18, 2.4] : [0.35, 0.35, 1.6], s.cannon ? [1, 0.75, 0.35] : [0.5, 0.95, 1], { em: 1, shape: 'sphere', alpha: 0.9 });
      else if (s.kind === 'beacon') { P(s.pos, [this.t * 4, 0, 0], [0.45, 0.6, 0.45], [0.95, 0.5, 0.1], { shape: 'cylY', mat: 'paint' }); }
      else if (s.kind === 'flare') { P(s.pos, [0, 0, 0], [0.35, 0.35, 0.35], [1, 0.95, 0.7], { em: 1, shape: 'sphere' }); P(s.pos, [0, 0, 0], [1.6, 1.6, 1.6], [1, 0.7, 0.3], { em: 1, shape: 'sphere', alpha: 0.25 }); }
      }
      for (const d of this.drones || []) {
        const yaw = d.aim ? Math.atan2(-(d.aim[0] - d.pos[0]), -(d.aim[2] - d.pos[2])) : this.heli.heading;
        droneParts(P, d.pos, yaw, this.t, this.S.drones >= 2, true, d.flash || 0);
      }
      for (const b of this.beacons || []) {
        const [x, y, z] = b.pos, on = (b.t * 1.7) % 1 < 0.5;
        P([x, y + 0.35, z], [0, 0, 0], [0.7, 0.7, 0.7], [0.95, 0.5, 0.1], { shape: 0.12, mat: 'paint' });
        P([x, y + 0.36, z - 0.36], [0, 0, 0], [0.5, 0.5, 0.03], [0.06, 0.06, 0.06], {});
        P([x, y + 0.95, z], [0, 0, 0], [0.04, 0.6, 0.04], [0.1, 0.1, 0.1], {});
        P([x, y + 1.3, z], [0, 0, 0], [0.16, 0.16, 0.16], b.boom ? [1, 0.15, 0.08] : [1, 0.75, 0.1], { em: on ? 1 : 0.15, shape: 'sphere' });
        if (on) P([x, y + 1.3, z], [0, 0, 0], [1.2, 1.2, 1.2], b.boom ? [1, 0.2, 0.1] : [1, 0.7, 0.2], { em: 1, shape: 'sphere', alpha: 0.18 });
      }
    }
    this.parkedParts(out);
    this.wingParts(out);
    this.dustoffParts(out);
    for (const q of this.prints || []) P([q[0], q[1], q[2]], [0, q[3], 0], [q[4] * 0.28, 0.06, q[4] * 0.5], [0.1, 0.085, 0.07], { shape: 'sphere' });
    for (const b of this.blasts || []) {
      const k = b.t / 0.5;
      if (b.ring) { const s = (3 + k * 16) * b.size; P(b.pos, [0, 0, 0], [s, 0.15, s], [1, 0.85, 0.6], { em: 1, shape: 'cylY', alpha: (1 - k) * 0.35 }); continue; }
      const s = (2 + k * 6) * b.size;
      P(b.pos, [0, 0, 0], [s, s, s], b.col || [1, 0.65, 0.25], { em: 1, shape: 'sphere', alpha: (1 - k) * 0.6 });
      if (!b.col) P(b.pos, [0, 0, 0], [s * 0.55, s * 0.55, s * 0.55], [1, 0.95, 0.7], { em: 1, shape: 'sphere', alpha: (1 - k) * 0.9 });
    }
    for (const b of this.beams || []) {
      const v = [b.to[0] - b.from[0], b.to[1] - b.from[1], b.to[2] - b.from[2]], l = Math.hypot(...v), d = v.map((c) => c / (l || 1));
      const c = b.from.map((q, i) => q + v[i] / 2), ang = [Math.asin(clamp(d[1], -1, 1)), Math.atan2(-d[0], -d[2]), 0], k = b.t / b.life;
      P(c, ang, [b.w * 2.6, b.w * 2.6, l], b.col, { em: 1, shape: 'cyl', alpha: 0.35 * k });
      P(c, ang, [b.w, b.w, l], [1, 1, 1], { em: 1, shape: 'cyl', alpha: 0.9 * k });
    }
    for (const t of this.tracers || []) {
      const l = Math.min(18, t.len - t.d);
      if (l <= 0) continue;
      const c = t.from.map((v, i) => v + t.dir[i] * (t.d + l / 2));
      const ang = [Math.asin(clamp(t.dir[1], -1, 1)), Math.atan2(-t.dir[0], -t.dir[2]), 0];
      P(c, ang, [0.11, 0.11, l], [1, 0.85, 0.5], { em: 1, alpha: 0.95, shape: 'cyl' });
      P(c, ang, [0.32, 0.32, l * 0.8], [1, 0.6, 0.2], { em: 1, alpha: 0.25, shape: 'cyl' });
    }
    return out;
  }

  // your other helicopters, parked at the Spire: in the hangar, in the bay, and on the spare pads
  parkedParts(out) {
    const sp = this.map && this.map.spire, e = this.eye;
    if (!sp || !sp.parking || !e || this.mode === 'hangar' || Math.hypot(e[0] - sp.padAt[0], e[2] - sp.padAt[2]) > 800) return;
    const s = this.save, flying = this.client ? null : s.heli;
    const wings = !!((this.coop && [...this.coop.friends.values()].some((f) => f.pilot)) || (this.client && this.client.wing));
    const spots = sp.parking.filter((p) => !(wings && p.pad));
    const list = HELI_IDS.filter((k) => s.helis.includes(k) && k !== flying && !(HELIS[k].plane && !HELIS[k].vtol)).slice(0, spots.length);
    const key = `${list.join(',')}|${spots.length}|${JSON.stringify(s.eq)}|${s.paint}|${s.camo}|${s.nose}|${s.tailArt}`;
    if (!this.parkC || this.parkC.key !== key) {
      const parts = [];
      list.forEach((k, i) => {
        const p = spots[i], H = mat4(), q = [0, Math.sin(p.yaw / 2), 0, Math.cos(p.yaw / 2)];
        qmat(H, q, [p.pos[0], p.pos[1] + 1.93, p.pos[2]]);
        const S2 = statsFor(s.eq, k);
        try { parts.push(...chopperParts(capEq(s.eq, k), paintFor(s), { rotorA: 0.4 + i, tailA: 0, rpm: 0, spin: 0, t: 0, riders: 0, crew: [], rockets: S2.rockets, rocketMax: S2.rockets, bombs: S2.bombs, bombMax: S2.bombs }, H, k)); } catch (err) { console.error(err); }
      });
      this.parkC = { key, parts };
    }
    for (const p of this.parkC.parts) out.push(p);
  }
  // friends flying their own helicopters (see the online section)
  wingParts(out) {
    const cl = this.client;
    if (cl && cl.wing && cl.heli && cl.hs && cl.hs.m === 'f') {
      try {
        const H = cl.heli, hs = cl.hs;
        const st = { rotorA: H.rotorA, tailA: H.tailA, rpm: H.rpm, vs: Math.hypot(H.vel[0], H.vel[2]), tk: H.stats && H.stats.vtol ? H.tiltK : null, spin: hs.sp || 0, t: this.t, riders: hs.rd || 0, crew: (hs.cr || []).map((r) => ({ col: (ROLES[ROLE_IDS[r]] || ROLES.rifleman).col })), boost: H.boost,
          doorAim: [0, 1].map((sd) => (hs.da && hs.da[sd]) || [sd === 0 ? -1.57 : 1.57, -0.3]), doorFlash: [0, 1].map((sd) => (hs.df ? hs.df[sd] * 0.05 : 0)), flash: hs.fl ? 0.04 : 0,
          rockets: hs.rk || 0, rocketMax: statsFor(cl.eq, cl.hk).rockets, bombs: hs.bm || 0, bombMax: statsFor(cl.eq, cl.hk).bombs };
        for (const p of chopperParts(capEq(cl.eq, cl.hk), cl.dc ? { ...(PAINT[cl.paint] || PAINT.olive), ...cl.dc, camo: (CAMO[cl.dc.camo] || {}).k || 0 } : PAINT[cl.paint] || PAINT.olive, st, H.H, cl.hk)) out.push(p);
      } catch (err) { console.error(err); }
    }
    const list = this.coop ? [...this.coop.friends.values()].filter((f) => f.pilot && f.wh) : this.client && this.client.wings ? this.client.wings.filter((w) => w.id !== this.client.myId && w.h) : [];
    for (const f of list) {
      const w = f.wh || f.h;
      if (!w || w.dead) continue;
      try {
        const st = { rotorA: w.rotorA, tailA: w.tailA, rpm: w.rpm, vs: w.vs || 0, spin: 0, t: this.t, riders: w.rd || 0, crew: [], rockets: 4, rocketMax: 4, bombs: 2, bombMax: 2, flash: w.fire ? 0.04 : 0, doorAim: [[-1.57, -0.3], [1.57, -0.3]], doorFlash: [0, 0] };
        for (const p of chopperParts(capEq(w.eq || {}, w.kind), w.paint || PAINT.olive, st, w.H, w.kind)) out.push(p);
      } catch (err) { console.error(err); }
    }
  }

  project(p) {
    const m = this.vp, x = p[0], y = p[1], z = p[2];
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    return { x: (cx / cw * 0.5 + 0.5) * innerWidth, y: (1 - (cy / cw * 0.5 + 0.5)) * innerHeight, behind: cw < 0.1 };
  }

  markers(list, from, extra = []) {
    const out = [], placed = [];
    // nearest first; a loot sign that would sit on top of another marker is left out, and far ones are just an icon
    const sorted = list.filter(Boolean).map((mk) => [mk, Math.hypot(mk.p[0] - from[0], mk.p[2] - from[2]) + (mk.loot ? 2000 : 0)]).sort((a, b) => a[1] - b[1]).map((e) => e[0]);
    for (const mk of sorted) {
      const q = this.project(mk.p), W = innerWidth, Hh = innerHeight;
      let x = q.x, y = q.y, off = false;
      if (q.behind) { x = W - x; y = Hh - 40; off = true; }
      if (x < 40 || x > W - 40 || y < 70 || y > Hh - 40) off = true;
      if (off) continue;          // off screen: the list and the map show where it is
      const d = Math.round(Math.hypot(mk.p[0] - from[0], mk.p[2] - from[2]));
      if (mk.loot && placed.some(([px, py]) => Math.abs(px - x) < 120 && Math.abs(py - y) < 34)) continue;
      placed.push([x, y]);
      if (mk.loot && d > 260) { out.push(`<div class="da-mark" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;--c:${mk.col}"><b>${mk.icon}</b></div>`); continue; }
      out.push(`<div class="da-mark${off ? ' off' : ''}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;--c:${mk.col}"><b>${mk.icon}</b>${mk.text} · ${d}M${mk.sub ? `<small>${mk.sub}</small>` : ''}</div>`);
    }
    this.$('marks').innerHTML = out.join('') + extra.join('');
  }
  eventsList(list, from) {
    // story jobs always stay on the list, then the nearest of the rest
    const all = list.filter(Boolean).map((mk) => ({ mk, d: Math.hypot(mk.p[0] - from[0], mk.p[2] - from[2]) })).sort((a, b) => (b.mk.story ? 2 : b.mk.friend ? 1 : 0) - (a.mk.story ? 2 : a.mk.friend ? 1 : 0) || a.d - b.d);
    const rows = all.slice(0, 7);
    const st = this.client ? this.client.story : this.story && this.story.lines();
    const top = st ? `<div class="da-story" style="--c:#ffd23a"><span><b>${st.title}</b>${st.goals.map((g) => `<em class="${g.have >= g.n ? 'ok' : ''}">${g.have >= g.n ? '✔' : '▸'} ${g.t}${g.n > 1 ? ` · ${g.have}/${g.n}` : ''}</em>`).join('')}</span></div>` : '';
    this.$('evs').innerHTML = top + rows.map(({ mk, d }) => `<div style="--c:${mk.col}"><i>${mk.icon}</i><span>${mk.text}${mk.sub ? `<em>${mk.sub}</em>` : ''}</span><small>${Math.round(d)}M</small></div>`).join('');
  }
  // the map picture: the land coloured by height, water, roads, the city and the towns. Made once per world.
  mapImage() {
    if (this.mapImg && this.mapImg.seed === this.map.seed) return this.mapImg;
    // a proper map: shaded hills, snow on the peaks, woods, water by depth (the rivers and bay we dug included), the
    // towns in grey with their streets, roads in cream with dark edges, bridges, names
    const G = this.map.ground, C = G.hC, W = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
    const c = cv.getContext('2d'), img = c.createImageData(W, W), Hs = G.heights, D = G.data, GS = G.size;
    const hAt = (u, v) => { u = clamp(u, 0, C - 1.001); v = clamp(v, 0, C - 1.001); const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, o = j * (C + 1) + i; return (Hs[o] * (1 - fu) + Hs[o + 1] * fu) * (1 - fv) + (Hs[o + C + 1] * (1 - fu) + Hs[o + C + 2] * fu) * fv; };
    const k = C / W, gk = GS / W;
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const u = i * k, v = j * k, h = hAt(u, v);
      const go = (Math.floor(j * gk) * GS + Math.floor(i * gk)) * 4, town = D[go + 1] / 255, wood = D[go + 2] / 255, wet = D[go + 3] / 255;
      // light from the north-west, two scales so both the big hills and the small bumps show
      const sh = clamp((hAt(u - 1, v - 1) - hAt(u + 1, v + 1)) * 0.035 + (hAt(u - 3, v - 3) - hAt(u + 3, v + 3)) * 0.01, -0.45, 0.45);
      let col;
      if (wet > 0.01 || h < WATER - 0.5) {
        const d = clamp(Math.max(wet * 32, WATER - h) / 14, 0, 1);
        col = [88 - d * 46, 138 - d * 52, 160 - d * 34];
      } else {
        const e = clamp((h - WATER) / 180, 0, 1);
        col = [124 + e * 50 - e * e * 40, 146 + e * 10 - e * e * 20, 84 + e * 40];
        col = col.map((x, n) => x * (1 - wood * 0.55) + [44, 74, 40][n] * wood * 0.55);
        if (h > 175) col = col.map((x) => x + (238 - x) * clamp((h - 175) / 40, 0, 1));
        col = col.map((x) => x * (1 + sh));
        if (town > 0.05) col = col.map((x, n) => x * (1 - town * 0.85) + [168, 162, 152][n] * town * 0.85);
        if (h < WATER + 1.5) col = col.map((x, n) => x * 0.6 + [190, 180, 140][n] * 0.4);                 // beaches
      }
      const o = (j * W + i) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    const sc = G.span / W, X = (x) => (x + G.span / 2) / sc;
    // street grids in the cities
    const grid = (x0, z0, x1, z1, gx, gz, pX, pZ, col) => {
      c.save(); c.beginPath(); c.rect(X(x0), X(z0), (x1 - x0) / sc, (z1 - z0) / sc); c.clip();
      c.fillStyle = 'rgb(150,144,136)'; c.fillRect(X(x0), X(z0), (x1 - x0) / sc, (z1 - z0) / sc);
      c.fillStyle = col;
      for (let x = gx; x < x1; x += pX) if (x > x0 - pX) c.fillRect(X(x), X(z0), Math.max(0.7, 14 / sc), (z1 - z0) / sc);
      for (let z = gz; z < z1; z += pZ) if (z > z0 - pZ) c.fillRect(X(x0), X(z), (x1 - x0) / sc, Math.max(0.6, 10 / sc));
      c.restore();
    };
    const CI = this.map.city, B = this.map.boro, g = this.map.grids;
    grid(CI.x - CI.iw, CI.z - CI.il, CI.x + CI.iw, CI.z + CI.il, g.a[0][0], g.a[0][1], g.a[0][2], g.a[0][3] * 3, 'rgb(96,92,90)');
    grid(B.x - B.rx, B.z - B.rz, B.x + B.rx, B.z + B.rz, g.a[1][0], g.a[1][1], g.a[1][2], g.a[1][3], 'rgb(96,92,90)');
    for (const s of this.map.cities) {
      if (s.kind !== 'small') continue;
      const gi = this.map.cities.filter((q) => q.kind === 'small').indexOf(s) + 2, G2 = g.a[gi];
      if (!G2 || G2[2] < 2) continue;
      c.save(); c.beginPath(); c.arc(X(s.x), X(s.z), 235 / sc, 0, 6.3); c.clip();
      c.fillStyle = 'rgba(96,92,90,.8)';
      for (let x = G2[0]; x < s.x + 300; x += G2[2]) if (x > s.x - 320) c.fillRect(X(x), X(s.z - 300), Math.max(0.7, 18 / sc), 600 / sc);
      for (let z = G2[1]; z < s.z + 300; z += G2[3]) if (z > s.z - 320) c.fillRect(X(s.x - 300), X(z), 600 / sc, Math.max(0.6, 12 / sc));
      c.restore();
    }
    // the park
    if (CI.park) { c.fillStyle = 'rgb(96,140,74)'; c.fillRect(X(CI.park[0]), X(CI.park[1]), (CI.park[2] - CI.park[0]) / sc, (CI.park[3] - CI.park[1]) / sc); }
    // roads: a dark casing then cream
    for (const [w, st] of [[3.2, 'rgba(60,50,40,.55)'], [1.7, 'rgb(240,226,186)']]) {
      c.strokeStyle = st; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      for (const r of this.map.roads) { c.moveTo(X(r[0]), X(r[1])); c.lineTo(X(r[2]), X(r[3])); }
      c.stroke();
    }
    c.strokeStyle = 'rgb(225,225,220)'; c.lineWidth = 3;
    for (const b of this.map.bridges || []) { c.beginPath(); c.moveTo(X(b.xa), X(b.z)); c.lineTo(X(b.xb), X(b.z)); c.stroke(); }
    for (const t of this.map.towns) {
      const r = t.kind === 'town' ? 5 : 3.2;
      c.fillStyle = 'rgb(120,104,92)'; c.strokeStyle = 'rgba(40,30,24,.7)'; c.lineWidth = 1;
      c.beginPath(); c.arc(X(t.x), X(t.z), r, 0, 6.3); c.fill(); c.stroke();
    }
    this.mapImg = cv; cv.seed = this.map.seed;
    return cv;
  }
  // the minimap: centred on you, north up, about 2.4 km across. M opens the whole map.
  minimap(pos, heading, list, zombies) {
    // the minimap doesn't need redrawing every frame: 20 times a second is plenty
    if ((this.mmT = (this.mmT || 0) + 1) % 3) return;
    const big = this.bigMap, cv = this.$(big ? 'bigmap' : 'map'), c = cv.getContext('2d'), W = cv.width;
    const G = this.map.ground, span = big ? G.span : 2400, sc = W / span;
    const ox = big ? -G.span / 2 : pos[0] - span / 2, oz = big ? -G.span / 2 : pos[2] - span / 2;
    const X = (x) => (x - ox) * sc, Z = (z) => (z - oz) * sc;
    const img = this.mapImage(), isc = img.width / G.span;
    c.fillStyle = '#1b2228'; c.fillRect(0, 0, W, W);
    c.drawImage(img, (ox + G.span / 2) * isc, (oz + G.span / 2) * isc, span * isc, span * isc, 0, 0, W, W);
    if (!big) {
      c.fillStyle = 'rgba(255,90,58,.85)'; for (const z of zombies) if (z.alive) c.fillRect(X(z.x) - 0.8, Z(z.z) - 0.8, 1.6, 1.6);
      if (this.S && this.S.drones) { c.fillStyle = '#ffd23a'; for (const z of zombies) if (z.alive && (z.type === 'brute' || z.type === 'bloater' || z.type === 'screamer')) c.fillRect(X(z.x) - 1.6, Z(z.z) - 1.6, 3.2, 3.2); }
    }
    if (big) {
      c.textAlign = 'center'; c.lineJoin = 'round';
      const label = (t, x, y, size, col) => { c.font = `800 ${size}px 'Barlow Condensed', sans-serif`; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.65)'; c.strokeText(t, x, y); c.fillStyle = col; c.fillText(t, x, y); };
      for (const s of this.map.cities) label(s.kind === 'city' ? 'THE CITY' : s.kind === 'borough' ? 'THE BOROUGH' : s.name || 'CITY', X(s.x), Z(s.z) + (s.kind === 'small' ? 4 : 0), s.kind === 'city' ? 16 : 13, '#fff');
      for (const t of this.map.towns) label(t.name, X(t.x), Z(t.z) - 7, t.kind === 'town' ? 11 : 9.5, t.kind === 'town' ? '#ffe9b0' : 'rgba(255,255,255,.8)');
      const M = this.map;
      if (M.fort) label(`★ FORT CALDER${M.fort.locked ? '' : ' (OURS)'}`, X(M.fort.x), Z(M.fort.z), 12, M.fort.locked ? '#ff9a6a' : '#c8ff5a');
      if (M.airfield) label('✈ AIRFIELD', X(M.airfield.x), Z(M.airfield.z), 12, '#5ab4ff');
      if (M.hospital) label("✚ ST MARY'S", X(M.hospital.x), Z(M.hospital.z), 11, '#ff9ac0');
      for (const m of M.masts || []) label(`${m.on ? '◉' : '○'} ${m.name}`, X(m.x), Z(m.z), 10, m.on ? '#7dff9a' : '#ffd23a');
      const seen = this.save.sites || {};
      if (M.lab) label('☣ HALDEN BIOLAB', X(M.lab.x), Z(M.lab.z), 12, '#ffd23a');
      for (const k of ['goliath', 'spitter', 'mother']) { const L = (M.lairs || {})[k]; if (L) label(seen[k] ? `☠ ${L.name}` : '☠ ? ? ?', X(L.x), Z(L.z), 11, seen[k] ? '#ff6a4a' : 'rgba(255,120,90,.7)'); }
      // north arrow and a 1 km bar
      c.save(); c.translate(W - 30, 34); c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(0, 0, 18, 0, 6.3); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -13); c.lineTo(6, 6); c.lineTo(0, 2); c.lineTo(-6, 6); c.closePath(); c.fill(); label('N', 0, 16, 10, '#fff'); c.restore();
      const km = 1000 * sc; c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(14, W - 30, km + 12, 18); c.fillStyle = '#fff'; c.fillRect(20, W - 18, km, 3); label('1 KM', 20 + km / 2, W - 21, 10, '#fff');
    }
    for (const mk of list) {
      if (!mk) continue;
      const x = X(mk.p[0]), y = Z(mk.p[2]);
      if (x < -6 || y < -6 || x > W + 6 || y > W + 6) continue;
      c.fillStyle = mk.col;
      if (mk.loot) { c.fillRect(x - 1.8, y - 1.8, 3.6, 3.6); continue; }
      if (mk.horde) { c.globalAlpha = 0.45; c.beginPath(); c.arc(x, y, Math.max(5, mk.r * sc * 1.4), 0, 6.3); c.fill(); c.globalAlpha = 1; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('☠', x, y + 4); continue; }
      c.beginPath(); c.arc(x, y, mk.fob ? 6 : 4.5, 0, 6.3); c.fill();
      if (mk.fob) { c.fillStyle = '#111'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('H', x, y + 3); }
    }
    // the Spire off the edge: an arrow pointing home
    const sp = this.map.spire;
    if (!big && sp) {
      const x = X(sp.padAt[0]), y = Z(sp.padAt[2]);
      if (x < 0 || y < 0 || x > W || y > W) {
        const a = Math.atan2(y - W / 2, x - W / 2), ex = W / 2 + Math.cos(a) * (W / 2 - 10), ey = W / 2 + Math.sin(a) * (W / 2 - 10);
        c.save(); c.translate(ex, ey); c.rotate(a); c.fillStyle = '#5ab4ff'; c.beginPath(); c.moveTo(8, 0); c.lineTo(-5, -6); c.lineTo(-5, 6); c.closePath(); c.fill(); c.restore();
      }
    }
    c.save(); c.translate(X(pos[0]), Z(pos[2])); c.rotate(-heading);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
  }

  // the raid tracker: a slice through the building, where the team is, how they're doing, and what to tell them
  raidPanel() {
    const box = this.$('raid'), rd = this.raid;
    box.classList.toggle('hidden', !rd);
    if (!rd) { this.raidSig = ''; return; }
    this.raidUpT = (this.raidUpT || 0) - 1 / 60;
    if (this.raidUpT > 0) return;
    this.raidUpT = 0.2;
    const b = rd.b, L = LOOT_TYPES[b.loot], H = this.heli.pos, d = Math.round(Math.hypot(b.x - H[0], b.z - H[2]));
    const ph = { enter: 'GOING IN…', fight: 'FIGHTING', search: 'SEARCHING', travel: rd.dir < 0 ? 'GOING DOWN' : 'GOING UP', exit: `HEADING FOR THE ${rd.meet === 'roof' ? 'ROOF' : 'STREET'}`, waiting: `WAITING ON THE ${rd.meet === 'roof' ? 'ROOF' : 'STREET'} · COME GET THEM` }[rd.phase];
    const fl = rd.floors.map((f, i) => `<div class="${i === rd.at && rd.phase !== 'waiting' ? 'here' : f.done ? 'done' : f.z > 0 && (this.S.flir === 2 || f.seen) ? 'hot' : ''}"></div>`).join('');
    const live = rd.alive();
    const mem = rd.team.map((m) => `<div class="da-mem"><span style="color:${m.hp > 0 ? `rgb(${ROLES[m.role].col.map((v) => Math.round(v * 255))})` : '#777'}">${m.hp > 0 ? m.name : `<s>${m.name}</s>`}</span><i><b style="width:${Math.round((m.hp / m.max) * 100)}%;${m.hp < 40 ? 'background:#ff5a3a' : ''}"></b></i></div>`).join('');
    const loot = rd.loot, got = [loot.scrap && `⚙${loot.scrap}`, loot.fuel && `⛽${loot.fuel}`, loot.medkit && `✚${loot.medkit}`, loot.survivor && `☺${loot.survivor}`, (loot.weapon.length + loot.armor.length) && `🔫${loot.weapon.length + loot.armor.length}`].filter(Boolean).join(' ');
    const can = rd.phase !== 'waiting';
    const html = `<h5>${L.n} · ${d}M</h5>
      <div style="display:flex;gap:8px"><div class="da-floors" style="flex:0 0 46px">${fl}</div><div style="flex:1">FLOOR ${rd.at + 1} / ${rd.floors.length}<br><b style="color:#ffcf3a">${ph}</b><br>${live.length} OF ${rd.team.length} OK<br>${got || 'NOTHING FOUND YET'}</div></div>
      ${mem}<div class="log">${rd.log.slice(0, 3).join('<br>')}</div>
      <div class="row2"><button data-r="roof" class="${rd.meet === 'roof' ? 'on' : ''}" ${can ? '' : 'disabled'}>MEET ROOF [Y]</button><button data-r="street" class="${rd.meet === 'street' ? 'on' : ''}" ${can ? '' : 'disabled'}>MEET STREET [U]</button></div>
      <div class="row2"><button data-r="out" ${can && rd.phase !== 'exit' ? '' : 'disabled'}>PULL OUT NOW [K]</button></div>`;
    if (html !== this.raidSig) { this.raidSig = html; box.innerHTML = html; }
  }
  raidCmd(c) {
    const rd = this.raid; if (!rd) return;
    if (c === 'roof' || c === 'street') rd.setMeet(c); else if (c === 'out') rd.recall();
    this.raidUpT = 0; this.snd.radio?.();
  }

  // the cockpit: canopy frame, dashboard and dials, drawn on a canvas over the 3D view
  cockpit() {
    const cv = this.$('pit'), on = this.camMode === 3 && (this.mode === 'fly' || this.mode === 'wing') && !this.heli.dead;
    cv.classList.toggle('hidden', !on);
    if (!on) return;
    const W = this.r.cssSize ? this.r.cssSize[0] : innerWidth, Hh = this.r.cssSize ? this.r.cssSize[1] : innerHeight;
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    const c = cv.getContext('2d'), H = this.heli, S = this.S, id = this.save.heli, plane = this.engineKind(id, H) !== 'heli';
    c.clearRect(0, 0, W, Hh);
    const u = Math.min(W, Hh * 1.6) / 1000;
    // canopy frame
    c.fillStyle = '#15181b'; c.strokeStyle = '#0b0d0f'; c.lineWidth = 2;
    const post = (x0, x1, top) => { c.beginPath(); c.moveTo(x0, Hh); c.lineTo(x0 + 40 * u, Hh); c.lineTo(x1 + 18 * u, top); c.lineTo(x1 - 18 * u, top); c.closePath(); c.fill(); c.stroke(); };
    if (plane) {
      c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, 30 * u); c.quadraticCurveTo(W / 2, 80 * u, 0, 30 * u); c.closePath(); c.fill();
      post(W * 0.06, W * 0.2, 0); post(W * 0.94 - 40 * u, W * 0.8, 0);
    } else {
      c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, 60 * u); c.lineTo(0, 60 * u); c.closePath(); c.fill();
      post(W * 0.02, W * 0.12, 60 * u); post(W * 0.98 - 40 * u, W * 0.88, 60 * u);
      post(W * 0.5 - 20 * u, W * 0.5, 60 * u);
    }
    // the dash
    const dh = 230 * u, dy = Hh - dh;
    const g = c.createLinearGradient(0, dy, 0, Hh); g.addColorStop(0, '#2a2f33'); g.addColorStop(1, '#111416');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, Hh); c.lineTo(0, dy + 40 * u); c.quadraticCurveTo(W / 2, dy - 40 * u, W, dy + 40 * u); c.lineTo(W, Hh); c.closePath(); c.fill();
    c.strokeStyle = '#444b51'; c.lineWidth = 3 * u; c.stroke();
    const sp = Math.hypot(...H.vel) * 3.6, alt = Math.min(9999, this.agl || 0), vs = H.vel[1], fuel = this.fuel / S.fuel, hp = this.hp / S.hp;
    const R = 56 * u, cy = dy + dh * 0.52, xs = [-2.65, -1.6, -0.55, 0.55, 1.6, 2.65].map((k) => W / 2 + k * R * 2.2);
    const dial = (x, label, v, max, warn, txt) => {
      c.fillStyle = '#060708'; c.beginPath(); c.arc(x, cy, R, 0, 7); c.fill();
      c.strokeStyle = '#5b636a'; c.lineWidth = 3 * u; c.stroke();
      c.strokeStyle = '#cfd6dc'; c.lineWidth = 1.5 * u;
      for (let k = 0; k <= 10; k++) { const a = Math.PI * 0.75 + (k / 10) * Math.PI * 1.5; c.beginPath(); c.moveTo(x + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8); c.lineTo(x + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93); c.stroke(); }
      const a = Math.PI * 0.75 + clamp(v / max, 0, 1) * Math.PI * 1.5;
      c.strokeStyle = warn ? '#ff4a3a' : '#ffcf3a'; c.lineWidth = 3.5 * u;
      c.beginPath(); c.moveTo(x, cy); c.lineTo(x + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78); c.stroke();
      c.fillStyle = '#9aa4ab'; c.font = `800 ${11 * u}px sans-serif`; c.textAlign = 'center'; c.fillText(label, x, cy + R * 0.45);
      c.fillStyle = warn ? '#ff6a5a' : '#fff'; c.font = `900 ${15 * u}px sans-serif`; c.fillText(txt, x, cy + R * 0.75);
    };
    dial(xs[0], 'KM/H', sp, plane ? 500 : 300, plane && S.stall && Math.hypot(...H.vel) < S.stall * 1.1 && (this.agl || 0) > 3, Math.round(sp));
    dial(xs[1], 'ALT M', alt, 400, alt < 15 && vs < -4, Math.round(alt));
    // artificial horizon
    { const x = xs[2], r = R * 1.15;
      c.save(); c.beginPath(); c.arc(x, cy, r, 0, 7); c.clip();
      c.translate(x, cy); c.rotate(-H.rollL); const py = clamp(H.pitch, -1.2, 1.2) * r * 1.1;
      c.fillStyle = '#3d8be0'; c.fillRect(-r * 2, -r * 2 + py, r * 4, r * 2);
      c.fillStyle = '#7a5530'; c.fillRect(-r * 2, py, r * 4, r * 2);
      c.strokeStyle = '#fff'; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(-r * 2, py); c.lineTo(r * 2, py); c.stroke();
      for (const k of [-2, -1, 1, 2]) { const yy = py - k * r * 0.25; c.beginPath(); c.moveTo(-r * 0.2, yy); c.lineTo(r * 0.2, yy); c.stroke(); }
      c.restore();
      c.strokeStyle = '#5b636a'; c.lineWidth = 3 * u; c.beginPath(); c.arc(x, cy, r, 0, 7); c.stroke();
      c.strokeStyle = '#ffcf3a'; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(x - r * 0.55, cy); c.lineTo(x - r * 0.15, cy); c.lineTo(x, cy + r * 0.1); c.lineTo(x + r * 0.15, cy); c.lineTo(x + r * 0.55, cy); c.stroke(); }
    // compass
    { const x = xs[3];
      c.fillStyle = '#060708'; c.beginPath(); c.arc(x, cy, R, 0, 7); c.fill(); c.strokeStyle = '#5b636a'; c.lineWidth = 3 * u; c.stroke();
      const hdg = H.heading;
      c.fillStyle = '#fff'; c.font = `900 ${13 * u}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      ['N', 'E', 'S', 'W'].forEach((n, k) => { const a = hdg + k * Math.PI / 2 - Math.PI / 2; c.fillStyle = n === 'N' ? '#ff6a5a' : '#fff'; c.fillText(n, x + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72); });
      c.textBaseline = 'alphabetic';
      c.strokeStyle = '#ffcf3a'; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(x, cy + R * 0.3); c.lineTo(x, cy - R * 0.45); c.stroke(); }
    dial(xs[4], 'FUEL', fuel, 1, fuel < 0.2, `${Math.round(fuel * 100)}%`);
    dial(xs[5], plane ? 'THROTTLE' : 'ROTOR', plane ? H.thr ?? 0 : H.rpm, 1, false, `${Math.round((plane ? H.thr ?? 0 : H.rpm) * 100)}%`);
    // warning lights
    const lights = [['HULL', hp < 0.3], ['FUEL', fuel < 0.15], [plane ? 'STALL' : 'LOW', plane ? (S.stall && Math.hypot(...H.vel) < S.stall && (this.agl || 0) > 3) : alt < 6 && vs < -6], ['HOT', this.overT > 0]];
    lights.forEach(([n, lit], k) => {
      const x = W / 2 + (k - 1.5) * 74 * u, y = dy + 18 * u;
      c.fillStyle = lit && (this.t * 3) % 1 < 0.6 ? '#ff3a2a' : '#2a1412'; c.fillRect(x - 32 * u, y - 10 * u, 64 * u, 20 * u);
      c.fillStyle = lit ? '#fff' : '#6a4a46'; c.font = `900 ${11 * u}px sans-serif`; c.textAlign = 'center'; c.fillText(n, x, y + 4 * u);
    });
  }
  hud(dt) {
    if (!this.run || this.mode === 'hangar') return;
    const H = this.heli, S = this.S, run = this.run;
    this.cockpit();
    this.tutTick();
    this.helpT = Math.max(0, (this.helpT || 0) - dt);
    this.$('help').style.opacity = this.helpT > 0 ? 1 : 0;
    this.$('help').style.visibility = this.helpT > 0 ? 'visible' : 'hidden';
    const aim = this.aimPoint();
    const c = this.project(aim.p), cr = this.$('cross');
    cr.style.left = `${c.x}px`; cr.style.top = `${c.y}px`; cr.style.display = c.behind || H.dead || this.mode === 'down' ? 'none' : '';
    cr.classList.toggle('hot', !!aim.z || !!aim.sh || this.overT > 0);
    const hm = this.$('hit'); hm.style.left = `${c.x}px`; hm.style.top = `${c.y}px`;
    this.hitT = Math.max(0, (this.hitT || 0) - dt); if (this.hitT <= 0) hm.style.opacity = 0;
    const list = this.client ? this.client.evs.map((e) => e.mk).filter(Boolean) : this.director.list.map((e) => e.marker(this));
    const sp = this.map.spire;
    if (this.map.fort && !this.map.fort.locked) list.push({ p: [this.map.fort.padAt[0], this.map.fort.padAt[1] + 6, this.map.fort.padAt[2]], col: '#c8ff5a', icon: 'H', text: 'FORT CALDER', sub: '', fob: true });
    list.push(...this.dustMarks());
    const af = this.map.airfield;
    if (af) list.push({ p: [af.x, af.y + 8, af.z], col: '#5ab4ff', icon: '✈', text: 'AIRFIELD', sub: S.plane && !S.vtol && this.fuel / S.fuel < 0.35 ? 'FUEL HERE' : '', fob: true });
    list.push({ p: [sp.padAt[0], sp.padAt[1] + 6, sp.padAt[2]], col: '#5ab4ff', icon: 'H', text: sp.name, sub: this.riders ? `DROP OFF ${this.riders}` : this.fuel / S.fuel < 0.35 ? 'FUEL HERE' : '', fob: true });
    // buildings your team can raid (the signs), and where the team is now
    const loots = [];
    for (const b of this.map.loot) {
      const d = Math.hypot(b.x - H.pos[0], b.z - H.pos[2]);
      if (this.raid && this.raid.b === b) continue;
      const L = LOOT_TYPES[b.loot];
      const mk = { p: [b.x, b.top + 3, b.z], col: b.cleared ? '#777' : `rgb(${L.col.map((v) => Math.round(v * 255))})`, icon: b.cleared ? '✓' : '⌂', text: b.cleared ? 'RAIDED' : L.n, sub: b.cleared ? '' : `${b.floors} FLOORS${S.flir === 2 && b.floorsData ? ` · ${b.floorsData.reduce((a, f) => a + (f.done ? 0 : f.z), 0)} INSIDE` : ''}`, loot: true, d };
      loots.push(mk);
    }
    if (this.raid) {
      const rd = this.raid, b = rd.b, w = rd.phase === 'waiting', y = w && rd.meet === 'street' ? b.base + 3 : w ? b.top + 4 : b.base + (rd.at + 0.5) * (b.top - b.base) / rd.floors.length;
      list.push({ p: [b.x, y, b.z], col: '#ffcf3a', icon: rd.alive().length, text: w ? `YOUR TEAM · ${rd.meet === 'roof' ? 'ON THE ROOF' : 'ON THE STREET'}` : `YOUR TEAM · FLOOR ${rd.at + 1}`, sub: w ? 'LAND AND PRESS E' : '', team: true });
    }
    const extra = [];
    if (S.flir === 2) {
      const R2 = 220;
      const specials = this.horde.list.filter((z) => z.alive && (z.type === 'screamer' || z.st === 'pile') && Math.abs(z.x - H.pos[0]) < R2 && Math.abs(z.z - H.pos[2]) < R2)
        .sort((a, b) => Math.hypot(a.x - H.pos[0], a.z - H.pos[2]) - Math.hypot(b.x - H.pos[0], b.z - H.pos[2])).slice(0, 6);
      for (const z of specials) {
        const q = this.project([z.x, z.y + z.s * 2.2, z.z]);
        if (!q.behind) extra.push(`<div class="da-spec" style="left:${q.x.toFixed(0)}px;top:${q.y.toFixed(0)}px">▼ ${z.type === 'screamer' ? 'SCREAMER' : 'PILE'}</div>`);
      }
    }
    const nearLoot = loots.filter((m) => m.d < (m.text === 'RAIDED' ? 160 : 420)).sort((a, b) => a.d - b.d).slice(0, 8);
    const fm = this.friendMarks();
    list.push(...fm);
    this.markers([...list.filter((m) => !m.fob || Math.hypot(m.p[0] - H.pos[0], m.p[2] - H.pos[2]) < 900), ...nearLoot], H.pos, extra);
    this.eventsList(list.filter((m) => !m.fob), H.pos);
    const zr = Math.max([150, 450, 600][S.flir || 0], S.drones ? 650 : 0, S.tpod === 2 ? 900 : 0);
    this.minimap(H.pos, H.heading, [...list, ...loots.filter((m) => m.text !== 'RAIDED')], this.horde.list.filter((z) => Math.abs(z.x - H.pos[0]) < zr && Math.abs(z.z - H.pos[2]) < zr));
    this.bossBar(this.bossNear(H.pos));
    this.raidPanel();
    const setM = (id, p, hot) => { const m = this.$(id); m.style.setProperty('--p', clamp(p, 0, 1).toFixed(3)); m.classList.toggle('hot', !!hot); };
    setM('fuelm', this.fuel / S.fuel, this.fuel / S.fuel < 0.2);
    this.$('fueltxt').textContent = this.fuel <= 0 ? 'EMPTY' : `${Math.round((this.fuel / S.fuel) * 100)}%`;
    setM('hpm', this.hp / S.hp, this.hp / S.hp < 0.3);
    this.$('shm').classList.toggle('hidden', !S.shield);
    if (S.shield) setM('shm', this.shield / S.shield, false);
    this.$('white').style.opacity = (this.whiteT || 0).toFixed(3);
    setM('heatm', this.heat, this.overT > 0);
    this.$('heatm').classList.remove('hidden');
    this.$('boostm').classList.toggle('hidden', !S.boost);
    if (S.boost) setM('boostm', H.boostT, false);
    this.$('alt').textContent = `ALT ${Math.round(this.agl ?? 0)}M · ${this.clock()}`;
    this.$('spd').textContent = `${Math.round(Math.hypot(...H.vel) * 3.6)} KM/H`;
    const team = this.save.team.filter((m) => m.aboard && !m.raid && m.hp > 0);
    const fr = this.coop ? this.coop.friends.size : 0;
    const Hp = this.heli, isPlane = S.plane && (!S.vtol || Hp.planeMode);
    const pv = Hp.vel[0] * Hp.fwd[0] + Hp.vel[1] * Hp.fwd[1] + Hp.vel[2] * Hp.fwd[2], stalled = isPlane && Hp.contacts < 2 && pv < S.stall * 0.95;
    const planeHud = isPlane ? `<div style="color:${stalled ? '#ff5a4a' : '#fff'}"><small>THROTTLE · SPEED</small>${Math.round((Hp.thr || 0) * 100)}% · ${Math.round(pv * 3.6)} KM/H${stalled ? ' · STALL!' : ''}</div>` : S.vtol ? '<div><small>V</small>HOVER MODE</div>' : '';
    this.$('right').innerHTML = `${planeHud}${this.holdT > 0.4 ? '<div style="color:#7dff9a"><small>AUTOPILOT</small>HOVER HOLD</div>' : ''}${S.rockets ? `<div><small>ROCKETS</small>${this.rockets} / ${S.rockets}</div>` : ''}${S.bombs ? `<div><small>BOMBS</small>${this.bombs} / ${S.bombs}</div>` : ''}${S.flares ? `<div><small>FLASH [X]</small>${this.flaresLeft} / ${S.flares}</div>` : ''}${S.beacons ? `<div><small>BEACONS [N]</small>${this.beaconsLeft} / ${S.beacons}</div>` : ''}${S.speaker ? `<div><small>SIREN [V]</small>${this.siren > 0 ? 'ON' : this.sirenCd > 0 ? `${Math.ceil(this.sirenCd)}s` : 'READY'}</div>` : ''}<div><small>SEATS</small>${team.length + this.riders} / ${S.seats}</div>${team.length ? `<div><small>TEAM</small>${team.map((m) => `<span style="color:rgb(${ROLES[m.role].col.map((v) => Math.round(v * 255))})">●</span>`).join('')}</div>` : ''}${this.riders ? `<div><small>SURVIVORS</small>${this.riders}</div>` : ''}${fr ? `<div><small>FRIENDS</small>${fr}</div>` : ''}<div><small>KILLS</small>${run.kills}</div><div><small>SCRAP</small>⚙ ${this.save.scrap.toLocaleString('en-GB')}</div>`;
    // actions you can take here (buttons you can click when the mouse is free)
    // rebuilt only when the set of buttons changes (so a click isn't lost); the labels update in place
    const acts = this.actions || [], sig = acts.map((a) => a[1]).join('|');
    const box = this.$('acts');
    if (sig !== this.actSig) {
      this.actSig = sig;
      box.replaceChildren();
      acts.forEach((a, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.onclick = () => { const cur = (this.actions || [])[i]; if (cur) cur[3](); };
        box.append(b);
      });
    }
    acts.forEach(([, key, label, , alt], i) => {
      const b = box.children[i]; if (!b) return;
      const html = `<kbd>${key}</kbd>${label}`;
      if (b.innerHTML !== html) b.innerHTML = html;
      const cls = `da-act${alt ? ' alt' : ''}`;
      if (b.className !== cls) b.className = cls;
    });
    let status = '';
    if (this.scav) status = `FUEL RUN · BACK IN ${Math.ceil(this.scav.t)}s · DON'T TAKE OFF!`;
    else if (this.drop) status = 'FUEL DROP INCOMING…';
    else if (this.atFob && this.atFob.wrecked) status = `${this.atFob.name} IS WRECKED · BACK IN ${fmtT(this.atFob.wreckT)}`;
    else if (this.servicing) status = this.svc === 'fuel' ? 'REFUELLING…' : 'REPAIRING…';
    else if (this.atRoof && !this.settled && !this.boarding) status = 'PRESS E TO LOWER THE LADDER';
    else if (this.settled && this.actions?.length && !this.locked) status = 'PRESS W TO TAKE OFF AGAIN';
    this.$('status').textContent = status;
    const grab = this.horde.list.filter((z) => z.alive && z.st === 'grab').length;
    const w = this.$('warn');
    const msg = H.dead || this.mode === 'down' ? '' : this.outT ? 'TURN BACK · YOU\'RE LEAVING THE AREA' : this.fuel <= 0 ? 'OUT OF FUEL · LAND!' : this.hp / S.hp < 0.25 ? 'HULL CRITICAL · LAND AT A BASE TO REPAIR' : grab ? `${grab} ZOMBIE${grab > 1 ? 'S' : ''} ON THE SKIDS · CLIMB FAST OR SWING ABOUT` : this.fuel / S.fuel < 0.12 ? 'FUEL VERY LOW' : this.agl < 9 && Math.hypot(...H.vel) > 18 && H.vel[1] < -6 ? 'PULL UP' : '';
    w.textContent = msg; w.classList.toggle('hidden', !msg);
    this.$('dmg').style.opacity = Math.min(0.9, this.dmgT + (this.hp / S.hp < 0.25 ? 0.25 + 0.15 * Math.sin(this.t * 6) : 0)).toFixed(3);
    this.$('click').classList.toggle('hidden', this.locked || this.mode !== 'fly' || !!this.panel || (this.settled && this.actions?.length > 0));
  }

  startAudio() {
    const c = this.snd.ctx;
    if (!c || this.au) return;
    const src = c.createBufferSource(); src.buffer = this.snd.noise; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const g = c.createGain(); g.gain.value = 0;
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0;
    const lg = c.createGain(); lg.gain.value = 0;
    lfo.connect(lg).connect(g.gain);
    src.connect(lp).connect(g).connect(this.snd.master);
    const whine = c.createOscillator(); whine.type = 'sawtooth'; whine.frequency.value = 300;
    const wl = c.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 1400;
    const wg = c.createGain(); wg.gain.value = 0;
    whine.connect(wl).connect(wg).connect(this.snd.master);
    // planes: a second, deeper engine voice (a propeller's drone, or a jet's rumble)
    const hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 70;
    const hl = c.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 420;
    const hg = c.createGain(); hg.gain.value = 0;
    hum.connect(hl).connect(hg).connect(this.snd.master);
    src.start(); lfo.start(); whine.start(); hum.start();
    this.au = { src, lp, g, lfo, lg, whine, wl, wg, hum, hl, hg };
  }
  stopAudio() {
    if (!this.au) return;
    try { this.au.src.stop(); this.au.lfo.stop(); this.au.whine.stop(); this.au.hum.stop(); } catch { /* ignore */ }
    this.au.g.disconnect(); this.au.wg.disconnect(); this.au.hg.disconnect();
    this.au = null;
  }
  // what the engine sounds like: 'heli' (rotor chop), 'jet' (roar and turbine whine) or 'prop' (propeller drone)
  engineKind(id, H) {
    const st = HELIS[id] || {};
    if (!st.plane || (st.vtol && !H.planeMode)) return 'heli';
    return id === 'warthog' || id === 'harrier' ? 'jet' : 'prop';
  }
  audio() {
    if (!this.au) { if ((this.mode === 'fly' || this.mode === 'gunner' || this.mode === 'wing') && this.snd.ctx) this.startAudio(); return; }
    const c = this.snd.ctx, H = this.mode === 'gunner' ? this.client?.heli : this.heli, t = c.currentTime;
    if (!H) return;
    const id = this.mode === 'gunner' ? this.client?.hk || this.save.heli : this.save.heli;
    const kind = this.engineKind(id, H), au = this.au;
    const coll = this.key('KeyW') ? 1 : this.key('KeyS') ? -0.5 : 0;
    const eng = this.fuel <= 0 && this.mode !== 'gunner' ? 0.3 : 1;
    const boost = H.boost || 0, thr = H.thr ?? 0.5, sp = Math.hypot(...H.vel);
    if (kind === 'heli') {
      au.lp.frequency.setTargetAtTime(260, t, 0.2);
      au.lfo.frequency.setTargetAtTime(H.rpm * 18, t, 0.1);
      au.g.gain.setTargetAtTime(H.rpm * (0.55 + coll * 0.15), t, 0.1);
      au.lg.gain.setTargetAtTime(H.rpm * 0.45, t, 0.1);
      au.whine.frequency.setTargetAtTime(240 + H.rpm * 380 * eng + boost * 300, t, 0.2);
      au.wl.frequency.setTargetAtTime(1400, t, 0.2);
      au.wg.gain.setTargetAtTime((H.rpm * 0.018 + boost * 0.03) * eng, t, 0.2);
      au.hg.gain.setTargetAtTime(0, t, 0.2);
    } else if (kind === 'jet') {
      // a roar that opens up with the throttle, a high turbine whine, and a deep rumble; afterburner adds more
      const k = (0.25 + thr * 0.75) * eng;
      au.lp.frequency.setTargetAtTime(500 + thr * 1500 + boost * 1400 + sp * 3, t, 0.25);
      au.lfo.frequency.setTargetAtTime(7, t, 0.3);
      au.lg.gain.setTargetAtTime(0.04 * k, t, 0.3);
      au.g.gain.setTargetAtTime((0.32 + thr * 0.4 + boost * 0.35) * eng, t, 0.25);
      au.whine.frequency.setTargetAtTime(900 + thr * 1500 * eng + boost * 500, t, 0.4);
      au.wl.frequency.setTargetAtTime(4000, t, 0.3);
      au.wg.gain.setTargetAtTime((0.008 + thr * 0.014) * eng, t, 0.3);
      au.hum.frequency.setTargetAtTime(45 + thr * 30, t, 0.4);
      au.hl.frequency.setTargetAtTime(220, t, 0.3);
      au.hg.gain.setTargetAtTime((0.05 + thr * 0.06) * eng, t, 0.3);
    } else {
      // propellers: a buzzing drone that beats at the blade rate, plus wind noise that rises with speed
      const k = (0.3 + thr * 0.7) * eng;
      au.lp.frequency.setTargetAtTime(300 + sp * 4, t, 0.25);
      au.lfo.frequency.setTargetAtTime(22 + thr * 26, t, 0.2);
      au.lg.gain.setTargetAtTime(0.12 * k, t, 0.2);
      au.g.gain.setTargetAtTime(0.18 + sp * 0.002, t, 0.25);
      au.whine.frequency.setTargetAtTime(180 + thr * 140 * eng, t, 0.3);
      au.wl.frequency.setTargetAtTime(700, t, 0.3);
      au.wg.gain.setTargetAtTime(0.02 * k, t, 0.3);
      au.hum.frequency.setTargetAtTime(62 + thr * 48 * eng, t, 0.3);
      au.hl.frequency.setTargetAtTime(480, t, 0.3);
      au.hg.gain.setTargetAtTime(0.11 * k, t, 0.3);
    }
  }
  // background music: calm everywhere, drums and an arp come in while you're fighting
  musicTick(dt) {
    if (!this.music) this.music = new Music(this.snd);
    const s = this.save, m = this.mode;
    if (this.flashT > 0 || this.shake > 0.15 || (this.rocketT || 0) > 0) this.fightT = 6;
    this.fightT = Math.max(0, (this.fightT || 0) - dt);
    const P = this.heli?.pos, big = !!P && this.director?.list?.some((e) => /^(horde|siege|fort)/.test(e.tgt?.field || '') && Math.hypot(e.tgt.x - P[0], e.tgt.z - P[2]) < 700);
    const I = m === 'hangar' ? 0 : Math.max(this.fightT > 0 ? 1 : 0, big ? 0.6 : 0);
    this.music.vol = s.musicVol ?? 0.5;
    this.music.tick(s.music !== false && m !== 'title' && !document.hidden && !!this.snd.ctx, I);
  }

  // ---------------------------------------------------------------- drawing
  // automatic quality: if frames are slow, draw at a lower resolution, then drop shadows; climb back when it's quick
  // graphics quality, 0 (best) to 5 (fastest). AUTO moves it up and down to keep the game smooth; LOW and POTATO pin it.
  applyQ(q) {
    const L = QLEVELS[q];
    this.ql = q; this.r.resScale = L.res; this.noShadow = !L.shadow; this.viewDist = L.view; this.treeDist = L.trees;
  }
  perf() {
    const now = performance.now(), g = this.save.gfx || 'auto';
    const dt = Math.min(0.25, (now - (this.lastDraw || now)) / 1000);
    this.lastDraw = now;
    if (g !== 'auto') { const q = g === 'potato' ? 5 : 4; if (this.ql !== q) this.applyQ(q); return; }
    if (this.ql == null) this.applyQ(1);
    if (dt >= 0.2) return;                         // a hitch (loading, a tab switch): don't count it
    this.pfT = (this.pfT || 0) + dt; this.pfN = (this.pfN || 0) + 1;
    const avg = this.pfT / this.pfN;
    // slow: drop a level quickly. Smooth for a good while: try one level better
    if (this.pfT > 1.2 && avg > 1 / 45 && this.ql < 5) { this.applyQ(this.ql + 1); this.pfT = 0; this.pfN = 0; this.upT = 0; }
    else if (this.pfT > 4) {
      if (avg < 1 / 57 && this.ql > 0 && (this.upT = (this.upT || 0) + 1) >= 2) { this.applyQ(this.ql - 1); this.upT = 0; }
      this.pfT = 0; this.pfN = 0;
    }
  }
  draw(eye, fwd, roll, heliParts, extra, focus, fog) {
    const r = this.r;
    this.perf();
    // the hangar gets light from high up in front (through the open doors); outside, the low sunset sun
    const want = this.mode === 'hangar' ? [0.2, 0.9, -0.45] : SUN;
    if (this.sunNow !== want) {
      this.sunNow = want;
      const l = Math.hypot(...want); r.sunDir = want.map((v) => v / l);
      r.gl.useProgram(r.prog); r.gl.uniform3fv(r.u.uSunDir, r.sunDir);
    }
    if ((this.ql || 0) >= 4) fog = Math.max(fog, 0.0075);
    const aspect = r.resize();
    const vfov = (64 * Math.PI) / 180;
    perspective(this.proj, vfov, aspect, 0.5, this.mode === 'hangar' ? 1100 : 4200);
    lookDir(this.view, eye, fwd, [0, 1, 0], roll);
    mul(this.vp, this.proj, this.view);
    r.setStudio(null); r.setRoom(null); r.setUnder(false); r.setRim(null);
    const sc = [Math.round(focus[0] / 4) * 4, 0, Math.round(focus[2] / 4) * 4];
    r.setShadowArea(sc, 80);
    const farCull = this.mode === 'hangar' ? 400 : this.viewDist || 2800;
    this.hazeD = 0.12 * fog * ((this.ql || 0) >= 4 ? 1.3 : 1);
    const tv = Math.tan(vfov / 2), kf = Math.hypot(tv, tv * aspect), kr = Math.sqrt(1 + kf * kf);
    const view = (c, rad) => {
      const dx = c[0] - eye[0], dy = c[1] - eye[1], dz = c[2] - eye[2], d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > (farCull + rad) * (farCull + rad)) return false;
      const al = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
      if (al < -rad) return false;
      return Math.sqrt(Math.max(0, d2 - al * al)) <= al * kf + rad * kr;
    };
    const near = (c, rad) => Math.abs(c[0] - sc[0]) < 130 + rad && Math.abs(c[2] - sc[2]) < 130 + rad;
    const outside = this.mode !== 'hangar';
    if (outside) { this.terrain.stream(r, eye, farCull + 200, this.streamBudget || 5); this.forest.stream(r, eye, this.streamBudget ? Math.max(2, this.streamBudget - 1) : 4); }
    r.setHaze(outside ? this.hazeD : 0, 0.0042, outside, farCull);
    const sp = outside && this.mode !== 'off' ? this.spot : null;
    r.setSpot(sp ? sp.pos : [0, 0, 0], sp ? sp.dir : [0, -1, 0], sp ? sp.cos : 1, sp ? sp.on : 0);
    const zn = this.horde.fill(r, this.zBatches, eye, fwd, kf);
    const zb = Object.values(this.zBatches);
    const sn = this.fillSmoke(eye);
    const solid = heliParts.filter((p) => (p.alpha ?? 1) >= 1), clear = heliParts.filter((p) => (p.alpha ?? 1) < 1);
    const exS = extra.filter((p) => (p.alpha ?? 1) >= 1), exC = extra.filter((p) => (p.alpha ?? 1) < 1);
    const shadows = !this.noShadow;
    if (shadows) {
    r.beginShadow();
    this.batches.drawShadows(0, near);
    if (outside) {
      for (const c of this.terrain.chunks) if (near(c.center, c.S / 2)) r.shadowMesh(c.mesh, c.model);
      for (const c of this.forest.visible) if (near(c.center, 64)) { for (const b of c.batches) r.shadowBatch(b); if (c.trunks) r.shadowBatch(c.trunks); }
    }
    for (const b of this.live) if (!b.noShadow && !b.hidden && near(b.center, 10)) r.shadowDraw(b.model, b.shape, b.scale);
    for (const p of solid) r.shadowDraw(p.model, p.shape, p.scale);
    for (const p of exS) r.shadowDraw(p.model, p.shape, p.scale);
    if (zn) for (const b of zb) r.shadowBatch(b);
    r.gl.bindVertexArray(null); r.boundMesh = null;
    this.fx.drawShadows(r);
    r.endShadow();
    }
    r.begin();
    r.setCamera(this.proj, this.view, fog, eye, shadows);
    r.drawSky(eye);
    r.setBlend(false);
    this.batches.draw(0, view);
    if (outside) {
      for (const c of this.terrain.chunks) if (view(c.center, c.radius)) r.drawMesh(c.mesh, c.model, [1, 1, 1], 60);
      this.forest.draw = this.treeDist || 1100;
      for (const c of this.forest.visible) if (view(c.center, c.radius)) {
        for (const b of c.batches) r.drawBatch(b);
        if (c.trunks && Math.hypot(c.center[0] - eye[0], c.center[2] - eye[2]) < 520) r.drawBatch(c.trunks);
      }
      r.endBatches();
    }
    for (const b of this.live) if ((b.alpha ?? 1) >= 1 && !b.hidden && view(b.center, 0.5 * Math.hypot(...b.scale))) r.drawBox(b);
    if (zn) { for (const b of zb) r.drawBatch(b); r.endBatches(); }
    for (const p of solid) r.drawPart(p, 0);
    for (const p of exS) r.drawPart(p, 0);
    this.fx.drawOpaque(r);
    r.setBlend(true);
    for (const p of clear) r.drawPart(p, 0);
    for (const p of exC) r.drawPart(p, 0);
    this.fx.drawTransparent(r);
    if (sn) { r.drawBatch(this.smokeBatch); r.endBatches(); }
    r.setBlend(false);
  }

  // smoke: tall columns over the fires (worked out from the clock, nothing stored) and puffs left by explosions
  fillSmoke(eye) {
    const D = this.smokeData, m = mat4();
    let n = 0;
    const put = (x, y, z, sz, col, a) => {
      if (n >= 1200) return;
      compose(m, [x, y, z], [0, 0, 0], [sz, sz * 0.8, sz]);
      const o = n * 32;
      for (let k = 0; k < 16; k++) D[o + k] = m[k];
      D[o + 16] = sz; D[o + 17] = sz * 0.8; D[o + 18] = sz; D[o + 19] = 0;
      D[o + 20] = col[0]; D[o + 21] = col[1]; D[o + 22] = col[2]; D[o + 23] = a;
      D[o + 24] = 70; D[o + 25] = 0; D[o + 26] = col[3] || 0; D[o + 27] = 0; D[o + 28] = 0; D[o + 29] = 1; D[o + 30] = 0; D[o + 31] = 0;
      n++;
    };
    const t = this.t, wind = [0.8, 0.6];
    for (const [x, y, z, k] of this.plumes || []) {
      if (Math.abs(x - eye[0]) > 650 || Math.abs(z - eye[2]) > 650) continue;
      const N = Math.round(10 + 8 * k), H = 90 * k;
      for (let i = 0; i < N; i++) {
        const ph = (t * 0.035 / k + i / N) % 1, h = ph * H, sz = (3 + ph * 22) * k;
        const a = 0.32 * Math.min(1, ph * 8) * (1 - ph);
        const g = 0.09 + ph * 0.12;
        put(x + wind[0] * h * 0.4 + Math.sin(i * 7.1 + t * 0.2) * sz * 0.2, y + h, z + wind[1] * h * 0.4 + Math.cos(i * 3.3) * sz * 0.2, sz, [g, g * 0.95, g * 0.9], a);
        if (ph < 0.12) put(x, y + h * 0.5, z, sz * 0.6, [1, 0.45, 0.1, 1], 0.5 * (1 - ph / 0.12));
      }
    }
    for (const sm of this.smokes) {
      const k = sm.t / sm.life, f = sm.fire || 0;
      put(sm.pos[0] + sm.drift[0] * sm.t, sm.pos[1] + sm.t * 2.2, sm.pos[2] + sm.drift[1] * sm.t, sm.size * (1 + k * 2.2), f ? [0.16 + f * (1 - k), 0.12 + f * 0.4 * (1 - k), 0.1, f * (1 - k)] : [0.16, 0.15, 0.14], 0.45 * (1 - k) * Math.min(1, sm.t * 6));
    }
    // splats where zombies fell
    for (const sp of this.splats || []) {
      if (Math.abs(sp.x - eye[0]) > 200 || Math.abs(sp.z - eye[2]) > 200) continue;
      if (n >= 1200) break;
      compose(m, [sp.x, sp.y, sp.z], [0, sp.r * 7, 0], [sp.r * 2, 0.03, sp.r * 1.6]);
      const o = n * 32;
      for (let k = 0; k < 16; k++) D[o + k] = m[k];
      D[o + 16] = sp.r * 2; D[o + 17] = 0.03; D[o + 18] = sp.r * 1.6; D[o + 19] = 0;
      D[o + 20] = 0.22; D[o + 21] = 0.03; D[o + 22] = 0.03; D[o + 23] = 0.8 * Math.min(1, (30 - sp.t) / 5);
      D[o + 24] = 0; D[o + 25] = 0; D[o + 26] = 0; D[o + 27] = 0; D[o + 28] = 0; D[o + 29] = 0.3; D[o + 30] = 0; D[o + 31] = 0;
      n++;
    }
    // ash and embers drifting round you
    if (this.mode !== 'hangar') for (let i = 0; i < 70; i++) {
      const sx = ((i * 37.7) % 60) - 30, sz = ((i * 91.3) % 60) - 30, sy = ((i * 13.1) % 30) - 10;
      const x = eye[0] + (((sx + t * 1.5 + 30) % 60) + 60) % 60 - 30, y = eye[1] + ((((sy - t * (0.6 + (i % 5) * 0.2)) + 10) % 30) + 30) % 30 - 10, z = eye[2] + (((sz + t * 1.1 + 30) % 60) + 60) % 60 - 30;
      const ember = i % 3 === 0;
      put(x, y, z, ember ? 0.07 : 0.1, ember ? [1, 0.5, 0.15, 1] : [0.35, 0.33, 0.32], ember ? 0.9 : 0.5);
    }
    this.r.fillBatch(this.smokeBatch, D, n, 0);
    return n;
  }
}
const norm4 = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return q.map((v) => v / l); };
