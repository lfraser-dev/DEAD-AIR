// DEAD AIR: a third-person helicopter shooter in an open world full of zombies.
//
// HANGAR: spend SCRAP on upgrades; every one is built onto the helicopter where you can see it.
// THE WORLD: a city and countryside with four army bases (FOBs) and a rooftop fuel pad. Scenarios pop up all over
// (see events.js): rescues, convoys, nests, supply crates, sieges and titans. There's no timer: fly as long as your
// fuel lasts. Land at a base to refuel, repair, rearm, drop off survivors, open the hangar (H) or your team (T).
// FUEL: it runs down while you fly. Run dry and the rotor windmills you down slowly. Stuck somewhere? Land on a roof
// and send your survivors out to find fuel (Q) — not all of them come back — or pay for a fuel drop (G).
// ACTIONS: when you land, the mouse is let go and buttons show up for what you can do there (or press the keys).
// TEAM: survivors you bring back sometimes offer to join your crew (gunner, mechanic, medic, scavenger, lookout), and
// friends can join online as door gunners (coop.js).
import { perspective, lookDir, mul, mat4, compose, clamp, damp, norm } from '../math.js';
import { StaticBatches } from '../batch.js';
import { Effects } from '../effects.js';
import { buildWorld, HANGAR, HALF, WORLD } from './map.js';
import { Horde, TYPES } from './horde.js';
import { Chopper, chopperParts, qrot, qmat } from './chopper.js';
import { SLOTS, SLOT, PAINTS, PAINT, loadSave, saveSave, statsFor, bars } from './data.js';
import { Director, randName, truckParts, nestParts, crateParts } from './events.js';
import { ROLES, ROLE_IDS, has, count } from './crew.js';
import { makeTransport, code5, ZT, ZS, q1, q2 } from './coop.js';
import { CSS } from './ui.js';

const FOG = [0.76, 0.56, 0.42], SKY = [0.2, 0.25, 0.46], SUN = [0.62, 0.42, 0.34];
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const CAMS = {
  all: [0.75, 0.22, 21, [0, 0.4, 1.5]], gun: [0.55, 0.02, 8.5, [0, -0.9, -3.6]], rockets: [1.15, 0.15, 10, [1.6, -0.5, 0.4]],
  bombs: [1.35, -0.12, 9, [0, -1.4, 0.4]], armor: [0.85, 0.15, 13, [0, -0.1, -0.6]], engine: [2.5, 0.38, 10, [0, 1.4, 1.6]],
  rotor: [0.8, 0.62, 19, [0, 2, 0.3]], door: [1.62, 0.08, 9, [1.1, 0, 0.6]], cabin: [-1.45, 0.12, 11, [-1, -0.2, 0.7]],
  fuel: [1.25, 0.05, 11, [1.2, -0.8, 0.4]], paint: [0.75, 0.22, 21, [0, 0.4, 1.5]],
};
const FLIGHT = { easy: 'EASY', assist: 'ASSIST', pro: 'PRO' };
const FRIEND_COLS = [[1, 0.8, 0.1], [0.3, 0.9, 1]];

export class HeliGame {
  constructor({ renderer, sounds, canvas, onExit, isDev }) {
    this.r = renderer; this.snd = sounds; this.canvas = canvas; this.onExit = onExit; this.isDev = isDev || (() => false);
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
  load() {
    if (this.map) return;
    this.map = buildWorld();
    this.world = this.map.world;
    this.fobs = this.map.fobs;
    this.fx = new Effects(this.world); this.fx.max = 1400;
    this.horde = new Horde(this.world, this.fx);
    this.batches = new StaticBatches(this.r);
    this.batches.build(this.world, () => 0);
    this.live = this.world.boxes.filter((b) => !b.batched && !b.hidden);
    const lo = this.r.meshesLo;
    this.zBatches = { box: this.r.makeBatch(this.r.cube), sphere: this.r.makeBatch(lo.sphere), cyl: this.r.makeBatch(lo.cyl), cylY: this.r.makeBatch(lo.cylY) };
    this.smokeBatch = this.r.makeBatch(lo.sphere);
    this.smokeData = new Float32Array(32 * 1200);
    this.smokes = [];
    // smoke columns over the burning city: a few roofs, fixed for everyone
    let sd = 99; const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
    this.plumes = [];
    for (let i = 0; i < 9; i++) { const r = this.map.roofs[Math.floor(rnd() * this.map.roofs.length)]; this.plumes.push([r.x, r.top + 1, r.z, 0.7 + rnd() * 0.6]); }
    for (const b of this.map.burning) if (rnd() < 0.35) this.plumes.push([b[0], b[1], b[2], 0.35]);
    this.heli = new Chopper();
    this.director = new Director();
  }
  get time() { return this.run ? this.run.t : 0; }
  fobById(id) { return this.fobs.find((f) => f.id === id); }
  groundAt(x, z) { const h = this.world.raycast([x, 300, z], [0, -1, 0], 400); return h ? h.point[1] : 0; }

  open() {
    this.load();
    this.active = true;
    this.save = loadSave();
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
    this.root.classList.add('hidden');
    this.setSky(false);
    saveSave(this.save);
    this.onExit?.();
  }

  setSky(on) {
    const gl = this.r.gl; gl.useProgram(this.r.prog);
    this.r.fogColor = on ? [...FOG] : [0.86, 0.89, 0.93];
    gl.uniform3fv(this.r.u.uFogColor, this.r.fogColor);
    gl.uniform3fv(this.r.u.uSkyTop, on ? SKY : [0.48, 0.64, 0.86]);
    const sd = on ? SUN : [0.45, 0.8, 0.38], l = Math.hypot(...sd);
    this.r.sunDir = sd.map((v) => v / l);
    gl.uniform3fv(this.r.u.uSunDir, this.r.sunDir);
  }

  // ---------------------------------------------------------------- input
  listen() {
    const flying = () => this.mode === 'fly' || this.mode === 'gunner';
    addEventListener('keydown', (e) => {
      if (!this.active || e.target?.tagName === 'INPUT') return;
      e.stopImmediatePropagation();
      if (flying() && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.hitKeys.add(e.code);
      this.keys.add(e.code);
      if (this.mode === 'hangar' && e.code === 'Escape') { if (this.panel) this.closePanel(); else this.close(); }
      if (this.mode === 'hangar' && e.code === 'Enter' && !this.panel) this.deploy();
      if (flying() && e.code === 'Escape') { if (this.panel) this.closePanel(); else this.pause(true); }
      if (this.mode === 'fly' && e.code === 'KeyT') { if (this.panel) this.closePanel(); else this.openTeam(); }
      if (this.mode === 'hangar' && e.code === 'KeyT') { if (this.panel) this.closePanel(); else this.openTeam(); }
      // taking off again grabs the mouse back
      if (this.mode === 'fly' && !this.locked && !this.panel && ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'].includes(e.code)) this.lock();
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
        <button class="da-deploy" data-da="deploy" type="button">TAKE OFF ▶</button>
      </div>
      <div class="da-hud hidden" data-da="hud">
        <div class="da-dmg" data-da="dmg"></div>
        <div data-da="marks"></div>
        <div class="da-cross" data-da="cross"></div><div class="da-hit" data-da="hit"></div>
        <div class="da-evs" data-da="evs"></div>
        <canvas class="da-map" data-da="map" width="190" height="190"></canvas>
        <div class="da-boss hidden" data-da="boss">TITAN<i></i></div>
        <div class="da-banner" data-da="banner"><b></b><span></span></div>
        <div class="da-warn hidden" data-da="warn"></div>
        <div class="da-feed" data-da="feed"></div>
        <div class="da-help" data-da="help"></div>
        <div class="da-left">
          <div class="da-meter fuel" data-da="fuelm" style="--c:#ff9f3a">FUEL <b data-da="fueltxt"></b><i></i></div>
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
    this.$('tbtn').onclick = () => this.openTeam();
  }
  flash(t) { const m = this.$('msg'); m.textContent = t; m.style.opacity = 1; clearTimeout(this.msgT); this.msgT = setTimeout(() => { m.style.opacity = 0; }, 1800); }

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
    this.hangarHeli.reset([HANGAR[0], 2.04, HANGAR[2]], 0, statsFor(this.save.eq));
    this.hst = { rotorA: 0.3, tailA: 0, rpm: 0, spin: 0, t: 0, install: this.install, riders: 0 };
    this.renderHangar();
  }

  renderHangar() {
    const s = this.save, el = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild; };
    this.$('scrap').innerHTML = `<small>SCRAP</small>⚙ ${s.scrap.toLocaleString('en-GB')}`;
    const slots = this.$('slots'); slots.replaceChildren();
    for (const sl of [...SLOTS, { id: 'paint', name: 'PAINT JOB', icon: '◆' }]) {
      const cur = sl.id === 'paint' ? PAINT[s.paint].n : sl.tiers[s.eq[sl.id]].n;
      const canBuy = sl.id !== 'paint' && s.own[sl.id] < sl.tiers.length - 1 && s.scrap >= sl.tiers[s.own[sl.id] + 1].cost;
      const b = el(`<button class="da-slot${this.sel === sl.id ? ' on' : ''}" type="button"><i>${sl.icon}</i><span><b>${sl.name}</b><small>${cur}</small></span>${canBuy ? '<em>NEW</em>' : ''}</button>`);
      b.onclick = () => { this.snd.click?.(2400, 0.2); this.sel = this.sel === sl.id ? 'all' : sl.id; this.renderHangar(); };
      slots.append(b);
    }
    const tiers = this.$('tiers'); tiers.replaceChildren();
    if (this.sel === 'paint') {
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
      const sl = SLOT[this.sel];
      sl.tiers.forEach((t, i) => {
        const own = i <= s.own[sl.id], eq = s.eq[sl.id] === i, next = i === s.own[sl.id] + 1;
        const cls = eq ? ' eq' : own ? '' : next ? s.scrap >= t.cost ? ' buy' : ' poor' : ' lock';
        const b = el(`<button class="da-tier${cls}" type="button"><b>${t.n}</b><p>${t.d}</p><span>${eq ? 'FITTED' : own ? 'FIT' : next ? `BUY ⚙ ${t.cost.toLocaleString('en-GB')}` : 'LOCKED'}</span></button>`);
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
    st.innerHTML = `<h4>YOUR CHOPPER</h4>${bars(s.eq).map(([n, p]) => `<div class="da-bar">${n}<i style="--p:${clamp(p, 0.04, 1).toFixed(2)}"></i></div>`).join('')}<div class="da-best">SURVIVORS SAVED: ${s.rescued} · TITANS KILLED: ${s.titans}<br>SCENARIOS DONE: ${s.events || 0} · CREW: ${s.crew.length}</div>`;
    const opts = this.$('opts'); opts.replaceChildren();
    const opt = (label, val, fn) => { const b = el(`<button class="da-opt" type="button">${label}<b>${val}</b></button>`); b.onclick = () => { fn(); saveSave(s); this.snd.click?.(2000, 0.2); this.renderHangar(); }; opts.append(b); };
    opt('FLYING', FLIGHT[s.flight] || 'EASY', () => { s.flight = s.flight === 'easy' ? 'assist' : s.flight === 'assist' ? 'pro' : 'easy'; });
    opt('INVERT MOUSE', s.invert ? 'ON' : 'OFF', () => { s.invert = !s.invert; });
    opt('GRAPHICS', s.gfx === 'low' ? 'LOW (FAST)' : 'AUTO', () => { s.gfx = s.gfx === 'low' ? 'auto' : 'low'; if (s.gfx !== 'low') { this.r.resScale = 1; this.noShadow = false; } });
    opt('MOUSE SPEED', `${s.sens.toFixed(1)}×`, () => { s.sens = s.sens >= 2 ? 0.5 : Math.round((s.sens + 0.25) * 100) / 100; });
    const tb = el('<button class="da-opt" type="button">YOUR TEAM<b>CREW + FRIENDS ▶</b></button>');
    tb.onclick = () => this.openTeam(); opts.append(tb);
    const c = CAMS[this.sel] || CAMS.all;
    Object.assign(this.cam, { yawT: c[0], pitchT: c[1], distT: c[2], tgtT: c[3] });
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
    const s = this.save, st = statsFor(s.eq);
    const crew = s.crew.map((m) => ({ col: ROLES[m.role].col }));
    const parts = chopperParts(s.eq, PAINT[s.paint], { ...this.hst, crew, rockets: st.rockets, rocketMax: st.rockets, bombs: st.bombs, bombMax: st.bombs }, H.H);
    this.draw(eye, fwd, 0, parts, [], HANGAR, 0.002);
    if (this.coop) this.coopHostTick(dt);
  }

  // ---------------------------------------------------------------- flying: start, respawn
  deploy() {
    if (this.mode !== 'hangar') return;
    this.snd.unlock?.(); this.snd.startRun?.();
    const s = this.save, S = statsFor(s.eq);
    S.rotorTier = s.eq.rotor;
    this.S = S;
    this.closePanel();
    this.$('hangar').classList.add('hidden');
    this.$('hud').classList.remove('hidden');
    this.root.classList.remove('da-gunner');
    const fob = this.session?.fob && !this.session.fob.wrecked ? this.session.fob : this.fobById('home');
    if (!this.session) {
      this.session = { fob };
      this.run = { t: 0, kills: 0, rescued: 0, lost: 0, scrap: 0 };
      this.fx.clear(); this.horde.clear(); this.director.clear();
      for (const f of this.fobs) { f.hp = f.max; f.wrecked = false; }
      this.heli.reset([fob.padAt[0], fob.padAt[1] + 1.93, fob.padAt[2]], this.faceCity(fob), S);
      this.director.start(this);
      this.banner('DEAD AIR', 'THE CITY IS OVERRUN · HELP WHO YOU CAN', '', 3);
      this.help(true);
      this.riders = 0; this.fuel = S.fuel;
      this.shots = []; this.tracers = []; this.blasts = []; this.fires = []; this.runners = [];
    } else {
      // back out of the hangar at the same base, fixed up and refuelled
      this.heli.stats = S;
      this.heli.reset([fob.padAt[0], fob.padAt[1] + 1.93, fob.padAt[2]], this.heli.heading, S);
    }
    this.hp = S.hp; this.fuel = Math.max(this.fuel ?? S.fuel, S.fuel);
    this.heat = 0; this.overT = 0; this.gunT = 0; this.spinV = 0; this.flashT = 0;
    this.rockets = S.rockets; this.rocketT = 0; this.rocketRegen = 0; this.rocketSide = 0;
    this.bombs = S.bombs; this.bombT = 0;
    this.boardT = 0; this.unloadT = 0; this.unloading = false; this.boarding = false;
    this.doorAim = [[-Math.PI / 2, -0.3], [Math.PI / 2, -0.3]]; this.doorT = [0, 0]; this.doorTgt = [null, null]; this.doorFlash = [0, 0];
    this.shake = 0; this.dmgT = 0; this.camMode = this.camMode || 0; this.camEye = null; this.camLook = null;
    this.scav = null; this.drop = null; this.crate = this.crate && this.crate.carried ? this.crate : null;
    this.mode = 'fly';
    this.startAudio();
    this.lock();
  }
  faceCity(f) { return Math.atan2(f.padAt[0], f.padAt[2]); }    // heading that points the nose at the city centre
  help(on) {
    const h = this.$('help');
    const mode = this.save.flight;
    h.innerHTML = mode === 'easy'
      ? '<kbd>W</kbd><kbd>S</kbd> UP / DOWN · <kbd>MOUSE</kbd> STEER (FORWARD = FLY FORWARD) · <kbd>A</kbd><kbd>D</kbd> SLIDE<br><kbd>CLICK</kbd> GUN · <kbd>RIGHT CLICK</kbd> ROCKETS · <kbd>SPACE</kbd> BOMB · <kbd>C</kbd> CAMERA · LAND TO SEE WHAT YOU CAN DO'
      : '<kbd>W</kbd><kbd>S</kbd> UP / DOWN · <kbd>A</kbd><kbd>D</kbd> TURN · <kbd>MOUSE</kbd> TILT TO FLY<br><kbd>CLICK</kbd> GUN · <kbd>RIGHT CLICK</kbd> ROCKETS · <kbd>SPACE</kbd> BOMB · <kbd>C</kbd> CAMERA · LAND TO SEE WHAT YOU CAN DO';
    this.helpT = on ? 22 : 0;
  }

  // ---------------------------------------------------------------- the frame
  frame(dt) {
    this.t += dt;
    if (this.mode === 'hangar') this.hangarFrame(dt);
    else if (this.mode === 'fly' || this.mode === 'pause' || this.mode === 'down') this.flyFrame(this.mode === 'pause' && !this.coop ? 0 : dt);
    else if (this.mode === 'gunner' || this.mode === 'gpause') this.gunnerFrame(dt);
    else if (this.mode === 'joining') {
      const a = this.t * 0.05, eye = [Math.sin(a) * 300, 110, Math.cos(a) * 300], l = Math.hypot(eye[0], 80, eye[2]);
      this.draw(eye, [-eye[0] / l, -80 / l, -eye[2] / l], 0, [], [], [0, 0, 0], 0.0045);
    }
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
      const grabbers = this.horde.list.filter((z) => z.alive && z.st === 'grab').length;
      H.extraMass = grabbers * 0.07 + (this.crate && this.crate.carried ? 0.12 : 0);
      H.step(dt, ctl, this.world);
      this.edge(dt);
      const easy = this.save.flight === 'easy';
      for (const ev of H.events) {
        if (ev.type === 'impact') { this.hurt(ev.speed * (ev.hard ? 14 : 9) * (easy ? 0.5 : 1), ev.point); this.fx.sparks(ev.point, 12, [1, 0.8, 0.4], 7, 0.5, 0.05, 2); this.snd.meleeWall?.('smash'); this.shake = Math.max(this.shake, 0.5); }
        else if (ev.type === 'rotor') { this.rotorHitT = (this.rotorHitT || 0) - dt; if (this.rotorHitT <= 0) { this.rotorHitT = 0.15; this.hurt(easy ? 7 : 14, ev.point); this.fx.sparks(ev.point, 10, [1, 0.85, 0.5], 9, 0.4, 0.04, 1); this.snd.click?.(3600, 0.4, 3); this.shake = Math.max(this.shake, 0.4); } }
      }
      H.events.length = 0;
      if (H.dead && this.mode !== 'down' && (H.contacts || H.pos[1] < 1)) this.crash();
      this.burnFuel(dt, ctl);
      if (live && !H.dead && !this.panel) this.weapons(dt);
      this.doorGuns(dt);
      this.turrets(dt);
      this.updateShots(dt);
      this.landing(dt);
      this.ambientSpawns(dt);
      this.director.update(dt, this);
      this.fobTick(dt);
      const aglHit = this.world.raycast([H.pos[0], H.pos[1] - 2, H.pos[2]], [0, -1, 0], 300);
      this.agl = aglHit ? aglHit.t : 300;
      const roofs = this.director.list.filter((e) => e.kind === 'rescue').map((e) => e.roof);
      this.horde.update(dt, { heli: H, heliAlt: this.agl, roofs });
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
    if (H.pos[1] > 200) { H.vel[1] -= (H.pos[1] - 200) * 3 * dt; this.outT = 1; }
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
    this.hp -= dmg; this.dmgT = Math.min(1, this.dmgT + dmg / 60);
    this.shake = Math.max(this.shake, Math.min(0.8, dmg / 60));
    this.snd.hurt?.();
    if (this.hp <= 0) {
      this.hp = 0; this.heli.dead = true;
      this.banner('YOU\'RE GOING DOWN', 'MAYDAY · MAYDAY', 'bad', 3);
      this.snd.alarm?.();
    }
  }

  crash() {
    const p = this.heli.pos;
    this.boom(p, 3);
    for (let i = 0; i < 30; i++) this.fx.flame([p[0] + (Math.random() - 0.5) * 6, p[1], p[2] + (Math.random() - 0.5) * 6], [0, 2, 0], 4);
    this.heli.vel = [0, 0, 0]; this.heli.rpm = 0;
    this.mode = 'down';
    const lostR = this.riders; this.run.lost += lostR; this.riders = 0;
    if (this.crate && this.crate.carried) { this.crate.carried = false; this.crate.done = true; this.crate = null; }
    for (const z of this.horde.list) if (z.st === 'grab') { z.st = 'fall'; z.vel = [0, 2, 0]; }
    const bill = Math.min(this.save.scrap, 150);
    this.save.scrap -= bill; saveSave(this.save);
    if (document.pointerLockElement) { this.softUnlock = true; document.exitPointerLock(); }
    setTimeout(() => {
      if (this.mode !== 'down') return;
      const e = this.$('end');
      e.innerHTML = `<h2 class="lose">SHOT DOWN</h2><p>${lostR ? `${lostR} survivor${lostR > 1 ? 's' : ''} didn't make it.` : 'You walked away from it.'} The rescue team pulled you out.</p>
        <table><tr><td>REPAIR BILL</td><td>⚙ ${bill}</td></tr><tr><td>ZOMBIES KILLED</td><td>${this.run.kills}</td></tr><tr><td>SURVIVORS SAVED</td><td>${this.run.rescued}</td></tr><tr><td>SCRAP</td><td>⚙ ${this.save.scrap.toLocaleString('en-GB')}</td></tr></table>
        <div class="row"><button data-x="go" type="button">FLY AGAIN FROM ${this.nearestFob(p).name}</button><button class="alt" data-x="hangar" type="button">HANGAR</button></div>`;
      e.querySelector('[data-x=go]').onclick = () => this.respawn();
      e.querySelector('[data-x=hangar]').onclick = () => { this.session.fob = this.nearestFob(p); this.toHangar(); };
      e.classList.remove('hidden');
    }, 2600);
  }
  nearestFob(p, fuelOk = false) {
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
  bore() {
    const H = this.heli, a = 0.13;
    return { o: H.toWorld([0, -1.05, -5.0]), d: qrot(H.q, [0, -Math.sin(a), -Math.cos(a)]) };
  }
  // the nearest thing a ray hits: a wall, a zombie or something you can shoot (a nest)
  rayHit(o, d, max) {
    const w = this.world.raycast(o, d, max);
    let t = w ? w.t : max, res = { t, w };
    const zh = this.horde.hitRay(o, d, t);
    if (zh) { t = zh.t; res = { t, z: zh.z }; }
    for (const sh of this.director.shootables()) {
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
    this.flashT = Math.max(0, this.flashT - dt);
    this.rocketT -= dt;
    if (S.rockets) {
      this.rocketRegen += dt;
      if (this.rocketRegen > 8 && this.rockets < S.rockets) { this.rocketRegen = 0; this.rockets++; }
      if ((this.btn.has(2) || this.clk.has(2) || this.key('KeyR')) && this.locked && this.rocketT <= 0 && this.rockets > 0) {
        this.rocketT = S.homing ? 0.42 : 0.24; this.rockets--; this.rocketRegen = 0;
        this.fireRocket();
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
    if (this.hit('KeyC')) this.camMode = (this.camMode + 1) % 3;
  }

  fireGun() {
    const H = this.heli, G = this.S.gun;
    let { d } = this.bore();
    const x = G.barrels === 2 ? (this.gunSide = -(this.gunSide || 1)) * 0.42 : 0;
    const o = H.toWorld([x, -1.05, -5.1]);
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
    if (G.plasma) {
      this.shots.push({ kind: 'plasma', pos: o, vel: [H.vel[0] + dir[0] * 260, H.vel[1] + dir[1] * 260, H.vel[2] + dir[2] * 260], life: 2 });
      this.snd.tone?.(900, 200, 0.18, 0.12, 'sawtooth');
      return;
    }
    const h = this.rayHit(o, dir, 420);
    if (Math.random() < 0.6) this.tracer(o, dir, h.t, -1);
    if (h.z) this.hitZombie(h.z, G.dmg, [dir[0] * 6, 2, dir[2] * 6], h.p, 'gun');
    else if (h.sh) { h.sh.hit(G.dmg, this); this.hitMark(false); this.fx.sparks(h.p, 3, [0.5, 1, 0.3], 4, 0.4, 0.06, 1); }
    else if (h.w) { this.fx.impact(h.p, h.w.normal, h.w.box.color); if (Math.random() < 0.3) this.fx.dust(h.p, 2); }
    this.sndN = (this.sndN || 0) + 1;
    if (G.rate < 20 || this.sndN % 2 === 0) { this.snd.burst?.(0.06, 1500, 0.22); this.snd.burst?.(0.03, 5000, 0.08, 'highpass'); }
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
  hitMark(kill) { const h = this.$('hit'); h.classList.toggle('kill', !!kill); h.style.opacity = 1; this.hitT = kill ? 0.25 : 0.1; }

  fireRocket() {
    const H = this.heli, S = this.S;
    this.rocketSide = 1 - this.rocketSide;
    const x = (this.rocketSide ? 1 : -1) * (this.save.eq.rockets === 2 ? (this.rockets % 4 < 2 ? 1.35 : 2.15) : this.save.eq.rockets === 3 ? 1.8 : 1.75);
    const o = H.toWorld([x, -0.66, -0.7]);
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
    this.shots.push({ kind: 'rocket', pos: o, vel: [H.vel[0] + dir[0] * 120, H.vel[1] + dir[1] * 120, H.vel[2] + dir[2] * 120], life: 4, target, homing: S.homing });
    this.snd.launch?.();
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
    for (const sh of this.director.shootables()) { const d = Math.hypot(sh.pos[0] - p[0], sh.pos[1] - p[1], sh.pos[2] - p[2]); if (d < r + sh.r) sh.hit(dmg * (1 - clamp((d - sh.r) / r, 0, 0.8)), this); }
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
          const cur = norm(s.vel), k = Math.min(1, dt * 3.2);
          s.vel = norm(cur.map((c, j) => c + (v[j] - c) * k)).map((c) => c * Math.min(160, sp + dt * 40));
        }
        s.vel[1] -= 2 * dt;
        if (Math.random() < 0.8) { this.fx.spawnPiece(s.pos, [0.35, 0.35, 0.35], [0, 0.4, 0], [0.55, 0.55, 0.55], 1.1); this.fx.debris[this.fx.debris.length - 1].noGravity = true; }
        this.fx.flame(s.pos, [0, 0, 0], 1.6);
      } else if (s.kind === 'bomb') {
        s.vel[1] -= 9.8 * dt; s.t += dt;
        if (s.cluster && s.t > 0.6) {
          for (let j = 0; j < 6; j++) { const a = (j / 6) * Math.PI * 2; this.shots.push({ kind: 'bomblet', pos: [...s.pos], vel: [s.vel[0] + Math.cos(a) * 7, s.vel[1], s.vel[2] + Math.sin(a) * 7], life: 10 }); }
          this.fx.sparks(s.pos, 10, [1, 0.8, 0.3], 5, 0.4, 0.06, 0);
          this.shots.splice(i, 1); continue;
        }
      } else if (s.kind === 'bomblet') s.vel[1] -= 9.8 * dt;
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
      for (let j = 0; j < 3; j++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * f.r; this.fx.flame([f.pos[0] + Math.cos(a) * r, f.pos[1] + 0.2, f.pos[2] + Math.sin(a) * r], [0, 1.5, 0], 3.2); }
      if (f.tick <= 0) {
        f.tick = 0.25;
        for (const z of this.horde.list) if (z.alive && z.st !== 'grab' && Math.hypot(z.x - f.pos[0], z.z - f.pos[2]) < f.r && Math.abs(z.y - f.pos[1]) < 4) { if (this.horde.damage(z, z.type === 'titan' ? 60 : 22, [0, 3, 0], 'fire')) this.hitMark(true); }
      }
    }
  }

  explode(s, p, h) {
    const S = this.S;
    if (s.kind === 'plasma') {
      this.blastAll(p, S.gun.splash, S.gun.dmg, 8, 'gun');
      if (h.z) this.hitZombie(h.z, S.gun.dmg, [s.vel[0] * 0.03, 3, s.vel[2] * 0.03], p, 'gun');
      this.fx.sparks(p, 12, [0.5, 0.95, 1], 7, 0.4, 0.07, 1);
      this.blasts.push({ pos: p, t: 0.25, size: 0.5, col: [0.5, 0.95, 1] });
      return;
    }
    if (s.kind === 'rocket') { this.blastAll(p, S.rocketR, S.rocketDmg, 16, 'rocket'); this.boom(p, 1.2); return; }
    if (s.kind === 'bomb') { this.blastAll(p, 10, 420, 18, 'bomb'); this.boom(p, 2.2); this.fires.push({ pos: p, r: 9, t: 8, tick: 0 }); return; }
    if (s.kind === 'bomblet') { this.blastAll(p, 7, 320, 15, 'bomb'); this.boom(p, 1.3); this.fires.push({ pos: p, r: 5, t: 5, tick: 0 }); }
  }

  // door guns: AI gunners (the upgrade, or GUNNER crew with rifles) or friends online, who aim themselves
  doorSeats() {
    const g = this.S.gunners, gunners = count(this.save.crew, 'gunner');
    return [0, 1].map((sd) => {
      const fr = this.coop && [...this.coop.friends.values()].find((f) => f.seat === sd);
      if (fr) return { friend: fr, rate: 11, dmg: 26 };
      if (sd < g) return { ai: true, rate: gunners ? 13 : 9, dmg: 24 };
      if (sd < g + gunners) return { ai: true, rate: 6, dmg: 15, rifle: true };
      return null;
    });
  }
  doorGuns(dt) {
    const H = this.heli, seats = this.doorSeats();
    const inv = [-H.q[0], -H.q[1], -H.q[2], H.q[3]];
    for (let sd = 0; sd < 2; sd++) {
      const seat = seats[sd];
      this.doorFlash[sd] = Math.max(0, this.doorFlash[sd] - dt);
      if (!seat || H.dead || this.mode === 'down') continue;
      const side = sd === 0 ? 1 : -1, a = this.doorAim[sd];
      this.doorT[sd] -= dt;
      let fire = false;
      if (seat.friend) {
        const f = seat.friend;
        a[0] += Math.atan2(Math.sin(f.aim[0] - a[0]), Math.cos(f.aim[0] - a[0])) * Math.min(1, dt * 20); a[1] += (f.aim[1] - a[1]) * Math.min(1, dt * 20);
        fire = f.fire;
      } else {
        let tg = this.doorTgt[sd];
        if (!tg || !tg.alive || this.doorT[sd] < -0.6) {
          tg = null; let best = 75;
          for (const z of this.horde.list) {
            if (!z.alive) continue;
            const v = [z.x - H.pos[0], z.y + z.s - H.pos[1], z.z - H.pos[2]], l = Math.hypot(v[0], v[1], v[2]);
            const lx = qrot(inv, v)[0];
            if (lx * side < 0.5 && z.st !== 'grab') continue;
            const sc = z.st === 'grab' ? 0 : l - (z.st === 'climb' ? 25 : 0) - (z.type === 'spitter' ? 15 : 0);
            if (sc < best) { best = sc; tg = z; }
          }
          this.doorTgt[sd] = tg; this.doorT[sd] = 0;
        }
        if (!tg) continue;
        const mp = H.toWorld([side * 1.25, 0.1, 0.6]);
        const lv = qrot(inv, [tg.x - mp[0], tg.y + tg.s * 1.1 - mp[1], tg.z - mp[2]]), ll = Math.hypot(...lv);
        const yaw = Math.atan2(-lv[0], -lv[2]), pitch = Math.asin(clamp(lv[1] / ll, -1, 1));
        a[0] += Math.atan2(Math.sin(yaw - a[0]), Math.cos(yaw - a[0])) * Math.min(1, dt * 8); a[1] += (clamp(pitch, -1.3, 0.5) - a[1]) * Math.min(1, dt * 8);
        fire = true;
      }
      if (fire && this.doorT[sd] <= -1 / seat.rate) {
        this.doorT[sd] = 0;
        const dl = qrot(H.q, [-Math.sin(a[0]) * Math.cos(a[1]), Math.sin(a[1]), -Math.cos(a[0]) * Math.cos(a[1])]);
        const o = H.toWorld([side * 1.25, 0.1, 0.6]).map((c, i) => c + dl[i] * 1.5);
        const spr = seat.friend ? 0.025 : 0.05;
        const dir = norm([dl[0] + (Math.random() - 0.5) * spr, dl[1] + (Math.random() - 0.5) * spr, dl[2] + (Math.random() - 0.5) * spr]);
        const h = this.rayHit(o, dir, 180);
        this.tracer(o, dir, h.t, seat.friend ? sd : -1);
        this.doorFlash[sd] = 0.05;
        if (h.z) { const k = this.horde.damage(h.z, seat.dmg, [dir[0] * 5, 2, dir[2] * 5], seat.friend ? `friend${sd}` : 'door'); if (k && seat.friend) seat.friend.kills++; }
        else if (h.sh) h.sh.hit(seat.dmg, this);
        else if (h.w) this.fx.impact(h.p, h.w.normal, h.w.box.color);
        this.snd.burst?.(0.05, seat.rifle ? 2200 : 1200, 0.12);
      }
    }
  }

  turrets(dt) {
    for (const f of this.fobs) for (const tu of f.turrets) {
      tu.flash = Math.max(0, tu.flash - dt);
      tu.cd -= dt;
      if (f.wrecked || Math.abs(tu.pos[0] - this.heli.pos[0]) > 400 || Math.abs(tu.pos[2] - this.heli.pos[2]) > 400) continue;
      let tg = null, best = 75;
      for (const z of this.horde.list) { if (!z.alive || z.st === 'grab') continue; const d = Math.hypot(z.x - tu.pos[0], z.z - tu.pos[2]); if (d < best) { best = d; tg = z; } }
      if (!tg) continue;
      const want = Math.atan2(-(tg.x - tu.pos[0]), -(tg.z - tu.pos[2]));
      tu.yaw += Math.atan2(Math.sin(want - tu.yaw), Math.cos(want - tu.yaw)) * Math.min(1, dt * 5);
      if (tu.cd <= 0) {
        tu.cd = 0.18;
        const o = [tu.pos[0] - Math.sin(tu.yaw) * 1.4, tu.pos[1], tu.pos[2] - Math.cos(tu.yaw) * 1.4];
        const dir = norm([tg.x - o[0] + (Math.random() - 0.5), tg.y + tg.s - o[1], tg.z - o[2] + (Math.random() - 0.5)]);
        const zh = this.horde.hitRay(o, dir, 100);
        this.tracer(o, dir, zh ? zh.t : best, -1);
        tu.flash = 0.05;
        if (zh) this.horde.damage(zh.z, 14, [dir[0] * 4, 2, dir[2] * 4], 'turret');
      }
    }
  }

  // wrecked bases come back after a while
  fobTick(dt) {
    for (const f of this.fobs) if (f.wrecked) { f.wreckT -= dt; if (f.wreckT <= 0) { f.wrecked = false; f.hp = f.max * 0.6; this.feed(`${f.name} IS BACK UP`, 'g'); } }
  }

  // a trickle of zombies round you so the world never feels empty
  ambientSpawns(dt) {
    this.ambSpawnT = (this.ambSpawnT || 0) - dt;
    if (this.ambSpawnT > 0) return;
    this.ambSpawnT = 0.5;
    const H = this.heli.pos, n = this.horde.list.filter((z) => !z.ev && !z.siege).length;
    if (n >= Math.min(140, 50 + this.run.t * 0.08) || this.horde.list.length > 300) return;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = 110 + Math.random() * 140, x = H[0] + Math.cos(a) * r, z = H[2] + Math.sin(a) * r;
      if (Math.abs(x) > WORLD - 10 || Math.abs(z) > WORLD - 10 || this.horde.blockedAt(x, z)) continue;
      if (this.fobs.some((f) => Math.hypot(f.padAt[0] - x, f.padAt[2] - z) < 60)) continue;
      const t = this.run.t, r2 = Math.random();
      this.horde.spawn(t > 90 && r2 < 0.15 ? 'runner' : t > 45 && r2 > 0.94 ? 'spitter' : t > 200 && r2 > 0.91 && r2 < 0.94 ? 'brute' : 'walker', x, z);
      return;
    }
  }

  // ---------------------------------------------------------------- landing: what you can do where you are
  landing(dt) {
    const H = this.heli, S = this.S, crew = this.save.crew;
    const ok = !H.dead && this.mode === 'fly', spd = Math.hypot(...H.vel);
    const settled = ok && H.contacts >= 2 && spd < 3.5;
    // forgiving: anywhere over (or just next to) the roof / pad, low and slow, counts. You don't even have to touch down.
    const near = (b, up) => {
      const h = H.pos[1] - 1.92 - b.max[1];
      return ok && spd < 6 && H.pos[0] > b.min[0] - 4 && H.pos[0] < b.max[0] + 4 && H.pos[2] > b.min[2] - 4 && H.pos[2] < b.max[2] + 4 && h > -2 && h < up;
    };
    this.atFob = this.fobs.find((f) => near(f.pad, 6)) || null;
    this.atRoof = this.director.list.find((e) => e.kind === 'rescue' && e.roof.active && e.roof.count > 0 && near(e.roof.box, 12)) || null;
    this.nearCrate = ok && spd < 6 ? this.director.list.find((e) => e.kind === 'crate' && e.landed && !e.carried && Math.hypot(e.x - H.pos[0], e.z - H.pos[2]) < 20 && H.pos[1] - e.y < 14) || null : null;
    this.settled = settled;
    const seatsFree = Math.max(2, S.seats - crew.length) - this.riders;
    const acts = [];
    if (this.atRoof) acts.push(['KeyE', 'E', this.boarding ? `LOADING… ${this.atRoof.roof.count} LEFT` : seatsFree <= 0 ? 'CABIN FULL' : `PICK UP ${this.atRoof.roof.count}`, () => { this.boarding = true; }]);
    const f = this.atFob;
    if (f && !f.wrecked) {
      if (this.riders > 0 && !f.fuelOnly) acts.push(['KeyE', 'E', this.unloading ? 'DROPPING OFF…' : `DROP OFF ${this.riders}`, () => { this.unloading = true; }]);
      if (this.crate && this.crate.carried && !f.fuelOnly) acts.push(['KeyE', 'E', 'DROP THE CRATE', () => this.deliverCrate()]);
      const pct = (v) => `${Math.round(v * 100)}%`;
      acts.push(['Digit1', '1', this.fuel >= S.fuel - 0.5 ? 'FUEL FULL' : this.svc === 'fuel' ? `REFUELLING ${pct(this.fuel / S.fuel)}` : `REFUEL (${pct(this.fuel / S.fuel)})`, () => { this.svc = 'fuel'; this.snd.click?.(1800, 0.3); }, this.fuel >= S.fuel - 0.5]);
      if (!f.fuelOnly) {
        acts.push(['Digit2', '2', this.hp >= S.hp ? 'NO DAMAGE' : this.svc === 'fix' ? `REPAIRING ${pct(this.hp / S.hp)}` : `REPAIR (${pct(this.hp / S.hp)})`, () => { this.svc = 'fix'; this.snd.click?.(1800, 0.3); }, this.hp >= S.hp]);
        const full = this.rockets >= S.rockets && this.bombs >= S.bombs && this.heat <= 0;
        acts.push(['Digit3', '3', full ? 'ARMED' : 'REARM', () => { this.rockets = S.rockets; this.bombs = S.bombs; this.heat = 0; this.overT = 0; this.snd.magIn?.(); setTimeout(() => this.snd.bolt?.(), 200); this.feed('REARMED', 'g'); }, full]);
        acts.push(['KeyH', 'H', 'HANGAR', () => { this.session.fob = f; this.toHangar(); }, true]);
      }
    } else if (f && f.wrecked) this.svc = null;
    if (this.nearCrate && !this.crate) acts.push(['KeyE', 'E', 'HOOK ON THE CRATE', () => { this.crate = this.nearCrate; this.crate.carried = true; this.feed('CRATE HOOKED ON · TAKE IT TO A BASE', 'y'); this.snd.grab?.(); }]);
    if (settled && !f && !this.scav && (this.riders > 0 || has(crew, 'scavenger'))) acts.push(['KeyQ', 'Q', 'SEND FOR FUEL', () => this.sendForFuel(), true]);
    if (settled && !f && !this.drop && this.fuel < S.fuel * 0.3) acts.push(['KeyG', 'G', 'FUEL DROP ⚙150', () => this.callDrop(), true]);
    // quick service: fuel and repairs fill up in about a second
    if (!f || f.wrecked) this.svc = null;
    if (this.svc === 'fuel') { this.fuelUp(S.fuel * 1.2 * dt); if (this.fuel >= S.fuel) { this.svc = null; this.feed('TANK FULL', 'g'); this.snd.checkpoint?.(); } }
    if (this.svc === 'fix') { this.hp = Math.min(S.hp, this.hp + S.hp * 1.2 * dt * (has(crew, 'mechanic') ? 1.5 : 1)); if (this.hp >= S.hp) { this.svc = null; this.feed('ALL FIXED', 'g'); this.snd.checkpoint?.(); } }
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
      this.run.lost += this.scav.team.filter((m) => !m.crew).length;
      for (const m of this.scav.team) if (m.crew) this.save.crew = this.save.crew.filter((c) => c !== m.crew);
      this.feed(`YOU LEFT ${n} ${n === 1 ? 'PERSON' : 'PEOPLE'} BEHIND`, 'r');
      this.scav = null;
    }
    // boarding
    if (this.boarding && this.atRoof) {
      const r = this.atRoof.roof;
      this.boardT -= dt;
      if (seatsFree <= 0) { this.boarding = false; this.feed('CABIN FULL · FLY TO A BASE', 'y'); }
      else if (r.count <= 0) this.boarding = false;
      else if (this.boardT <= 0) {
        this.boardT = 0.3;
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
          this.unloadT = 0.2; this.riders--; this.run.rescued++; this.save.rescued++;
          this.addScrap(Math.round(25 * (has(crew, 'medic') ? 1.25 : 1)));
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
    // mechanics patch you up in the air
    if (!f && count(crew, 'mechanic') && this.hp < S.hp && !H.dead) this.hp = Math.min(S.hp, this.hp + 3 * count(crew, 'mechanic') * dt);
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
        this.fuelUp(70); this.drop = null; this.fx.dust([d.x, g, d.z], 12);
        this.feed('FUEL DROP RECEIVED · +70 FUEL', 'g'); this.snd.checkpoint?.();
      }
    }
    for (let i = this.runners.length - 1; i >= 0; i--) { const r = this.runners[i]; r.t += dt * (r.slow ? 0.25 : 1.6); if (r.t >= 1) this.runners.splice(i, 1); }
  }

  sendForFuel() {
    const crew = this.save.crew, H = this.heli;
    const team = [];
    for (let i = 0; i < this.riders; i++) team.push({ name: randName() });
    for (const c of crew) if (c.role === 'scavenger') team.push({ name: c.name, crew: c });
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
    const sc = this.scav, crew = this.save.crew, H = this.heli;
    this.scav = null;
    const nearZ = this.horde.list.filter((z) => z.alive && Math.hypot(z.x - sc.x, z.z - sc.z) < 70).length;
    const medic = has(crew, 'medic');
    let back = 0, fuel = 0;
    const died = [];
    for (const m of sc.team) {
      let p = m.crew ? 0.08 : clamp(0.25 + nearZ * 0.012, 0.25, 0.7);
      if (medic) p *= 0.5;
      if (Math.random() < p) { died.push(m); if (m.crew) this.save.crew = this.save.crew.filter((c) => c !== m.crew); else this.run.lost++; continue; }
      fuel += m.crew ? 40 : 14;
      if (!m.crew) back++;
    }
    this.riders += back;
    this.fuelUp(fuel);
    for (const m of died) this.feed(`${m.name}${m.crew ? ` (${ROLES[m.crew.role].n})` : ''} DIDN'T MAKE IT BACK`, 'r');
    this.banner(fuel ? `+${Math.round(fuel)} FUEL` : 'NO FUEL FOUND', `${sc.team.length - died.length} OF ${sc.team.length} CAME BACK`, died.length ? 'bad' : 'good', 2.6);
    if (died.length) this.snd.fail?.(); else this.snd.checkpoint?.();
  }
  callDrop() {
    if (this.save.scrap < 150) { this.feed('NOT ENOUGH SCRAP FOR A FUEL DROP (150)', 'r'); this.snd.fail?.(); return; }
    this.save.scrap -= 150;
    const H = this.heli.pos, a = Math.random() * 6.28;
    this.drop = { x: H[0] + Math.cos(a) * 9, y: H[1] + 70, z: H[2] + Math.sin(a) * 9 };
    this.feed('FUEL DROP ON ITS WAY · HOLD ON', 'y');
    this.snd.checkpoint?.();
  }
  deliverCrate() {
    const c = this.crate;
    c.carried = false; c.done = true; this.crate = null;
    this.addScrap(250); this.fuelUp(this.S.fuel);
    this.save.events = (this.save.events || 0) + 1;
    this.banner('CRATE DELIVERED', '+250 SCRAP · FUEL TOPPED UP', 'good', 2.2); this.snd.finish?.();
  }

  addScrap(n) { this.run.scrap += n; this.save.scrap += n; }
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
    const lookout = has(this.save.crew, 'lookout');
    for (const ev of this.horde.events) {
      if (ev.type === 'kill') {
        run.kills++;
        const T = TYPES[ev.z.type];
        this.addScrap(T.scrap);
        if (this.nfx) this.nfx.push(['k', q1(ev.z.x), q1(ev.z.y), q1(ev.z.z), ZT.indexOf(ev.z.type)]);
        if (ev.z.type === 'brute') this.feed(`BRUTE DOWN · +${T.scrap}`, 'y');
        if (ev.z.type === 'titan') {
          const p = [ev.z.x, 8, ev.z.z];
          for (let i = 0; i < 6; i++) setTimeout(() => this.boom([p[0] + (Math.random() - 0.5) * 16, 2 + Math.random() * 14, p[2] + (Math.random() - 0.5) * 16], 2.5), i * 220);
          this.save.titans++;
          this.banner('TITAN DOWN', `+${T.scrap} SCRAP`, 'good', 3.5);
          this.snd.finish?.();
        }
      } else if (ev.type === 'eaten') {
        run.lost++;
        this.feed('A SURVIVOR WAS GRABBED', 'r');
        if (ev.roof.count <= 0) { ev.roof.active = false; this.banner('SURVIVORS LOST', 'THE ZOMBIES GOT TO THEM FIRST', 'bad', 2); this.snd.fail?.(); }
      } else if (ev.type === 'hitHeli') {
        if (this.mode === 'down') continue;
        this.hurt(ev.shot.dmg * (ev.shot.kind === 'glob' && lookout ? 0.7 : 1), ev.shot.pos);
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
      } else if (ev.type === 'hitTarget') {
        const e = this.director.list.find((x) => (x.trucks && x.trucks.includes(ev.tgt)) || x.tgt === ev.tgt);
        if (e && e.hitTarget) e.hitTarget(ev.tgt, ev.dmg, this);
      } else if (ev.type === 'spit') { if (lookout && Math.hypot(ev.z.x - H.pos[0], ev.z.z - H.pos[2]) < 90) this.feed('LOOKOUT: ACID INCOMING!', 'y'); }
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
      for (const e of this.director.list) if (e.kind === 'rescue' && e.roof.count > 0 && Math.abs(e.x - ce[0]) < 300 && Math.abs(e.z - ce[2]) < 300) this.fx.sparks([e.x + 3, e.roof.top + 0.6, e.z + 3], 1, [0.3, 1, 0.3], 1.5, 0.8, 0.12, 4);
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
      if (this.mode !== 'fly' && this.mode !== 'gunner') return;
      this.mode = this.mode === 'gunner' ? 'gpause' : 'pause';
      const gun = this.mode === 'gpause';
      p.innerHTML = `<h2>PAUSED</h2><p>${gun ? 'You\'re still in the door. The pilot keeps flying.' : this.coop ? 'Your friends are still flying with you — the game keeps going.' : 'Your chopper is hovering. Zombies are waiting.'}</p>
        <div class="row"><button class="alt" data-x="gfx" type="button">GRAPHICS: ${this.save.gfx === 'low' ? 'LOW' : 'AUTO'}</button></div><div class="row"><button data-x="resume" type="button">RESUME</button>${gun ? '' : '<button class="alt" data-x="team" type="button">TEAM</button>'}<button class="alt" data-x="quit" type="button">${gun ? 'LEAVE' : 'QUIT TO TITLE'}</button></div>`;
      p.querySelector('[data-x=gfx]').onclick = (e) => { this.save.gfx = this.save.gfx === 'low' ? 'auto' : 'low'; if (this.save.gfx !== 'low') { this.r.resScale = 1; this.noShadow = false; } saveSave(this.save); e.target.textContent = `GRAPHICS: ${this.save.gfx === 'low' ? 'LOW' : 'AUTO'}`; };
      p.querySelector('[data-x=resume]').onclick = () => { this.pause(false); this.lock(); };
      p.querySelector('[data-x=team]')?.addEventListener('click', () => { this.pause(false); this.openTeam(); });
      p.querySelector('[data-x=quit]').onclick = () => { this.pause(false); this.close(); };
      p.classList.remove('hidden'); this.stopAudio();
    } else if (this.mode === 'pause' || this.mode === 'gpause') { this.mode = this.mode === 'gpause' ? 'gunner' : 'fly'; p.classList.add('hidden'); this.startAudio(); }
  }

  // ---------------------------------------------------------------- the TEAM screen: crew and friends
  openTeam() {
    const panel = this.$('panel');
    this.panel = 'team';
    if (this.locked) this.unlockSoft();
    const s = this.save, max = statsFor(s.eq).crewMax;
    const atBase = this.mode === 'hangar' || (this.atFob && !this.atFob.fuelOnly);
    const card = (m, btn) => `<div class="da-cm" style="--c:rgb(${ROLES[m.role].col.map((v) => Math.round(v * 255))})"><small>${ROLES[m.role].n}</small><b>${m.name}</b><p>${ROLES[m.role].d}</p>${btn}</div>`;
    const friends = this.coop ? [...this.coop.friends.values()] : [];
    panel.innerHTML = `<button class="alt close" data-x="close" type="button">CLOSE ✕</button><h2>YOUR TEAM</h2>
      <h3>CREW · ${s.crew.length} / ${max}</h3><p>Crew ride up front and take a seat each. Get more crew seats with a bigger CABIN.</p>
      <div class="da-crew">${s.crew.map((m, i) => card(m, `<button class="alt" data-dismiss="${i}" type="button">DISMISS</button>`)).join('') || '<p>Nobody yet. Survivors you drop off at a base sometimes offer to join.</p>'}</div>
      <h3>VOLUNTEERS AT THE BASES</h3>${atBase ? '' : '<p style="color:#ffcf3a">LAND AT A BASE (OR GO TO THE HANGAR) TO RECRUIT THEM.</p>'}
      <div class="da-crew">${s.pool.map((m, i) => card(m, `<button data-recruit="${i}" type="button" ${s.crew.length >= max || !atBase ? 'disabled' : ''}>RECRUIT</button>`)).join('') || '<p>No volunteers right now. Rescue more people!</p>'}</div>
      <h3>FRIENDS ONLINE</h3>
      ${this.coop ? `<p>Your friends type this code on the DEAD AIR title screen (JOIN A FRIEND):</p><div class="da-code">${this.coop.code}</div>
        <p>${friends.length ? friends.map((f) => `${f.name || 'FRIEND'} · ${f.seat === 0 ? 'RIGHT' : 'LEFT'} DOOR · ${f.kills} KILLS`).join('<br>') : 'Waiting for friends… (up to 2, they ride in the doors as gunners)'}</p>
        <button class="alt" data-x="stophost" type="button">STOP PLAYING ONLINE</button>`
      : '<p>Up to two friends can ride in your doors as gunners, aiming and shooting themselves.</p><button data-x="host" type="button">INVITE FRIENDS</button>'}
      <p data-x="netmsg"></p>`;
    panel.classList.remove('hidden');
    panel.querySelector('[data-x=close]').onclick = () => this.closePanel();
    panel.querySelectorAll('[data-dismiss]').forEach((b) => { if (!atBase) b.disabled = true; b.onclick = () => { const m = s.crew.splice(+b.dataset.dismiss, 1)[0]; if (s.pool.length < 6) s.pool.push(m); saveSave(s); this.openTeam(); }; });
    panel.querySelectorAll('[data-recruit]').forEach((b) => { b.onclick = () => { if (s.crew.length >= max) return; s.crew.push(s.pool.splice(+b.dataset.recruit, 1)[0]); saveSave(s); this.snd.checkpoint?.(); this.openTeam(); if (this.mode === 'hangar') this.renderHangar(); }; });
    panel.querySelector('[data-x=host]')?.addEventListener('click', () => this.startHosting().then(() => this.openTeam(), (e) => { const m = panel.querySelector('[data-x=netmsg]'); if (m) m.textContent = e.message; }));
    panel.querySelector('[data-x=stophost]')?.addEventListener('click', () => { this.stopCoop(); this.openTeam(); });
  }
  closePanel() { this.panel = null; this.$('panel').classList.add('hidden'); }

  // ---------------------------------------------------------------- online: the pilot's side
  async startHosting() {
    if (this.coop) return;
    const tr = makeTransport(), code = code5();
    const msg = this.$('panel').querySelector('[data-x=netmsg]'); if (msg) msg.textContent = 'CONNECTING…';
    await tr.listen(code);
    this.coop = { tr, code, friends: new Map(), hsT: 0, zsT: 0, evT: 0, fxT: 0 };
    this.nfx = [];
    tr.onPeer = (id) => {
      const used = new Set([...this.coop.friends.values()].map((f) => f.seat));
      const seat = !used.has(0) ? 0 : !used.has(1) ? 1 : -1;
      if (seat < 0) { tr.sendTo(id, { k: 'full' }); tr.kick?.(id); return; }
      this.coop.friends.set(id, { id, seat, aim: [seat === 0 ? -Math.PI / 2 : Math.PI / 2, -0.3], fire: false, kills: 0, name: 'FRIEND', col: FRIEND_COLS[seat] });
      tr.sendTo(id, { k: 'init', seat, eq: this.save.eq, paint: this.save.paint });
      this.feed(`A FRIEND JOINED · ${seat === 0 ? 'RIGHT' : 'LEFT'} DOOR`, 'g'); this.snd.checkpoint?.();
      if (this.panel === 'team') this.openTeam();
    };
    tr.onData = (id, m) => {
      const f = this.coop?.friends.get(id); if (!f || !m) return;
      if (m.k === 'aim') { f.aim = [clamp(+m.a[0] || 0, -Math.PI, Math.PI), clamp(+m.a[1] || 0, -1.4, 0.6)]; f.fire = !!m.f; }
      else if (m.k === 'hi') { f.name = String(m.name || 'FRIEND').slice(0, 14).toUpperCase(); if (this.panel === 'team') this.openTeam(); }
    };
    tr.onLeave = (id) => { const f = this.coop?.friends.get(id); if (!f) return; this.coop.friends.delete(id); this.feed(`${f.name} LEFT`, 'y'); if (this.panel === 'team') this.openTeam(); };
  }
  stopCoop() {
    if (this.coop) { try { this.coop.tr.close(); } catch { /* ignore */ } }
    this.coop = null; this.nfx = null;
    if (this.client) { try { this.client.tr.close(); } catch { /* ignore */ } this.client = null; }
  }
  coopHostTick(dt) {
    const C = this.coop;
    if (!C || !C.friends.size) { if (this.nfx) this.nfx.length = 0; return; }
    const send = (m) => { for (const id of C.friends.keys()) C.tr.sendTo(id, m); };
    C.hsT -= dt; C.zsT -= dt; C.evT -= dt; C.fxT -= dt;
    const H = this.mode === 'hangar' ? this.hangarHeli : this.heli, S = this.S || statsFor(this.save.eq);
    if (C.hsT <= 0) {
      C.hsT = 1 / 20;
      send({ k: 'hs', t: Math.round(performance.now()), p: H.pos.map(q2), q: H.q.map((v) => Math.round(v * 1000) / 1000), v: H.vel.map(q1), rpm: q2(H.rpm), b: q2(H.boost || 0),
        hp: Math.round(this.hp || 0), fu: Math.round(this.fuel || 0), rd: this.riders || 0,
        da: (this.doorAim || []).map((a) => a.map(q2)), df: (this.doorFlash || [0, 0]).map((v) => (v > 0 ? 1 : 0)),
        fl: this.flashT > 0 ? 1 : 0, sp: q1(this.spin || 0), m: this.mode === 'hangar' ? 'h' : this.mode === 'down' ? 'd' : 'f' });
    }
    // the things that hardly change, once a second
    C.hxT = (C.hxT ?? 0) - dt;
    if (C.hxT <= 0) {
      C.hxT = 1;
      send({ k: 'hx', hpm: S.hp, fum: S.fuel, cr: this.save.crew.map((c) => ROLE_IDS.indexOf(c.role)), sc: this.save.scrap, kl: this.run?.kills || 0,
        fr: [...C.friends.values()].map((f) => [f.seat, f.kills]), eq: this.save.eq, pt: this.save.paint, rk: this.rockets, bm: this.bombs });
    }
    if (C.zsT <= 0 && this.mode !== 'hangar') {
      C.zsT = 1 / 10;
      const P = H.pos, near = this.horde.list.filter((z) => z.alive && Math.abs(z.x - P[0]) < 200 && Math.abs(z.z - P[2]) < 200);
      near.sort((a, b) => Math.abs(a.x - P[0]) + Math.abs(a.z - P[2]) - Math.abs(b.x - P[0]) - Math.abs(b.z - P[2]));
      const out = [];
      for (const z of near.slice(0, 70)) {
        if (!z.nid) z.nid = (this.nidN = (this.nidN || 0) + 1);
        out.push(z.nid, Math.round(z.x * 10), Math.round(z.y * 10), Math.round(z.z * 10), Math.round(z.yaw * 100), ZT.indexOf(z.type), ZS.indexOf(z.st), z.hitT > 0 ? 1 : 0);
      }
      if (this.titanEv()) { const T = this.titanEv().z0; out.push(-1, Math.round(T.hp), Math.round(T.max)); }
      send({ k: 'zs', t: Math.round(performance.now()), z: out });
    }
    if (C.evT <= 0 && this.mode !== 'hangar') {
      C.evT = 1 / 4;
      send({ k: 'ev', e: this.director.list.map((e) => ({ ...e.net(), mk: e.marker(this) })), sh: this.shots.filter((s) => s.kind === 'rocket' || s.kind === 'bomb' || s.kind === 'plasma').map((s) => [s.kind[0], ...s.pos.map(q1), ...s.vel.map(q1)]) });
    }
    if (this.nfx && this.nfx.length && C.fxT <= 0) { C.fxT = 1 / 15; send({ k: 'fx', f: this.nfx.splice(0, 80) }); this.nfx.length = 0; }
  }
  titanEv() { return this.director.list.find((e) => e.kind === 'titan' && e.z0.alive); }

  // ---------------------------------------------------------------- online: a friend's side (riding in the door)
  showJoin() {
    this.load();
    const j = this.$('join');
    this.active = true; this.mode = 'joining';
    this.root.classList.remove('hidden');
    for (const k of ['hangar', 'hud', 'pause', 'end']) this.$(k).classList.add('hidden');
    let name = ''; try { name = localStorage.getItem('deadair.name') || ''; } catch { /* ignore */ }
    j.innerHTML = `<div class="da-card"><h2>JOIN A FRIEND</h2><p>Type the code from your friend's TEAM screen. You'll ride in a door and work the gun.</p>
      <input data-x="code" maxlength="5" placeholder="CODE" autocomplete="off"><br><input data-x="name" maxlength="12" placeholder="YOUR NAME" value="${name.replace(/[^\w ]/g, '')}" style="font-size:22px;letter-spacing:.1em;width:260px">
      <p data-x="msg"></p><div class="row"><button data-x="go" type="button">JOIN</button><button class="alt" data-x="back" type="button">BACK</button></div></div>`;
    j.classList.remove('hidden');
    const code = j.querySelector('[data-x=code]'), msg = j.querySelector('[data-x=msg]');
    code.focus();
    const go = async () => {
      const c = code.value.trim().toUpperCase(), nm = j.querySelector('[data-x=name]').value.trim().slice(0, 12) || 'FRIEND';
      try { localStorage.setItem('deadair.name', nm); } catch { /* ignore */ }
      if (c.length !== 5) { msg.textContent = 'THE CODE IS 5 LETTERS.'; return; }
      msg.textContent = 'CONNECTING…';
      try { await this.joinCoop(c, nm, (t) => { msg.textContent = t; }); } catch (e) { msg.textContent = e.message || 'COULDN\'T JOIN.'; }
    };
    j.querySelector('[data-x=go]').onclick = go;
    code.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    j.querySelector('[data-x=back]').onclick = () => { j.classList.add('hidden'); this.close(); };
  }
  async joinCoop(code, name, onStatus) {
    const tr = makeTransport();
    const cl = this.client = { tr, seat: 0, heli: null, zs: new Map(), evs: [], shots: [], aim: [0, -0.3], sendT: 0, fire: false, kills: 0, hs: null };
    tr.onData = (m) => this.clientData(m);
    tr.onLeave = () => { if (this.client !== cl) return; this.client = null; this.close(); setTimeout(() => alert('The pilot left the game.'), 50); };
    await tr.connect(code, onStatus);
    tr.send({ k: 'hi', name });
    onStatus?.('WAITING FOR THE PILOT…');
  }
  clientData(m) {
    const cl = this.client; if (!cl || !m) return;
    if (m.k === 'full') { this.$('join').querySelector('[data-x=msg]').textContent = 'BOTH DOORS ARE TAKEN.'; return; }
    if (m.k === 'init') {
      cl.seat = m.seat; cl.eq = m.eq; cl.paint = m.paint;
      cl.aim = [m.seat === 0 ? -Math.PI / 2 : Math.PI / 2, -0.3];
      cl.heli = new Chopper(); cl.heli.reset([0, 50, 0], 0, statsFor(m.eq));
      this.horde.clear(); this.fx.clear(); this.blasts = []; this.tracers = []; this.runners = [];
      this.$('join').classList.add('hidden'); this.$('hud').classList.remove('hidden');
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
    if (m.k === 'hx') { cl.hx = m; cl.hs = Object.assign(cl.hs || {}, m); }
    if (m.k === 'hs') {
      cl.hs = Object.assign({ hpm: 1, fum: 1, cr: [], fr: [], kl: 0, sc: 0, rk: 0, bm: 0 }, cl.hx || {}, m);
      cl.hb = cl.hb || [];
      if (!cl.hb.length || m.t > cl.hb[cl.hb.length - 1].t) cl.hb.push({ t: m.t, p: m.p, q: m.q, v: m.v });
      if (cl.hb.length > 30) cl.hb.shift();
    }
    else if (m.k === 'zs') {
      const seen = new Set(), z = m.z;
      let i = 0;
      while (i < z.length) {
        if (z[i] === -1) { cl.titan = [z[i + 1], z[i + 2]]; i += 3; continue; }
        const id = z[i];
        let p = cl.zs.get(id);
        const type = ZT[z[i + 5]] || 'walker';
        if (!p) {
          p = this.horde.spawn(type, z[i + 1] / 10, z[i + 3] / 10); p.nid = id; p.y = z[i + 2] / 10; p.yaw = z[i + 4] / 100;
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
    } else if (m.k === 'ev') { cl.evs = m.e || []; cl.shots = m.sh || []; }
    else if (m.k === 'fx') {
      for (const f of m.f || []) {
        if (f[0] === 't') { if (f[8] !== cl.seat) this.tracers.push({ from: [f[1], f[2], f[3]], dir: [f[4], f[5], f[6]], len: f[7], d: 0 }); }
        else if (f[0] === 'b') { this.blasts.push({ pos: [f[1], f[2], f[3]], t: 0, size: f[4] }); this.boomFx([f[1], f[2], f[3]], f[4]); }
        else if (f[0] === 'k') {
          const p = [...cl.zs.values()].find((z) => Math.abs(z.x - f[1]) < 1.5 && Math.abs(z.z - f[3]) < 1.5) || this.horde.spawn(ZT[f[4]] || 'walker', f[1], f[3]);
          p.y = f[2]; this.horde.kill(p, [0, 3, 0]); this.horde.events.length = 0;
          if (p.nid != null) cl.zs.delete(p.nid);
        } else if (f[0] === 'f') this.feed(f[1], f[2]);
        else if (f[0] === 'B') this.banner(f[1], f[2], f[3], f[4]);
      }
    }
  }
  gunnerFrame(dt) {
    const cl = this.client;
    if (!cl || !cl.heli) return;
    const H = cl.heli, hs = cl.hs;
    // play everything back a little in the past, smoothly between the updates either side of that moment
    // (updates over the internet arrive in uneven clumps; chasing the newest one is what made it stutter)
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
      if (hs.eq) cl.eq = hs.eq; if (hs.pt) cl.paint = hs.pt;
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
    const gunAt = H.toWorld([side * 1.25, 0.1, 0.6]);
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
      rotorA: H.rotorA, tailA: H.tailA, rpm: H.rpm, spin: hs ? hs.sp : 0, t: this.t, riders: hs ? hs.rd : 0, boost: H.boost,
      crew: hs ? hs.cr.map((r) => ({ col: (ROLES[ROLE_IDS[r]] || ROLES.gunner).col })) : [],
      doorAim: [0, 1].map((sd) => (sd === cl.seat ? cl.aim : hs && hs.da[sd] ? hs.da[sd] : [sd === 0 ? -1.57 : 1.57, -0.3])),
      doorFlash: [0, 1].map((sd) => (sd === cl.seat ? cl.flash : hs ? hs.df[sd] * 0.05 : 0)),
      doorFriend: [0, 1].map((sd) => (sd === cl.seat ? { col: FRIEND_COLS[sd], self: true } : hs && hs.fr.some((f) => f[0] === sd) ? { col: FRIEND_COLS[sd] } : null)),
      flash: hs && hs.fl ? 0.04 : 0, rockets: hs ? hs.rk : 0, rocketMax: statsFor(cl.eq).rockets, bombs: hs ? hs.bm : 0, bombMax: statsFor(cl.eq).bombs,
    };
    const parts = hs && hs.m === 'd' ? [] : chopperParts(cl.eq, PAINT[cl.paint] || PAINT.olive, st, H.H);
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
    this.markers(cl.evs.map((e) => e.mk), cl.heli.pos);
    this.minimap(cl.heli.pos, cl.heli.heading, cl.evs.map((e) => e.mk), [...cl.zs.values()]);
    this.eventsList(cl.evs.map((e) => e.mk), cl.heli.pos);
    const boss = this.$('boss');
    boss.classList.toggle('hidden', !cl.titan);
    if (cl.titan) boss.style.setProperty('--p', (cl.titan[0] / cl.titan[1]).toFixed(3));
    cl.titan = null;
  }

  // ---------------------------------------------------------------- camera, HUD, sound
  camera(dt) {
    const H = this.heli;
    const f = H.fwd, fl = Math.hypot(f[0], f[2]) || 1, ff = [f[0] / fl, 0, f[2] / fl];
    const sp = Math.hypot(...H.vel);
    let eye, look;
    if (this.camMode === 2) { eye = H.toWorld([0, -0.2, -3.9]); look = this.bore().d; }
    else {
      const far = this.camMode === 1;
      const dive = Math.max(0, -H.pitch);
      const dist = (far ? 30 : 18) + sp * 0.06, hgt = (far ? 14 : 9) + dive * (far ? 16 : 12);
      const want = [H.pos[0] - ff[0] * dist, H.pos[1] + hgt, H.pos[2] - ff[2] * dist];
      if (!this.camEye) { this.camEye = want; this.camLook = null; }
      const k = damp(9, dt);
      for (let i = 0; i < 3; i++) this.camEye[i] += (want[i] - this.camEye[i]) * k;
      const v = [this.camEye[0] - H.pos[0], this.camEye[1] - H.pos[1], this.camEye[2] - H.pos[2]], vl = Math.hypot(...v);
      const hit = this.world.raycast(H.pos, v.map((c) => c / vl), vl);
      eye = hit ? H.pos.map((c, i) => c + (v[i] / vl) * Math.max(3, hit.t - 0.6)) : [...this.camEye];
      eye[1] = Math.max(eye[1], 0.8);
      const { o, d } = this.bore();
      const tgt = [o[0] + d[0] * 70, Math.max(o[1] + d[1] * 70, H.pos[1] - 25) - 1, o[2] + d[2] * 70];
      const want2 = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
      if (!this.camLook) this.camLook = want2;
      this.camLook = norm(this.camLook.map((c, i) => c + (want2[i] - c) * damp(10, dt)));
      look = this.camLook;
    }
    if (this.shake > 0) { const s = this.shake * 0.5; eye = eye.map((c) => c + (Math.random() - 0.5) * s); }
    this.eye = eye;
    const roll = this.camMode === 2 ? -H.rollL : -H.rollL * 0.3;
    const S = this.S, s = this.save;
    const fr = this.coop ? [...this.coop.friends.values()] : [];
    const st = {
      rotorA: H.rotorA, tailA: H.tailA, rpm: H.rpm, spin: (this.spin = (this.spin || 0) + this.spinV * dt * 40), t: this.t, install: null, riders: this.riders,
      crew: s.crew.filter((c) => !(this.scav && this.scav.team.some((m) => m.crew === c))).map((c) => ({ col: ROLES[c.role].col })),
      rockets: this.rockets, rocketMax: S.rockets, bombs: this.bombs, bombMax: S.bombs, boost: H.boost, doorAim: this.doorAim, doorFlash: this.doorFlash, flash: this.flashT,
      doorFriend: [0, 1].map((sd) => { const f = fr.find((q) => q.seat === sd); return f ? { col: f.col } : count(s.crew, 'gunner') > sd - S.gunners && sd >= S.gunners ? { col: ROLES.gunner.col } : null; }),
    };
    const parts = this.mode === 'down' ? [] : chopperParts(s.eq, PAINT[s.paint], st, H.H);
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
    if (client) {
      const cl = this.client;
      for (const e of cl.evs) {
        if (e.k === 'rescue') {
          for (let i = 0; i < e.n; i++) { const a = (e.s - e.n + i) * 2.1 + e.w; person(e.x + Math.cos(a) * 2.4, e.y, e.z + Math.sin(a) * 2.4, -a, true, i); }
          if (e.n > 0) P([e.x + 3, e.y + 45, e.z + 3], [0, 0, 0], [1.8, 90, 1.8], [0.3, 1, 0.35], { em: 1, shape: 'cylY', alpha: 0.18 });
        } else if (e.k === 'convoy') truckParts(P, e.tr, e.d);
        else if (e.k === 'nest') nestParts(P, e.x, e.z, e.h, this.t);
        else if (e.k === 'crate') crateParts(P, e.x, e.y, e.z, e.l, e.c, this.t, cl.heli);
      }
      for (const s of cl.shots) {
        const v = norm([s[4], s[5], s[6]]), ang = [Math.asin(clamp(v[1], -1, 1)), Math.atan2(-v[0], -v[2]), 0];
        if (s[0] === 'r') { P([s[1], s[2], s[3]], ang, [0.2, 0.2, 1.1], [0.85, 0.85, 0.8], { shape: 'cyl' }); this.fx.flame([s[1], s[2], s[3]], [0, 0, 0], 1.2); }
        else if (s[0] === 'b') P([s[1], s[2], s[3]], ang, [0.4, 0.4, 0.95], [0.3, 0.32, 0.25], { shape: 'sphere' });
        else P([s[1], s[2], s[3]], ang, [0.35, 0.35, 1.6], [0.5, 0.95, 1], { em: 1, shape: 'sphere', alpha: 0.9 });
        for (let i = 0; i < 3; i++) s[1 + i] += s[4 + i] / 60;
      }
    } else {
      for (const e of this.director.list) e.parts(P, this.t, person, this.heli);
      for (const rn of this.runners || []) {
        const k = rn.slow ? (rn.t < 0.5 ? rn.t * 2 : 1) : rn.t, p = rn.from.map((c, i) => c + (rn.to[i] - c) * k);
        if (rn.slow && rn.t >= 0.5) continue;
        p[1] = rn.from[1] + (rn.to[1] - rn.from[1]) * k + Math.sin(k * Math.PI) * 0.4;
        person(p[0], p[1], p[2], Math.atan2(-(rn.to[0] - rn.from[0]), -(rn.to[2] - rn.from[2])), false, Math.floor(rn.from[0]));
      }
      if (this.drop) crateParts(P, this.drop.x, this.drop.y, this.drop.z, false, false, this.t);
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
        if (Math.abs(tu.pos[0] - this.heli.pos[0]) > 500 || Math.abs(tu.pos[2] - this.heli.pos[2]) > 500) continue;
        P(tu.pos, [0, tu.yaw, 0], [1.1, 0.8, 1.4], [0.25, 0.28, 0.22], { shape: 0.08, mat: 'metal' });
        P([tu.pos[0] - Math.sin(tu.yaw) * 1.2, tu.pos[1] + 0.1, tu.pos[2] - Math.cos(tu.yaw) * 1.2], [0, tu.yaw, 0], [0.16, 0.16, 1.6], [0.12, 0.12, 0.13], { shape: 'cyl', mat: 'metal' });
        if (tu.flash > 0) P([tu.pos[0] - Math.sin(tu.yaw) * 2.1, tu.pos[1] + 0.1, tu.pos[2] - Math.cos(tu.yaw) * 2.1], [0, 0, 0], [0.4, 0.4, 0.4], [1, 0.8, 0.4], { em: 1, shape: 'sphere', alpha: 0.8 });
      }
      for (const s of this.shots || []) {
        const v = norm(s.vel), ang = [Math.asin(clamp(v[1], -1, 1)), Math.atan2(-s.vel[0], -s.vel[2]), 0];
        if (s.kind === 'rocket') { P(s.pos, ang, [0.2, 0.2, 1.1], [0.85, 0.85, 0.8], { shape: 'cyl' }); P(s.pos.map((c, i) => c - v[i] * 0.7), [0, 0, 0], [0.5, 0.5, 0.5], [1, 0.75, 0.3], { em: 1, shape: 'sphere', alpha: 0.9 }); }
        else if (s.kind === 'bomb' || s.kind === 'bomblet') P(s.pos, ang, s.kind === 'bomb' ? [0.4, 0.4, 0.95] : [0.25, 0.25, 0.4], [0.3, 0.32, 0.25], { shape: 'sphere' });
        else if (s.kind === 'plasma') P(s.pos, ang, [0.35, 0.35, 1.6], [0.5, 0.95, 1], { em: 1, shape: 'sphere', alpha: 0.9 });
      }
    }
    for (const b of this.blasts || []) {
      const k = b.t / 0.5;
      if (b.ring) { const s = (3 + k * 16) * b.size; P(b.pos, [0, 0, 0], [s, 0.15, s], [1, 0.85, 0.6], { em: 1, shape: 'cylY', alpha: (1 - k) * 0.35 }); continue; }
      const s = (2 + k * 6) * b.size;
      P(b.pos, [0, 0, 0], [s, s, s], b.col || [1, 0.65, 0.25], { em: 1, shape: 'sphere', alpha: (1 - k) * 0.6 });
      if (!b.col) P(b.pos, [0, 0, 0], [s * 0.55, s * 0.55, s * 0.55], [1, 0.95, 0.7], { em: 1, shape: 'sphere', alpha: (1 - k) * 0.9 });
    }
    for (const t of this.tracers || []) {
      const l = Math.min(14, t.len - t.d);
      if (l <= 0) continue;
      const c = t.from.map((v, i) => v + t.dir[i] * (t.d + l / 2));
      P(c, [Math.asin(clamp(t.dir[1], -1, 1)), Math.atan2(-t.dir[0], -t.dir[2]), 0], [0.09, 0.09, l], [1, 0.8, 0.45], { em: 1, alpha: 0.85 });
    }
    return out;
  }

  project(p) {
    const m = this.vp, x = p[0], y = p[1], z = p[2];
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    return { x: (cx / cw * 0.5 + 0.5) * innerWidth, y: (1 - (cy / cw * 0.5 + 0.5)) * innerHeight, behind: cw < 0.1 };
  }

  markers(list, from, extra = []) {
    const out = [];
    for (const mk of list) {
      if (!mk) continue;
      const q = this.project(mk.p), W = innerWidth, Hh = innerHeight;
      let x = q.x, y = q.y, off = false;
      if (q.behind) { x = W - x; y = Hh - 40; off = true; }
      if (x < 40 || x > W - 40 || y < 70 || y > Hh - 40) off = true;
      if (off) continue;          // off screen: the list and the map show where it is
      const d = Math.round(Math.hypot(mk.p[0] - from[0], mk.p[2] - from[2]));
      out.push(`<div class="da-mark${off ? ' off' : ''}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;--c:${mk.col}"><b>${mk.icon}</b>${mk.text} · ${d}M${mk.sub ? `<small>${mk.sub}</small>` : ''}</div>`);
    }
    this.$('marks').innerHTML = out.join('') + extra.join('');
  }
  eventsList(list, from) {
    const rows = list.filter(Boolean).map((mk) => ({ mk, d: Math.hypot(mk.p[0] - from[0], mk.p[2] - from[2]) })).sort((a, b) => a.d - b.d).slice(0, 6);
    this.$('evs').innerHTML = rows.map(({ mk, d }) => `<div style="--c:${mk.col}"><i>${mk.icon}</i><span>${mk.text}${mk.sub ? `<em>${mk.sub}</em>` : ''}</span><small>${Math.round(d)}M</small></div>`).join('');
  }
  minimap(pos, heading, list, zombies) {
    const cv = this.$('map'), c = cv.getContext('2d'), W = cv.width, sc = W / (2 * WORLD);
    const X = (x) => (x + WORLD) * sc, Z = (z) => (z + WORLD) * sc;
    c.clearRect(0, 0, W, W);
    c.fillStyle = 'rgba(60,62,66,.9)'; c.fillRect(X(-HALF), Z(-HALF), 2 * HALF * sc, 2 * HALF * sc);
    c.fillStyle = 'rgba(255,90,58,.75)';
    for (const z of zombies) if (z.alive) c.fillRect(X(z.x) - 0.6, Z(z.z) - 0.6, 1.3, 1.3);
    for (const f of this.fobs) {
      c.fillStyle = f.wrecked ? '#ff5a3a' : f.fuelOnly ? '#ff9f3a' : '#5ab4ff';
      c.fillRect(X(f.padAt[0]) - 4, Z(f.padAt[2]) - 4, 8, 8);
      c.fillStyle = '#111'; c.font = 'bold 8px sans-serif'; c.textAlign = 'center'; c.fillText(f.fuelOnly ? 'F' : 'H', X(f.padAt[0]), Z(f.padAt[2]) + 3);
    }
    for (const mk of list) { if (!mk) continue; c.fillStyle = mk.col; c.beginPath(); c.arc(X(mk.p[0]), Z(mk.p[2]), 4, 0, 6.3); c.fill(); }
    c.save(); c.translate(X(pos[0]), Z(pos[2])); c.rotate(-heading);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2); c.lineTo(-5, 5); c.closePath(); c.fill(); c.restore();
  }

  hud(dt) {
    if (!this.run || this.mode === 'hangar') return;
    const H = this.heli, S = this.S, run = this.run;
    this.helpT = Math.max(0, (this.helpT || 0) - dt);
    this.$('help').style.opacity = this.helpT > 0 ? 1 : 0;
    this.$('help').style.visibility = this.helpT > 0 ? 'visible' : 'hidden';
    const aim = this.aimPoint();
    const c = this.project(aim.p), cr = this.$('cross');
    cr.style.left = `${c.x}px`; cr.style.top = `${c.y}px`; cr.style.display = c.behind || H.dead || this.mode === 'down' ? 'none' : '';
    cr.classList.toggle('hot', !!aim.z || !!aim.sh || this.overT > 0);
    const hm = this.$('hit'); hm.style.left = `${c.x}px`; hm.style.top = `${c.y}px`;
    this.hitT = Math.max(0, (this.hitT || 0) - dt); if (this.hitT <= 0) hm.style.opacity = 0;
    const list = this.director.list.map((e) => e.marker(this));
    for (const f of this.fobs) list.push({ p: [f.padAt[0], f.padAt[1] + 6, f.padAt[2]], col: f.wrecked ? '#ff5a3a' : f.fuelOnly ? '#ff9f3a' : '#5ab4ff', icon: f.fuelOnly ? '⛽' : 'H', text: f.name, sub: f.wrecked ? `WRECKED · ${fmtT(f.wreckT)}` : this.riders && !f.fuelOnly ? `DROP OFF ${this.riders}` : '', fob: true });
    const extra = [];
    if (has(this.save.crew, 'lookout')) {
      for (const z of this.horde.list) {
        if (!z.alive || (z.type !== 'spitter' && z.type !== 'brute') || Math.abs(z.x - H.pos[0]) > 160 || Math.abs(z.z - H.pos[2]) > 160) continue;
        const q = this.project([z.x, z.y + z.s * 2.2, z.z]);
        if (!q.behind) extra.push(`<div class="da-spec" style="left:${q.x.toFixed(0)}px;top:${q.y.toFixed(0)}px">▼ ${z.type.toUpperCase()}</div>`);
      }
    }
    this.markers(list.filter((m) => !m.fob || Math.hypot(m.p[0] - H.pos[0], m.p[2] - H.pos[2]) < 700), H.pos, extra);
    this.eventsList(list.filter((m) => !m.fob), H.pos);
    this.minimap(H.pos, H.heading, list.filter((m) => !m.fob), this.horde.list);
    const T = this.titanEv(), boss = this.$('boss');
    boss.classList.toggle('hidden', !T);
    if (T) boss.style.setProperty('--p', (T.z0.hp / T.z0.max).toFixed(3));
    const setM = (id, p, hot) => { const m = this.$(id); m.style.setProperty('--p', clamp(p, 0, 1).toFixed(3)); m.classList.toggle('hot', !!hot); };
    setM('fuelm', this.fuel / S.fuel, this.fuel / S.fuel < 0.2);
    this.$('fueltxt').textContent = this.fuel <= 0 ? 'EMPTY' : `${Math.round((this.fuel / S.fuel) * 100)}%`;
    setM('hpm', this.hp / S.hp, this.hp / S.hp < 0.3);
    setM('heatm', this.heat, this.overT > 0);
    this.$('heatm').classList.remove('hidden');
    this.$('boostm').classList.toggle('hidden', !S.boost);
    if (S.boost) setM('boostm', H.boostT, false);
    this.$('alt').textContent = `ALT ${Math.round(this.agl ?? 0)}M`;
    this.$('spd').textContent = `${Math.round(Math.hypot(...H.vel) * 3.6)} KM/H`;
    const seats = Math.max(2, S.seats - this.save.crew.length);
    const fr = this.coop ? this.coop.friends.size : 0;
    this.$('right').innerHTML = `${S.rockets ? `<div><small>ROCKETS</small>${this.rockets} / ${S.rockets}</div>` : ''}${S.bombs ? `<div><small>BOMBS</small>${this.bombs} / ${S.bombs}</div>` : ''}<div><small>ON BOARD</small>${this.riders} / ${seats}</div>${this.save.crew.length ? `<div><small>CREW</small>${this.save.crew.map((m) => `<span style="color:rgb(${ROLES[m.role].col.map((v) => Math.round(v * 255))})">●</span>`).join('')}</div>` : ''}${fr ? `<div><small>FRIENDS</small>${fr}</div>` : ''}<div><small>KILLS</small>${run.kills}</div><div><small>SCRAP</small>⚙ ${this.save.scrap.toLocaleString('en-GB')}</div>`;
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
    src.start(); lfo.start(); whine.start();
    this.au = { src, g, lfo, lg, whine, wg };
  }
  stopAudio() {
    if (!this.au) return;
    try { this.au.src.stop(); this.au.lfo.stop(); this.au.whine.stop(); } catch { /* ignore */ }
    this.au.g.disconnect(); this.au.wg.disconnect();
    this.au = null;
  }
  audio() {
    if (!this.au) { if ((this.mode === 'fly' || this.mode === 'gunner') && this.snd.ctx) this.startAudio(); return; }
    const c = this.snd.ctx, H = this.mode === 'gunner' ? this.client?.heli : this.heli, t = c.currentTime;
    if (!H) return;
    const coll = this.key('KeyW') ? 1 : this.key('KeyS') ? -0.5 : 0;
    const eng = this.fuel <= 0 && this.mode !== 'gunner' ? 0.3 : 1;
    this.au.lfo.frequency.setTargetAtTime(H.rpm * 18, t, 0.1);
    this.au.g.gain.setTargetAtTime(H.rpm * (0.55 + coll * 0.15), t, 0.1);
    this.au.lg.gain.setTargetAtTime(H.rpm * 0.45, t, 0.1);
    this.au.whine.frequency.setTargetAtTime(240 + H.rpm * 380 * eng + (H.boost || 0) * 300, t, 0.2);
    this.au.wg.gain.setTargetAtTime((H.rpm * 0.018 + (H.boost || 0) * 0.03) * eng, t, 0.2);
  }

  // ---------------------------------------------------------------- drawing
  // automatic quality: if frames are slow, draw at a lower resolution, then drop shadows; climb back when it's quick
  perf() {
    const now = performance.now(), low = this.save.gfx === 'low';
    const dt = Math.min(0.25, (now - (this.lastDraw || now)) / 1000);
    this.lastDraw = now;
    this.pfT = (this.pfT || 0) + dt; this.pfN = (this.pfN || 0) + 1;
    if (low) { this.r.resScale = 0.6; this.noShadow = true; this.pfT = 0; this.pfN = 0; return; }
    if (this.pfT < 2) return;
    const avg = this.pfT / this.pfN; this.pfT = 0; this.pfN = 0;
    const rs = this.r.resScale || 1;
    if (avg > 1 / 40) { if (rs > 0.55) this.r.resScale = rs - 0.1; else this.noShadow = true; }
    else if (avg < 1 / 56) { if (this.noShadow) this.noShadow = false; else this.r.resScale = Math.min(1, rs + 0.05); }
  }
  draw(eye, fwd, roll, heliParts, extra, focus, fog) {
    const r = this.r;
    this.perf();
    if (this.save.gfx === 'low') fog = Math.max(fog, 0.0075);
    const aspect = r.resize();
    const vfov = (64 * Math.PI) / 180;
    perspective(this.proj, vfov, aspect, 0.4, 1100);
    lookDir(this.view, eye, fwd, [0, 1, 0], roll);
    mul(this.vp, this.proj, this.view);
    r.setStudio(null); r.setRoom(null); r.setUnder(false); r.setRim(null);
    const sc = [Math.round(focus[0] / 4) * 4, 0, Math.round(focus[2] / 4) * 4];
    r.setShadowArea(sc, 80);
    const farCull = 2.4 / fog;
    const tv = Math.tan(vfov / 2), kf = Math.hypot(tv, tv * aspect), kr = Math.sqrt(1 + kf * kf);
    const view = (c, rad) => {
      const dx = c[0] - eye[0], dy = c[1] - eye[1], dz = c[2] - eye[2], d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > (farCull + rad) * (farCull + rad)) return false;
      const al = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
      if (al < -rad) return false;
      return Math.sqrt(Math.max(0, d2 - al * al)) <= al * kf + rad * kr;
    };
    const near = (c, rad) => Math.abs(c[0] - sc[0]) < 130 + rad && Math.abs(c[2] - sc[2]) < 130 + rad;
    const zn = this.horde.fill(r, this.zBatches, eye, fwd, kf);
    const zb = Object.values(this.zBatches);
    const sn = this.fillSmoke(eye);
    const solid = heliParts.filter((p) => (p.alpha ?? 1) >= 1), clear = heliParts.filter((p) => (p.alpha ?? 1) < 1);
    const exS = extra.filter((p) => (p.alpha ?? 1) >= 1), exC = extra.filter((p) => (p.alpha ?? 1) < 1);
    const shadows = !this.noShadow;
    if (shadows) {
    r.beginShadow();
    this.batches.drawShadows(0, near);
    for (const b of this.live) if (!b.noShadow && near(b.center, 10)) r.shadowDraw(b.model, b.shape, b.scale);
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
    for (const b of this.live) if ((b.alpha ?? 1) >= 1 && view(b.center, 0.5 * Math.hypot(...b.scale))) r.drawBox(b);
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
      D[o + 24] = 0; D[o + 25] = 0; D[o + 26] = col[3] || 0; D[o + 27] = 0; D[o + 28] = 0; D[o + 29] = 1; D[o + 30] = 0; D[o + 31] = 0;
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
      const k = sm.t / sm.life;
      put(sm.pos[0] + sm.drift[0] * sm.t, sm.pos[1] + sm.t * 2.2, sm.pos[2] + sm.drift[1] * sm.t, sm.size * (1 + k * 2.2), [0.16, 0.15, 0.14], 0.45 * (1 - k) * Math.min(1, sm.t * 6));
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
