// DEAD AIR: the story. Spire Control talks you through seven jobs, one after another; each one has goals that tick off
// as you play (rescues, crates, masts, the fort...), and pays out when it's done. After the last one it's free flight.
// The big story jobs (the masts, the fort, St Mary's, the siege, the great horde) are made here when their chapter
// comes round, and live in the director's list with everything else.
import { MastEv, FortEv, Evac, Siege, GreatHorde, CountdownEv, PiperEv, SearchEv, VipEv, Outbreak, Convoy, convoyPath } from './events.js';

export const CHAPTERS = [
  { n: 'FIRST LIGHT', reward: 600,
    brief: "Pilot, this is Spire Control. You're the only bird we've got left. There are people stuck on roofs all over the city. Bring them home, and grab any supply drops you see.",
    goals: [{ k: 'rescued', n: 8, t: 'BRING 8 SURVIVORS BACK TO THE SPIRE' }, { k: 'crate', n: 1, t: 'BRING BACK A SUPPLY CRATE' }] },
  { n: 'EYES AND EARS', reward: 1200,
    brief: "We're deaf out here. Three radio masts up on the hills went quiet when it started. Land an engineer at each one and keep the dead off the hut while they work. With the masts up we'll hear every call for help.",
    goals: [{ k: 'mast', n: 3, t: 'GET THE 3 RADIO MASTS WORKING' }] },
  { n: 'FORT CALDER', reward: 2000,
    brief: "The masts picked up Fort Calder, the old army base. The garrison turned, but the fuel and the guns are still there. Clear it out and it's our second base.",
    goals: [{ k: 'fort', n: 1, t: 'TAKE BACK FORT CALDER' }] },
  { n: 'THE LONG ROAD', reward: 2200,
    brief: "Word's got out that we're here. People are coming in from the country in anything with wheels. Get the convoys through, and break up any horde heading for the towns.",
    goals: [{ k: 'convoy', n: 2, t: 'GET 2 CONVOYS THROUGH' }, { k: 'horde', n: 1, t: 'BREAK UP A HORDE' }] },
  { n: "ST MARY'S", reward: 3000,
    brief: "St Mary's Hospital. Thirty people on the roof, and they've been up there for days. It'll take more than one trip. Don't let them down.",
    goals: [{ k: 'evac', n: 1, t: "EMPTY THE ROOF OF ST MARY'S" }] },
  { n: 'THE SIEGE', reward: 4000,
    brief: "Pilot... the city's moving. Every one of them is heading for the Spire. Get back here. We need you over the doors.",
    goals: [{ k: 'siege', n: 1, t: 'HOLD THE SPIRE · 6 WAVES' }] },
  { n: 'THE GREAT HORDE', reward: 6000,
    brief: "That was only the city. The masts are picking up something huge: every zombie in the country, walking on the Borough. Break it up before it gets there.",
    goals: [{ k: 'great', n: 1, t: 'BREAK THE GREAT HORDE' }] },
  // ---- ACT TWO: the world is bigger than the city
  { n: 'THE OTHER CITIES', reward: 3500,
    brief: "Pilot, you broke the Great Horde. The radio hasn't stopped since. It's not just our city: the other towns out there are full of people hiding. Go and get them, and stamp out any outbreak before it spreads.",
    goals: [{ k: 'rescued', n: 25, t: 'BRING 25 MORE SURVIVORS HOME' }, { k: 'outbreak', n: 1, t: 'CLEAR AN OUTBREAK' }] },
  { n: 'BURNING BRIDGES', reward: 4000,
    brief: "People are trapped on the bridges, walking for the city when the dead came at them from both ends. Get them off. And thin the dead out while you're at it: the more you kill, the safer the roads.",
    goals: [{ k: 'bridge', n: 2, t: 'SAVE THE PEOPLE ON 2 BRIDGES' }, { k: 'kills', n: 300, t: 'KILL 300 ZOMBIES' }] },
  { n: 'MAYDAY', reward: 4500,
    brief: "We're not the only ones flying. Other crews heard us and came looking, and some of them didn't make it. Find the crash sites, get the crews out, and bring in supplies for the new arrivals. And pilot... the crews keep talking about black ones that only come out at night. Fast. Eyes like headlights.",
    goals: [{ k: 'crash', n: 2, t: 'RESCUE 2 DOWNED CREWS' }, { k: 'crate', n: 2, t: 'BRING BACK 2 SUPPLY CRATES' }] },
  { n: 'COUNTDOWN', reward: 6000,
    brief: "Pilot, bad news from the army. They've given up on one of the towns: bombers are on the way to burn it flat. There are still people on the roofs. They gave us seven minutes. Get every last one off before the bombs fall, then get clear.",
    goals: [{ k: 'countdown', n: 1, t: 'EMPTY THE ROOFS BEFORE THE BOMBERS COME' }] },
  { n: 'THE PIED PIPER', reward: 10000,
    brief: "This is it, pilot. The biggest horde we've ever seen is gathering out in the hills, and when it moves, the Spire is finished. We can't shoot that many. But they follow noise. Fly low over them and your speaker will play: they'll follow you. Lead them into the army's target zone and the big guns will do the rest.",
    goals: [{ k: 'piper', n: 1, t: 'LEAD THE HORDE INTO THE ARTILLERY ZONE' }] },
];
export const ENDING = "Direct hit... the whole horde, gone in one go. The army says they have never seen anything like it. The roads are open, the towns are filling up again, and the radio is full of people laughing. The dead don't own this country any more. We do. Thank you, pilot. Keep flying.";
const OPNAME = { countdown: 'COUNTDOWN', piper: 'THE PIED PIPER', great: 'THE GREAT HORDE', evac: "ST MARY'S EVACUATION", purge: 'PURGE', sar: 'SEARCH AND RESCUE', escort: 'CONVOY ESCORT', vip: 'VIP EXTRACTION' };
const ENDING1 = "That's it. They're broken. The Spire's safe, Fort Calder's running, and the radio hasn't stopped: people coming in from everywhere. You did that. There are always more of them out there, though. Keep flying.";

export class Story {
  constructor(save, map) {
    this.save = save; this.nLairs = map && map.lairs ? Object.keys(map.lairs).length : 3; this.nVats = map && map.lab ? map.lab.vats.length : 0; this.hasLab = !!(map && map.lab); this.s = save.story; this.armT = 0; this.nMasts = map && map.masts ? map.masts.length : 3; this.nBridges = map && map.bridges ? map.bridges.length : 2; }
  get ch() { return CHAPTERS[this.s.ch] || null; }
  get done() { return this.s.ch >= CHAPTERS.length; }
  // how far along a goal is
  have(g) {
    if (g.k === 'mast') return this.s.masts.length + Math.max(0, 3 - this.nMasts);
    if (g.k === 'fort') return this.s.fort ? 1 : 0;
    if (g.k === 'bridge') return (this.s.prog.bridge || 0) + Math.max(0, 2 - this.nBridges);
    return this.s.prog[g.k] || 0;
  }
  // something happened in the world that a goal might want
  hit(game, k, v = 1) {
    if (this.done && OPNAME[k]) { this.opDone(game, k); return; }
    if (k === 'mast') { if (!this.s.masts.includes(v)) this.s.masts.push(v); }
    else if (k === 'fort') this.s.fort = true;
    const ch = this.ch;
    if (!ch) return;
    if (k !== 'mast' && k !== 'fort' && ch.goals.some((g) => g.k === k)) this.s.prog[k] = (this.s.prog[k] || 0) + (k === 'evac' ? 1 : v);
    if (ch.goals.every((g) => this.have(g) >= g.n)) this.finish(game);
  }
  finish(game) {
    const ch = this.ch;
    game.addScrap(ch.reward);
    game.banner(`CHAPTER ${this.s.ch + 1} DONE · ${ch.n}`, `+⚙${ch.reward.toLocaleString('en-GB')}`, 'good', 4);
    game.snd.finish?.();
    this.s.ch++; this.s.prog = {};
    game.saveNow?.();
    if (this.done) { this.s.done = true; setTimeout(() => game.radio(ENDING, 16), 4500); }
    else if (this.s.ch === 7) setTimeout(() => game.radio(ENDING1, 10), 4500);
    if (!this.done) setTimeout(() => this.brief(game), this.s.ch === 7 ? 15000 : 4500);
  }
  brief(game) {
    const ch = this.ch; if (!ch) return;
    this.s.seen = this.s.ch;
    game.radio(ch.brief, 14);
    this.armT = 0;
    this.ensure(game);
  }
  // make sure the jobs this chapter needs are out there
  ensure(game) {
    const ch = this.ch, D = game.director, map = game.map;
    if (!ch || !D) return;
    const has = (k) => D.list.some((e) => e.kind === k || (k === 'evac' && e.evac) || (k === 'great' && e.great));
    const want = (k) => ch.goals.some((g) => g.k === k && this.have(g) < g.n);
    if (want('mast')) for (const m of map.masts || []) {
      if (this.s.masts.includes(m.n) || D.list.some((e) => e.mast === m)) continue;
      const e = new MastEv(m); e.story = true; D.list.push(e);
    }
    if (want('fort') && map.fort && map.fort.locked && !has('fort')) { const e = new FortEv(map.fort); e.story = true; D.list.push(e); }
    if (ch.goals.some((g) => g.k === 'convoy') && this.have(ch.goals.find((g) => g.k === 'convoy')) < 2 && !D.list.some((e) => e.kind === 'convoy')) D.add(game, 'convoy');
    if (ch.goals.some((g) => g.k === 'horde') && !D.list.some((e) => e.kind === 'horde' && !e.story)) D.add(game, 'horde');
    if (ch.goals.some((g) => g.k === 'crate') && !D.list.some((e) => e.kind === 'crate')) D.add(game, 'crate');
    if (ch.goals.some((g) => g.k === 'outbreak') && !D.list.some((e) => e.kind === 'outbreak')) D.add(game, 'outbreak');
    if (ch.goals.some((g) => g.k === 'bridge') && !D.list.some((e) => e.br)) D.add(game, 'bridge');
    if (ch.goals.some((g) => g.k === 'crash') && !D.list.some((e) => e.crash)) D.add(game, 'crash');
    if (want('countdown') && !has('countdown')) { const e = CountdownEv.make(game); if (e) D.list.push(e); }
    if (want('piper') && !has('piper')) { const e = PiperEv.make(game); if (e) D.list.push(e); }
    if (want('evac') && map.hospital && !has('evac')) { const e = new Evac(map.hospital); e.story = true; D.list.push(e); }
    if (want('great') && !has('great')) { D.list.push(this.great(game, 1500)); game.feed('RADIO: THE GREAT HORDE IS ON THE MOVE · HEADING FOR THE BOROUGH', 'r'); }
  }
  great(game, n) {
    const map = game.map, B = map.boro, town = { x: B.x, z: B.z, r: 260, name: 'THE BOROUGH', y: 10 };
    let x = 0, z = 0;
    for (let t = 0; t < 30; t++) { const a = Math.random() * 6.28; x = B.x + Math.cos(a) * 2200; z = B.z + Math.sin(a) * 2200; if (Math.abs(x) < 5400 && Math.abs(z) < 5400 && !game.horde.blockedAt(x, z)) break; }
    const e = new GreatHorde(town, x, z, n); e.story = true; return e;
  }
  // ---- SPECIAL OPS: after the story, the big jobs come back again and again, and each threat level makes them
  // bigger and better paid. Every 3 ops done, the threat level goes up.
  get ops() { return (this.save.ops = this.save.ops || { n: 0, lvl: 1, best: 0 }); }
  opTick(dt, game, force) {
    const D = game.director; if (!D) return;
    if (D.list.some((e) => e.op && !e.done)) return;
    this.opT = (this.opT ?? 40) - dt;
    if (this.opT > 0) return;
    this.opT = 75;
    const o = this.ops, lvl = o.lvl, kinds = ['countdown', 'piper', 'great', 'evac', 'purge', 'sar', 'escort', 'vip'].filter((k) => k !== this.lastOp && (k !== 'evac' || game.map.hospital));
    const k = force || kinds[Math.floor(Math.random() * kinds.length)];
    let e = null;
    if (k === 'countdown') e = CountdownEv.make(game, lvl);
    else if (k === 'piper') e = PiperEv.make(game, lvl);
    else if (k === 'great') e = this.great(game, Math.min(4000, 1500 + 400 * lvl));
    else if (k === 'evac') { e = new Evac(game.map.hospital); e.story = true; e.roof.count = e.roof.start = Math.min(60, 25 + 5 * lvl); }
    else if (k === 'purge') {
      const H = game.heli.pos, T = game.map.towns.filter((t) => t.kind === 'town' && Math.hypot(t.x - H[0], t.z - H[2]) > 500 && Math.hypot(t.x - H[0], t.z - H[2]) < 3500);
      if (T.length) { e = new Outbreak(T[Math.floor(Math.random() * T.length)]); e.hitKey = 'purge'; e.story = true; e.start = e.left = Math.min(400, 170 + 40 * lvl); e.time = 260; }
    } else if (k === 'sar') e = SearchEv.make(game, lvl);
    else if (k === 'escort') {
      const path = convoyPath(game.map, game.heli.pos, 2500, 900 + 150 * lvl);
      if (path) { e = new Convoy(path); e.hitKey = 'escort'; e.story = true; e.hp = e.max = Math.max(600, 1200 - lvl * 100); }
    } else if (k === 'vip') e = VipEv.make(game, lvl);
    if (!e) return;
    e.op = k; e.opLvl = lvl; this.lastOp = k; D.list.push(e);
    const say = {
      countdown: 'The army is bombing another city. People on the roofs again. Get them off before the bombers come.',
      piper: 'Another big horde is gathering in the hills. Get your speaker playing and lead them into the artillery zone.',
      great: 'A great horde is walking on the Borough again. Bigger than last time. Break it up.',
      evac: "St Mary's is full again: people keep running there for help. Empty the roof.",
      purge: 'A whole town has turned. The army wants it clean. Get over there and kill nine in ten of them before the clock runs out. The clock only runs while you are there.',
      sar: 'A group of survivors went quiet. All we know is roughly where. Fly low over the search area and look for their flare.',
      escort: 'Survivors are driving out in trucks, a long way. The dead will come at them from both sides of the road. Stay over them.',
      vip: 'Somebody the army really needs is stuck on a roof, alone, and the dead know it. Grab them, then get them to any base.',
    }[k];
    game.banner(`SPECIAL OP ${o.n + 1} · THREAT LEVEL ${lvl}`, OPNAME[k], 'r', 4);
    game.radio(`Pilot, new job. ${say} Pays ⚙${this.opPay(lvl).toLocaleString('en-GB')}.`, 9);
  }
  opPay(lvl) { return 2500 + 1500 * (lvl - 1); }
  opDone(game, k) {
    const o = this.ops, D = game.director, e = D && D.list.find((q) => q.op === k && !q.opPaid);
    if (!e) return;
    e.opPaid = true;
    const pay = this.opPay(e.opLvl || o.lvl);
    o.n++; o.best = Math.max(o.best || 0, o.lvl);
    game.career?.ev(game, 'op');
    game.addScrap(pay);
    game.banner(`SPECIAL OP DONE · ${OPNAME[k]}`, `+⚙${pay.toLocaleString('en-GB')} · ${o.n} OPS DONE`, 'good', 4); game.snd.finish?.();
    if (o.n % 3 === 0) { o.lvl++; setTimeout(() => game.banner(`THREAT LEVEL ${o.lvl}`, 'THE OPS GET BIGGER · AND PAY MORE', 'r', 4), 4500); }
    this.opT = 60; game.saveNow?.();
  }
  // every frame while flying: the siege waits until you've had a minute to get ready
  update(dt, game) {
    this.game = game;
    const ch = this.ch; if (!ch) { if (this.done && !game.client) this.opTick(dt, game); return; }
    if (this.s.seen !== this.s.ch) { this.brief(game); return; }
    this.ensT = (this.ensT ?? 20) - dt;
    if (this.ensT <= 0) { this.ensT = 20; this.ensure(game); }
    if (ch.goals[0].k === 'siege' && !game.director.list.some((e) => e.kind === 'siege')) {
      this.armT += dt;
      if (this.armT > 45) { const e = new Siege(game.map.spire); e.story = true; game.director.list.push(e); game.radio('Here they come. All of them. Keep them off the doors!', 8); }
      else if (Math.floor(this.armT) === 20 && Math.floor(this.armT - dt) !== 20) game.radio('Pilot, get back to the Spire and rearm. You\'ve got about half a minute.', 7);
    }
  }
  // the lines for the HUD tracker
  lines() {
    const ch = this.ch;
    if (!ch) {
      if (!this.done) return null;
      const o = this.ops, e = this.game?.director?.list.find((q) => q.op && !q.done);
      return { title: `SPECIAL OPS · THREAT LEVEL ${o.lvl}`, goals: [{ t: e ? OPNAME[e.op] : 'WAITING FOR THE NEXT JOB...', have: 0, n: 1 }, { t: 'OPS DONE', have: o.n, n: Math.ceil((o.n + 1) / 3) * 3 }] };
    }
    return { title: `CHAPTER ${this.s.ch + 1} · ${ch.n}`, goals: ch.goals.map((g) => ({ t: g.t, have: Math.min(g.n, this.have(g)), n: g.n })) };
  }
}
