// DEAD AIR: the story. Spire Control talks you through seven jobs, one after another; each one has goals that tick off
// as you play (rescues, crates, masts, the fort...), and pays out when it's done. After the last one it's free flight.
// The big story jobs (the masts, the fort, St Mary's, the siege, the great horde) are made here when their chapter
// comes round, and live in the director's list with everything else.
import { MastEv, FortEv, Evac, Siege, GreatHorde } from './events.js';

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
    brief: "We're not the only ones flying. Other crews heard us and came looking, and some of them didn't make it. Find the crash sites, get the crews out, and bring in supplies for the new arrivals. And pilot... one of the crews saw something walking. Something huge.",
    goals: [{ k: 'crash', n: 2, t: 'RESCUE 2 DOWNED CREWS' }, { k: 'crate', n: 2, t: 'BRING BACK 2 SUPPLY CRATES' }, { k: 'boss', n: 1, t: 'BRING DOWN A GIANT' }] },
  { n: 'THE LONG NIGHT', reward: 5500,
    brief: "All those new people... and all that noise. They've heard us. Everything left in the city is coming for the Spire again, more than last time. Rearm, and get back over the doors.",
    goals: [{ k: 'siege', n: 1, t: 'HOLD THE SPIRE AGAIN · 6 WAVES' }] },
  { n: 'THE TIDE', reward: 8000,
    brief: "This is it, pilot. The masts can see all of them now: the last great horde, every one of the dead left in the country, and smaller packs feeding into it. Break the packs, then break the tide. End this.",
    goals: [{ k: 'horde', n: 2, t: 'BREAK UP 2 HORDES' }, { k: 'boss', n: 1, t: 'KILL THE GIANT LEADING THE TIDE' }, { k: 'great', n: 1, t: 'BREAK THE LAST GREAT HORDE' }] },
];
export const ENDING = "Pilot... it's quiet. Properly quiet. The Spire, the fort, the other cities: all lit up, all talking. There'll always be stragglers out there, but the dead don't own this country any more. We do. Thank you. Keep flying.";
const ENDING1 = "That's it. They're broken. The Spire's safe, Fort Calder's running, and the radio hasn't stopped: people coming in from everywhere. You did that. There are always more of them out there, though. Keep flying.";

export class Story {
  constructor(save, map) { this.s = save.story; this.armT = 0; this.nMasts = map && map.masts ? map.masts.length : 3; this.nBridges = map && map.bridges ? map.bridges.length : 2; }
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
    if (ch.goals.some((g) => g.k === 'boss') && this.have(ch.goals.find((g) => g.k === 'boss')) < 1 && !D.list.some((e) => e.kind === 'boss')) { const e = D.add(game, 'boss'); if (e) e.story = true; }
    if (want('evac') && map.hospital && !has('evac')) { const e = new Evac(map.hospital); e.story = true; D.list.push(e); }
    if (want('great') && !has('great')) {
      const B = map.boro, town = { x: B.x, z: B.z, r: 260, name: 'THE BOROUGH', y: 10 };
      let x = 0, z = 0;
      for (let t = 0; t < 30; t++) { const a = Math.random() * 6.28; x = B.x + Math.cos(a) * 2200; z = B.z + Math.sin(a) * 2200; if (Math.abs(x) < 5400 && Math.abs(z) < 5400 && !game.horde.blockedAt(x, z)) break; }
      const e = new GreatHorde(town, x, z, 1500); e.story = true; D.list.push(e);
      game.feed('RADIO: THE GREAT HORDE IS ON THE MOVE · HEADING FOR THE BOROUGH', 'r');
    }
  }
  // every frame while flying: the siege waits until you've had a minute to get ready
  update(dt, game) {
    const ch = this.ch; if (!ch) return;
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
    if (!ch) return null;
    return { title: `CHAPTER ${this.s.ch + 1} · ${ch.n}`, goals: ch.goals.map((g) => ({ t: g.t, have: Math.min(g.n, this.have(g)), n: g.n })) };
  }
}
