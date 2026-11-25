// DEAD AIR · your pilot's career: XP and ranks (each rank unlocks a paint job you can't buy), lifetime stats, and medals.
// Everything lives in save.career = { xp, st: {...}, medals: [ids] }.

export const RANKS = [
  { n: 'ROOKIE', xp: 0 },
  { n: 'CADET', xp: 400 },
  { n: 'PILOT', xp: 1200 },
  { n: 'FLIGHT LIEUTENANT', xp: 3000, paint: 'redtail' },
  { n: 'CAPTAIN', xp: 6500, paint: 'tiger' },
  { n: 'MAJOR', xp: 12000, paint: 'checker' },
  { n: 'COLONEL', xp: 22000, paint: 'thunder' },
  { n: 'ACE', xp: 38000, paint: 'gold' },
  { n: 'LEGEND', xp: 65000, paint: 'chrome' },
];
export const rankOf = (xp) => { let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++; return i; };

// what you get XP for
export const XP = { kill: 1, rescue: 10, crate: 25, op: 300 };

// t: the test, on the career's stats (s) and the live game (g); xp and scrap for earning it
export const MEDALS = [
  { id: 'first', n: 'FIRST BLOOD', d: 'Kill your first zombie.', xp: 50, scrap: 50, t: (s) => s.kills >= 1 },
  { id: 'hundred', n: 'CENTURION', d: 'Kill 100 zombies in one flight.', xp: 300, scrap: 400, t: (s, g) => (g.run && g.run.kills) >= 100 },
  { id: 'fivehundred', n: 'THE REAPER', d: 'Kill 500 zombies in one flight.', xp: 1200, scrap: 2000, t: (s, g) => (g.run && g.run.kills) >= 500 },
  { id: 'tenk', n: 'EXTERMINATOR', d: 'Kill 10,000 zombies in total.', xp: 2000, scrap: 3000, t: (s) => s.kills >= 10000 },
  { id: 'saved100', n: 'LIFESAVER', d: 'Rescue 100 people in total.', xp: 500, scrap: 600, t: (s, g) => (g.save.rescued || 0) >= 100 },
  { id: 'saved1000', n: 'GUARDIAN ANGEL', d: 'Rescue 1,000 people in total.', xp: 2500, scrap: 4000, t: (s, g) => (g.save.rescued || 0) >= 1000 },
  { id: 'full', n: 'FULL HOUSE', d: 'Fill every seat on board.', xp: 250, scrap: 300, t: (s, g) => g.mode === 'fly' && g.S && g.S.seats >= 4 && g.riders >= g.S.seats },
  { id: 'crates', n: 'DELIVERY DRIVER', d: 'Deliver 25 supply crates.', xp: 600, scrap: 800, t: (s) => s.crates >= 25 },
  { id: 'night', n: 'NIGHT OWL', d: 'Stay in the air through a whole night until dawn.', xp: 400, scrap: 500, t: (s) => s.dawns >= 1 },
  { id: 'storm', n: 'STORM CHASER', d: 'Fly through 3 minutes of thunderstorm in one go.', xp: 400, scrap: 500, t: (s, g) => (g.stormRun || 0) >= 180 },
  { id: 'bird', n: 'BIRD BRAIN', d: 'Hit a bird.', xp: 50, scrap: 50, t: (s) => s.birds >= 1 },
  { id: 'tree', n: 'TREETOP FLYER', d: 'Fly under 10 m above the ground, faster than 180 km/h, for 5 seconds.', xp: 300, scrap: 400, t: (s, g) => (g.treeRun || 0) >= 5 },
  { id: 'hotlz', n: 'HOT LANDING', d: 'Land with 20 zombies within 30 m of you.', xp: 300, scrap: 400, t: (s, g) => (g.hotLZ || 0) >= 20 },
  { id: 'hours', n: 'LOGBOOK', d: 'Fly for 5 hours in total.', xp: 1500, scrap: 2000, t: (s) => s.flightT >= 5 * 3600 },
  { id: 'fleet10', n: 'COLLECTOR', d: 'Own 10 aircraft.', xp: 600, scrap: 0, t: (s, g) => (g.save.helis || []).length >= 10 },
  { id: 'fleetall', n: 'HANGAR KING', d: 'Own every aircraft.', xp: 3000, scrap: 0, t: (s, g) => g.allOwned && g.allOwned() },
  { id: 'story', n: 'THE LAST FLIGHT', d: 'Finish the story.', xp: 2000, scrap: 2000, t: (s, g) => !!(g.story && g.story.done) },
  { id: 'ops10', n: 'SPECIAL FORCES', d: 'Finish 10 Special Ops.', xp: 3000, scrap: 5000, t: (s) => s.ops >= 10 },
  { id: 'ace', n: 'ACE OF ACES', d: 'Reach the rank of ACE.', xp: 0, scrap: 10000, t: (s, g) => rankOf(g.save.career.xp) >= 7 },
];

export class Career {
  constructor(save) {
    const c = (save.career = save.career || {});
    c.xp = c.xp || 0; c.medals = c.medals || [];
    c.st = Object.assign({ kills: 0, crates: 0, flights: 0, ops: 0, flightT: 0, dawns: 0, birds: 0, best: 0 }, c.st || {});
    this.save = save; this.c = c; this.chk = 0;
  }
  get rank() { return rankOf(this.c.xp); }
  // something happened: count it, give the XP
  ev(g, k, n = 1) {
    const st = this.c.st;
    if (k === 'kill') st.kills += n;
    else if (k === 'crate') st.crates += n;
    else if (k === 'op') st.ops += n;
    else if (k === 'flight') st.flights += n;
    else if (k === 'dawn') st.dawns += n;
    else if (k === 'bird') st.birds += n;
    if (XP[k]) this.addXP(g, XP[k] * n);
  }
  addXP(g, n) {
    const before = this.rank;
    this.c.xp += n;
    const after = this.rank;
    if (after > before) {
      const R = RANKS[after];
      g.banner(`PROMOTED: ${R.n}`, R.paint ? 'NEW PAINT JOB UNLOCKED IN THE HANGAR' : 'KEEP IT UP, PILOT', 'good', 4);
      g.snd.finish?.();
      g.saveNow?.();
    }
  }
  // every so often in the air: the live medals (speed, storms, landings...) and anything the stats have earned
  tick(g, dt) {
    const H = g.heli, st = this.c.st;
    if (g.mode === 'fly' && H && !H.dead) {
      st.flightT += dt;
      if (g.run) st.best = Math.max(st.best, g.run.kills || 0);
      const sp = Math.hypot(...H.vel), agl = g.agl ?? 99;
      g.treeRun = agl < 10 && sp > 50 && !H.contacts ? (g.treeRun || 0) + dt : 0;
      g.stormRun = g.wxv && g.wxv.storm > 0.5 ? (g.stormRun || 0) + dt : 0;
    }
    this.chk -= dt;
    if (this.chk > 0) return;
    this.chk = 1;
    if (g.mode === 'fly' && H && H.contacts && !H.dead) {
      let n = 0; for (const z of g.horde.list) if (z.alive && Math.abs(z.x - H.pos[0]) < 30 && Math.abs(z.z - H.pos[2]) < 30) n++;
      g.hotLZ = n;
    } else g.hotLZ = 0;
    this.check(g);
  }
  check(g) {
    for (const m of MEDALS) {
      if (this.c.medals.includes(m.id)) continue;
      let ok = false; try { ok = m.t(this.c.st, g); } catch { ok = false; }
      if (!ok) continue;
      this.c.medals.push(m.id);
      if (m.scrap) g.addScrap(m.scrap);
      g.banner(`🏅 MEDAL: ${m.n}`, `${m.d.toUpperCase()}${m.scrap ? ` · +⚙${m.scrap.toLocaleString('en-GB')}` : ''}`, 'good', 4);
      g.snd.coins?.();
      if (m.xp) this.addXP(g, m.xp);
      g.saveNow?.();
      return;                       // one at a time, so the banners don't pile up
    }
  }
}
