// DEAD AIR · GROUND FORCES. Your team and your vehicles, down on the ground with you.
//
// VEHICLES: buy them at the MOTOR POOL (hangar options) and pick one to take. A helicopter big enough (8+ seats) carries
// it slung underneath. Come down low and slow and press J to set it down: it drives along under you and its gun shoots
// everything in reach. Hover low over it and press J again to hook it back up.
// THE TEAM: press U when you're low (under 15 m) and they fast-rope down and fight round you with their own guns. Land or
// hover low near them and press U again to take them back aboard. If someone's health runs out, they're bitten.
// Zombies go for whatever's closest: the team and the trucks draw them off you, and the dead pile onto them.
import { WEAPONS, ARMORS, ROLES, ROLE_IDS } from './team.js';
import { WATER } from './terrain.js';

export const VEH = {
  technical: { n: 'TECHNICAL', cost: 2500, hp: 700, spd: 13, gun: { dmg: 22, rate: 9, range: 75 }, col: [0.66, 0.58, 0.42],
    d: 'A pickup truck with a heavy machine gun bolted in the back. Quick and cheap.' },
  humvee: { n: 'HUMVEE', cost: 4800, hp: 1400, spd: 15, gun: { dmg: 30, rate: 10, range: 85 }, col: [0.44, 0.46, 0.33],
    d: 'An armoured army truck with a gunner in a roof turret. Fast, and tough enough for a real fight.' },
  apc: { n: 'APC', cost: 8500, hp: 2800, spd: 9, gun: { dmg: 60, rate: 4, range: 110, splash: 4.5 }, col: [0.38, 0.42, 0.32],
    d: 'An eight-wheeled armoured carrier with a 25 mm cannon. Slow, but every shell blows a hole in the crowd, and it barely notices bites.' },
};
export const VEH_IDS = Object.keys(VEH);
// how hard each kind of gun hits, per shot, for the team on the ground
const INF = { pistol: { dmg: 14, rate: 2.2, range: 40 }, smg: { dmg: 12, rate: 7, range: 45 }, shotgun: { dmg: 40, rate: 1.4, range: 28 }, rifle: { dmg: 30, rate: 2.6, range: 70 }, lmg: { dmg: 22, rate: 8, range: 65 } };

export function canSling(S, H) { return S && (!S.plane || (S.vtol && H && !H.planeMode)) && S.seatsMax >= 8; }

export class Ground {
  constructor(g) { this.g = g; this.units = []; this.sling = null; this.t = 0; }
  reset() { for (const m of (this.g.save && this.g.save.team) || []) if (m.ground) { m.ground = false; m.aboard = true; } this.units = []; this.sling = null; }
  vehicles() { return this.units.filter((u) => u.kind === 'veh'); }
  team() { return this.units.filter((u) => u.kind === 'inf'); }
  // ---- J: set the vehicle down, or hook it back up
  vehicleKey() {
    const g = this.g, H = g.heli, agl = g.agl ?? 99, sp = Math.hypot(H.vel[0], H.vel[2]);
    if (this.sling) {
      if (agl > 18) { g.feed('COME DOWN UNDER 18 M TO SET IT DOWN', 'y'); return; }
      if (sp > 9) { g.feed('SLOW DOWN TO SET IT DOWN', 'y'); return; }
      const x = H.pos[0], z = H.pos[2];
      if (g.groundAt(x, z) < WATER + 0.3 || g.horde.blockedAt(x, z) || H.pos[1] - g.groundAt(x, z) > 20) { g.feed('NOT HERE: FIND OPEN GROUND (NOT A ROOF, NOT WATER)', 'y'); return; }
      const V = VEH[this.sling];
      const u = { kind: 'veh', type: this.sling, pos: [x, g.groundAt(x, z), z], yaw: Math.atan2(-H.fwd[0], -H.fwd[2]) + Math.PI, hp: V.hp, max: V.hp, cd: 0, aim: 0, seek: 0, id: Math.random().toString(36).slice(2, 7) };
      u.tgt = { kind: 'chase', r: 2.4, alive: true, x, z, unit: u };
      this.units.push(u); this.sling = null;
      g.feed(`${V.n} IS DOWN · IT FOLLOWS YOU AND SHOOTS ON ITS OWN · J TO HOOK IT BACK`, 'g'); g.snd.slam?.(0.4);
      return;
    }
    const v = this.vehicles().find((u) => Math.hypot(u.pos[0] - H.pos[0], u.pos[2] - H.pos[2]) < 14);
    if (!v) { g.feed(g.save.motor && g.save.motor.sel ? 'NO VEHICLE UNDER YOU' : 'NO VEHICLE · BUY ONE AT THE MOTOR POOL', 'y'); return; }
    if (agl > 20) { g.feed('COME DOWN UNDER 20 M TO HOOK IT', 'y'); return; }
    if (!canSling(g.S, H)) { g.feed('THIS AIRCRAFT CAN\'T CARRY A VEHICLE (IT NEEDS 8+ SEATS)', 'y'); return; }
    this.units = this.units.filter((u) => u !== v); v.tgt.alive = false; this.sling = v.type;
    g.feed(`${VEH[v.type].n} HOOKED ON`, 'g'); g.snd.grab?.();
  }
  // ---- U: drop the team, or take them back
  teamKey() {
    const g = this.g, H = g.heli, agl = g.agl ?? 99;
    const down = this.team();
    if (down.length) {
      const near = down.filter((u) => Math.hypot(u.pos[0] - H.pos[0], u.pos[2] - H.pos[2]) < 30);
      if (!near.length) { g.feed('FLY OVER YOUR TEAM TO PICK THEM UP', 'y'); return; }
      if (agl > 8) { g.feed('COME DOWN UNDER 8 M SO THEY CAN CLIMB ABOARD', 'y'); return; }
      for (const u of near) { u.m.aboard = true; u.m.ground = false; u.tgt.alive = false; g.runners?.push({ from: u.pos.slice(), to: H.toWorld([1.3, -1.5, 0.7]), t: 0 }); }
      this.units = this.units.filter((u) => !near.includes(u));
      g.feed(`${near.length} BACK ABOARD${down.length > near.length ? ` · ${down.length - near.length} STILL OUT THERE` : ''}`, 'g');
      return;
    }
    const crew = (g.save.team || []).filter((m) => m.aboard && !m.raid && m.hp > 0);
    if (!crew.length) { g.feed('NO TEAM ABOARD · RECRUIT ONE IN THE HANGAR', 'y'); return; }
    if (g.raid) { g.feed('THE TEAM IS BUSY WITH A RAID', 'y'); return; }
    if (agl > 15) { g.feed('COME DOWN UNDER 15 M TO FAST-ROPE THEM DOWN', 'y'); return; }
    if (g.groundAt(H.pos[0], H.pos[2]) < WATER + 0.3) { g.feed('NOT INTO THE WATER', 'y'); return; }
    if (H.pos[1] - g.groundAt(H.pos[0], H.pos[2]) > 16 || g.horde.blockedAt(H.pos[0], H.pos[2])) { g.feed('GET DOWN OVER OPEN GROUND (NOT A ROOF)', 'y'); return; }
    crew.forEach((m, i) => {
      const a = (i / crew.length) * Math.PI * 2, x = H.pos[0] + Math.cos(a) * 3, z = H.pos[2] + Math.sin(a) * 3;
      const u = { kind: 'inf', m, pos: [x, g.groundAt(x, z), z], yaw: a, cd: Math.random(), seek: Math.random() * 0.3, slot: i, rope: Math.min(agl, 15), id: m.id };
      u.tgt = { kind: 'chase', r: 0.5, alive: true, x, z, unit: u };
      m.aboard = false; m.ground = true;
      this.units.push(u);
    });
    g.feed(`${crew.length} ON THE GROUND · THEY FOLLOW YOU AND FIGHT · U TO TAKE THEM BACK`, 'g'); g.snd.grappleRelease?.();
  }
  // a zombie got its teeth into one of them
  hurt(u, dmg) {
    const g = this.g;
    if (u.kind === 'veh') {
      u.hp -= dmg * 0.6;
      if (u.hp <= 0) {
        u.tgt.alive = false; this.units = this.units.filter((q) => q !== u);
        g.boom?.([u.pos[0], u.pos[1] + 1.5, u.pos[2]], 1.6); g.fires?.push({ pos: u.pos.slice(), r: 5, t: 10, tick: 0 });
        const M = (g.save.motor = g.save.motor || { owned: [], broken: {} }); M.broken = M.broken || {}; M.broken[u.type] = true;
        g.banner(`${VEH[u.type].n} DESTROYED`, 'REPAIR IT AT THE MOTOR POOL', 'bad', 3);
      }
      return;
    }
    const m = u.m;
    m.hp -= dmg * (ARMORS[m.armor] ? ARMORS[m.armor].k : 1);
    if (m.hp < 40 && m.medkit > 0) { m.medkit--; m.hp = Math.min(m.max, m.hp + 50); g.feed(`${m.name} USED A MEDKIT`, 'y'); }
    if (m.hp <= 0) {
      m.hp = 0; u.tgt.alive = false; this.units = this.units.filter((q) => q !== u);
      g.save.team = (g.save.team || []).filter((q) => q !== m);
      g.feed(`${m.name} WAS BITTEN`, 'r'); g.snd.fail?.();
    }
  }
  // your aircraft went down or you went home: the team makes its own way back, vehicles go back to the motor pool
  recall() {
    for (const u of this.units) { if (u.tgt) u.tgt.alive = false; if (u.kind === 'inf') { u.m.aboard = true; u.m.ground = false; } }
    this.units = []; this.sling = null;
  }
  tick(dt) {
    const g = this.g, H = g.heli; this.t += dt;
    if (!this.units.length) return;
    // where they're heading: the ground under you, if you're close and not too high; otherwise they hold where they are
    const follow = H && !H.dead && (g.agl ?? 99) < 160;
    const goal = follow ? [H.pos[0], H.pos[2]] : null;
    const lead = this.vehicles()[0];
    for (const u of this.units) {
      const veh = u.kind === 'veh', spd = veh ? VEH[u.type].spd : 4.6;
      if (u.rope > 0) { u.rope = Math.max(0, u.rope - dt * 9); continue; }
      // move
      let tx = null, tz = null, stopAt = veh ? 22 : 4;
      if (goal && Math.hypot(goal[0] - u.pos[0], goal[1] - u.pos[2]) < 900) {
        if (!veh && lead && Math.hypot(lead.pos[0] - u.pos[0], lead.pos[2] - u.pos[2]) < 120) {
          const a = u.slot * 1.3 + 0.6; tx = lead.pos[0] + Math.cos(a) * 6; tz = lead.pos[2] + Math.sin(a) * 6;
        } else { const a = u.slot * 1.3; tx = goal[0] + Math.cos(a) * (veh ? 0 : 7); tz = goal[1] + Math.sin(a) * (veh ? 0 : 7); }
      }
      const busy = u.target && u.target.alive && !veh;            // the team stop to shoot
      if (tx != null && !busy) {
        const dx = tx - u.pos[0], dz = tz - u.pos[2], d = Math.hypot(dx, dz);
        if (d > stopAt) {
          const want = Math.atan2(dx, dz), sp = Math.min(spd, d) * dt;
          // turn towards it (vehicles turn like vehicles), go round buildings by trying either side
          if (veh) { let dy = ((want - u.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; u.yaw += Math.max(-1.2 * dt, Math.min(1.2 * dt, dy)); } else u.yaw = want;
          for (const off of [0, 0.6, -0.6, 1.2, -1.2]) {
            const a = (veh ? u.yaw : want) + off, nx = u.pos[0] + Math.sin(a) * sp, nz = u.pos[2] + Math.cos(a) * sp;
            if (g.horde.blockedAt(nx, nz) || g.groundAt(nx, nz) < WATER + 0.2) continue;
            u.pos[0] = nx; u.pos[2] = nz; if (off && veh) u.yaw += off * dt; break;
          }
          u.moving = true;
        } else u.moving = false;
      } else u.moving = false;
      u.pos[1] = g.groundAt(u.pos[0], u.pos[2]);
      u.tgt.x = u.pos[0]; u.tgt.z = u.pos[2];
      // shoot: the nearest zombie in range (looked for a few times a second)
      const W = veh ? VEH[u.type].gun : INF[u.m.wpn] || INF.pistol;
      u.seek -= dt;
      if (u.seek <= 0) {
        u.seek = 0.25 + Math.random() * 0.1;
        let best = null, bd = W.range * W.range;
        for (const z of g.horde.list) { if (!z.alive) continue; const dx = z.x - u.pos[0], dz = z.z - u.pos[2], d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = z; } }
        u.target = best;
        // and they draw the dead in: anything close with nothing better to do comes for them
        if (Math.random() < 0.4) for (const z of g.horde.list) if (z.alive && !z.tgt && !z.ev && Math.abs(z.x - u.pos[0]) < 40 && Math.abs(z.z - u.pos[2]) < 40) z.tgt = u.tgt;
      }
      u.cd -= dt;
      const z = u.target;
      if (z && z.alive) {
        const want = Math.atan2(z.x - u.pos[0], z.z - u.pos[2]);
        if (veh) u.aim = want; else if (!u.moving) u.yaw = want;
        if (u.cd <= 0) {
          const role = !veh && u.m.role === 'rifleman' ? 1.2 : 1;
          u.cd = 1 / W.rate * (0.85 + Math.random() * 0.3);
          const o = veh ? [u.pos[0], u.pos[1] + (u.type === 'apc' ? 2.9 : u.type === 'humvee' ? 2.6 : 2.4), u.pos[2]] : [u.pos[0], u.pos[1] + 1.3, u.pos[2]];
          const d = [z.x - o[0], z.y + 1 - o[1], z.z - o[2]], L = Math.hypot(...d) || 1;
          g.tracer(o, d.map((c) => c / L), L, -1);
          if (W.splash) { g.blastAll([z.x, z.y + 0.5, z.z], W.splash, 300, W.dmg * 0.6, 'team'); g.boom?.([z.x, z.y + 0.5, z.z], 0.6); }
          g.horde.damage(z, W.dmg * role, [d[0] / L * 2, 0.5, d[2] / L * 2], 'team');
          if (!veh) u.m.flashT = 0.06; else u.flash = 0.06;
          if (this.t - (this.lastSnd || 0) > 0.09) { this.lastSnd = this.t; const near = Math.hypot(o[0] - H.pos[0], o[2] - H.pos[2]); if (near < 250) g.snd.burst?.(0.05, veh && W.splash ? 300 : 1400, 0.12 * (1 - near / 250), 'bandpass', 1.2); }
        }
      }
      if (u.flash > 0) u.flash -= dt;
    }
  }
  // markers: where your vehicles and team are (arrows at the edge of the screen when they're off it)
  marks() {
    const out = [];
    for (const u of this.vehicles()) out.push({ p: [u.pos[0], u.pos[1] + 6, u.pos[2]], col: '#c8ff5a', icon: '⛟', text: `${VEH[u.type].n} ${Math.ceil((u.hp / u.max) * 100)}%`, sub: '', friend: true });
    const T = this.team();
    if (T.length) { let x = 0, y = 0, z = 0; for (const u of T) { x += u.pos[0]; y += u.pos[1]; z += u.pos[2]; } out.push({ p: [x / T.length, y / T.length + 5, z / T.length], col: '#c8ff5a', icon: '☺', text: `TEAM · ${T.length}`, sub: T.map((u) => `${u.m.name} ${Math.ceil(u.m.hp)}`).join(' · '), friend: true }); }
    return out;
  }
  // for friends: what's on the ground
  net() {
    return this.units.map((u) => u.kind === 'veh' ? [0, VEH_IDS.indexOf(u.type), Math.round(u.pos[0] * 10) / 10, Math.round(u.pos[1] * 10) / 10, Math.round(u.pos[2] * 10) / 10, Math.round(u.yaw * 100), Math.round((u.aim || 0) * 100)]
      : [1, ROLE_IDS.indexOf(u.m.role), Math.round(u.pos[0] * 10) / 10, Math.round(u.pos[1] * 10) / 10, Math.round(u.pos[2] * 10) / 10, Math.round(u.yaw * 100), Object.keys(WEAPONS).indexOf(u.m.wpn)]);
  }
}

// a vehicle, drawn. Forward is +z at yaw 0.
export function vehParts(P, type, x, y, z, yaw, aim, flash) {
  const c = Math.cos(yaw), s = Math.sin(yaw), W = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const V = VEH[type] || VEH.technical, col = V.col, DK = [0.07, 0.07, 0.07], GM = [0.16, 0.17, 0.18];
  const wheel = (lx, lz, r) => P(W(lx, r, lz), [0, yaw, Math.PI / 2], [r * 2, 0.32, r * 2], DK, { shape: 'cylY', mat: 'rubber' });
  const gun = (lx, ly, lz, len, thick) => {
    const ca = Math.cos(aim), sa = Math.sin(aim), base = W(lx, ly, lz);
    P(base, [0, aim, 0], [0.5, 0.45, 0.7], GM, { mat: 'metal', shape: 0.05 });
    P([base[0] + sa * len / 2, base[1] + 0.05, base[2] + ca * len / 2], [0, aim, 0], [thick, thick, len], GM, { shape: 'cyl', mat: 'metal' });
    if (flash > 0) P([base[0] + sa * (len + 0.3), base[1] + 0.05, base[2] + ca * (len + 0.3)], [0, 0, 0], [0.5, 0.5, 0.5], [1, 0.8, 0.4], { em: 1, shape: 'sphere', alpha: 0.85 });
  };
  if (type === 'apc') {
    P(W(0, 1.35, 0), [0, yaw, 0], [2.9, 1.5, 7.2], col, { shape: 0.12, mat: 'paint' });
    P(W(0, 1.25, 3.85), [0.55, yaw, 0], [2.8, 1.1, 0.9], col, { shape: 0.08, mat: 'paint' });                   // sloped nose
    P(W(0, 2.15, -0.6), [0, yaw, 0], [2.95, 0.12, 4.8], col.map((v) => v * 0.85), { mat: 'metal' });
    for (const lz of [-2.6, -0.9, 0.9, 2.6]) for (const sd of [-1, 1]) wheel(sd * 1.5, lz, 0.6);
    P(W(0, 2.45, 0.3), [0, aim, 0], [1.7, 0.6, 1.9], col.map((v) => v * 0.9), { shape: 0.1, mat: 'paint' });  // turret
    gun(0, 2.6, 0.3, 2.6, 0.14);
    for (const sd of [-1, 1]) P(W(sd * 1.2, 2.1, 3.3), [0, yaw, 0], [0.25, 0.18, 0.05], [1, 0.95, 0.75], { em: 1 });
  } else if (type === 'humvee') {
    P(W(0, 1.05, 0), [0, yaw, 0], [2.3, 1.0, 4.8], col, { shape: 0.12, mat: 'paint' });
    P(W(0, 1.85, -0.4), [0, yaw, 0], [2.1, 0.75, 2.6], col, { shape: 0.1, mat: 'paint' });                         // cabin
    for (const sd of [-1, 1]) P(W(sd * 1.06, 1.85, -0.4), [0, yaw, 0], [0.04, 0.4, 1.8], [0.1, 0.13, 0.16], { mat: 'glass' });
    P(W(0, 1.85, 0.92), [0.15, yaw, 0], [1.9, 0.45, 0.04], [0.1, 0.13, 0.16], { mat: 'glass' });
    for (const lz of [-1.6, 1.6]) for (const sd of [-1, 1]) wheel(sd * 1.05, lz, 0.5);
    P(W(0, 2.35, -0.5), [0, aim, 0], [1.1, 0.35, 1.1], GM, { shape: 'cylY', mat: 'metal' });                       // turret ring
    gun(0, 2.6, -0.5, 1.5, 0.09);
    for (const sd of [-1, 1]) P(W(sd * 0.8, 1.2, 2.42), [0, yaw, 0], [0.3, 0.18, 0.05], [1, 0.95, 0.75], { em: 1 });
  } else {
    P(W(0, 0.95, 0), [0, yaw, 0], [2.0, 0.7, 5.0], col, { shape: 0.1, mat: 'paint' });
    P(W(0, 1.7, 1.0), [0, yaw, 0], [1.9, 0.9, 1.8], col, { shape: 0.12, mat: 'paint' });                           // cab
    P(W(0, 1.75, 1.92), [0.25, yaw, 0], [1.7, 0.55, 0.04], [0.1, 0.13, 0.16], { mat: 'glass' });
    for (const sd of [-1, 1]) P(W(sd * 0.98, 1.4, -1.2), [0, yaw, 0], [0.08, 0.5, 2.4], col.map((v) => v * 0.8), { mat: 'paint' });   // bed sides
    for (const lz of [-1.5, 1.5]) for (const sd of [-1, 1]) wheel(sd * 0.95, lz, 0.45);
    P(W(0, 1.75, -1.2), [0, yaw, 0], [0.12, 1.0, 0.12], GM, { mat: 'metal' });                                     // gun post
    gun(0, 2.35, -1.2, 1.4, 0.09);
    for (const sd of [-1, 1]) P(W(sd * 0.7, 1.0, 2.52), [0, yaw, 0], [0.3, 0.16, 0.05], [1, 0.95, 0.75], { em: 1 });
  }
}
