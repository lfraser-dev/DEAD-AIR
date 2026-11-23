// DEAD AIR: playing with friends. The pilot HOSTS (TEAM screen → INVITE FRIENDS) and gets a 5-letter code; up to two
// friends JOIN with it (title screen) and ride in the doors as gunners, aiming and firing the door guns themselves.
//
// The pilot's game runs everything (flying, zombies, scenarios). It sends the friends: the helicopter ~20 times a
// second, the zombies near it ~7 times a second, the scenarios 4 times a second, and effects (tracers, explosions,
// kills, messages) as they happen. Friends send back where they're aiming and whether they're firing; the pilot's
// game fires their gun for them. Same city on both sides (it's built from a fixed seed), so it never has to be sent.
//
// SERVERS: a pilot can make a server with a name. Public servers show up in the list on the JOIN screen (each one is a
// small retained message on the relay that the host keeps fresh); private ones only work with the code.
// Friends can either ride in the doors, or fly their own helicopter alongside (a WINGMAN): their game flies it, the
// pilot's game runs the zombies and decides what their bullets hit.
//
// Messages go through a public MQTT server over a secure WebSocket (works on school and phone networks), the same
// way The Semi-Finals does online. `?net=local` uses a BroadcastChannel instead, for testing in two tabs.
const MQTTJS = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
const BROKERS = [
  { name: 'emqx', url: 'wss://broker.emqx.io:8084/mqtt' },
  { name: 'hivemq', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { name: 'shiftr', url: 'wss://public.cloud.shiftr.io', username: 'public', password: 'public' },
  { name: 'mosquitto', url: 'wss://test.mosquitto.org:8081/mqtt' },
];
const TOPIC = 'deadair-heli/v1/';
const rid = () => Math.random().toString(36).slice(2, 10);
export const code5 = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

let mqttLib = null;
function loadMQTT() {
  if (window.mqtt) return Promise.resolve(window.mqtt);
  if (mqttLib) return mqttLib;
  mqttLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = MQTTJS; s.async = true;
    s.onload = () => (window.mqtt ? res(window.mqtt) : rej(new Error("COULDN'T LOAD THE ONLINE LIBRARY.")));
    s.onerror = () => { mqttLib = null; rej(new Error("COULDN'T LOAD THE ONLINE LIBRARY. CHECK YOUR CONNECTION.")); };
    document.head.append(s);
  });
  return mqttLib;
}
function openBroker(mqtt, b, id) {
  return new Promise((res, rej) => {
    let c;
    try {
      c = mqtt.connect(b.url, { clientId: `da_${id}_${Math.random().toString(36).slice(2, 6)}`, username: b.username, password: b.password,
        clean: true, connectTimeout: 7000, reconnectPeriod: 0, keepalive: 20, protocolVersion: 4 });
    } catch (e) { rej(e); return; }
    const t = setTimeout(() => { try { c.end(true); } catch { /* ignore */ } rej(new Error('timeout')); }, 8000);
    c.once('connect', () => { clearTimeout(t); c.options.reconnectPeriod = 2000; res(c); });
    c.once('error', (e) => { clearTimeout(t); try { c.end(true); } catch { /* ignore */ } rej(e); });
  });
}
const firstOf = (ps) => new Promise((res, rej) => {
  let left = ps.length;
  if (!left) rej(new Error('none'));
  ps.forEach((p) => p.then(res, () => { if (--left === 0) rej(new Error('none')); }));
});
const parse = (buf) => { try { return JSON.parse(buf.toString()); } catch { return null; } };

// host: listen(code) → onPeer(id), onData(id, msg), onLeave(id), sendTo(id, msg)
// client: connect(code) → onData(msg), onLeave(), send(msg)
class RelayTransport {
  constructor() { this.id = rid(); this.peers = new Map(); }
  pub(topic, obj, retain = false) { try { this.c?.publish(TOPIC + this.code + topic, JSON.stringify(obj), { qos: 0, retain }); } catch { /* ignore */ } }
  // keep this server in the public list (or take it out)
  advertise(info) {
    this.info = info;
    if (!this.c) return;
    const body = info && info.pub ? JSON.stringify({ ...info, code: this.code, t: Date.now() }) : '';
    for (const c of [this.c, ...(this.extra || [])]) { try { c.publish(TOPIC + 'lobby/' + this.code, body, { qos: 0, retain: true }); } catch { /* ignore */ } }
  }
  async listen(code) {
    const mqtt = await loadMQTT();
    this.code = code;
    const tries = BROKERS.map((b) => openBroker(mqtt, b, this.id).then((c) => ({ c, b })));
    let got;
    try { got = await firstOf(tries); } catch { throw new Error("COULDN'T REACH ANY GAME SERVER. CHECK YOUR INTERNET AND TRY AGAIN."); }
    this.c = got.c; this.broker = got.b.name;
    // the other relays stay open just to put this server in the list (friends might only reach some of them)
    this.extra = [];
    tries.forEach((p) => p.then(({ c }) => { if (c === this.c) return; if (this.closed) { c.end(true); return; } this.extra.push(c); if (this.info) this.advertise(this.info); }, () => {}));
    this.c.subscribe(TOPIC + code + '/h');
    this.c.on('message', (topic, buf) => {
      const m = parse(buf); if (!m || !m.from) return;
      const known = this.peers.has(m.from);
      this.peers.set(m.from, Date.now());
      if (m.kind === 'hello') { this.pub('/c/' + m.from, { kind: 'welcome', from: 'host' }); if (!known) this.onPeer?.(m.from); }
      else if (m.kind === 'bye') { this.peers.delete(m.from); this.onLeave?.(m.from); }
      else if (m.kind === 'ping') { /* keep-alive */ }
      else if (known) this.onData?.(m.from, m.msg);
    });
    let adv = 0;
    const beat = () => {
      this.pub('/beacon', { t: Date.now() }, true);
      if (this.info && (adv++ % 2 === 0)) this.advertise(this.info);
      for (const [p, t] of this.peers) { this.pub('/c/' + p, { kind: 'ping', from: 'host' }); if (Date.now() - t > 9000) { this.peers.delete(p); this.onLeave?.(p); } }
    };
    beat();
    this.timer = setInterval(beat, 2500);
    return code;
  }
  async connect(code, onStatus) {
    const mqtt = await loadMQTT();
    this.code = code;
    onStatus?.('LOOKING FOR THE PILOT…');
    const found = await new Promise((res, rej) => {
      const clients = [];
      let pending = BROKERS.length, done = false;
      const finish = (val, err) => {
        if (done) return; done = true; clearTimeout(t);
        for (const c of clients) if (!val || c !== val.c) { try { c.end(true); } catch { /* ignore */ } }
        if (val) res(val); else rej(err);
      };
      const t = setTimeout(() => finish(null, new Error(clients.length ? 'NO GAME WITH THAT CODE. CHECK IT, AND THAT THE PILOT STILL HAS THE TEAM SCREEN OPEN OR IS FLYING.' : "COULDN'T REACH ANY GAME SERVER. CHECK YOUR INTERNET AND TRY AGAIN.")), 12000);
      BROKERS.forEach((b) => openBroker(mqtt, b, this.id).then((c) => {
        if (done) { c.end(true); return; }
        clients.push(c);
        c.subscribe(TOPIC + code + '/beacon');
        c.on('message', (topic, buf) => {
          if (!topic.endsWith('/beacon')) return;
          const m = parse(buf);
          if (m && m.t && Math.abs(Date.now() - m.t) < 5 * 60 * 1000) finish({ c, b });
        });
      }, () => { if (--pending === 0 && !clients.length) finish(null, new Error("COULDN'T REACH ANY GAME SERVER. CHECK YOUR INTERNET AND TRY AGAIN.")); }));
    });
    this.c = found.c;
    this.c.unsubscribe(TOPIC + code + '/beacon');
    this.c.removeAllListeners('message');
    onStatus?.('JOINING…');
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("FOUND THE GAME BUT THE PILOT DIDN'T ANSWER. TRY AGAIN.")), 9000);
      this.lastHost = Date.now();
      this.c.subscribe(TOPIC + code + '/c/' + this.id, () => this.pub('/h', { kind: 'hello', from: this.id }));
      this.c.on('message', (topic, buf) => {
        const m = parse(buf); if (!m) return;
        this.lastHost = Date.now();
        if (m.kind === 'welcome') { clearTimeout(t); res(); }
        else if (m.kind === 'ping') { /* keep-alive */ }
        else if (m.kind === 'bye') this.onLeave?.();
        else if (m.msg) this.onData?.(m.msg);
      });
    });
    this.timer = setInterval(() => {
      this.pub('/h', { kind: 'ping', from: this.id });
      if (Date.now() - this.lastHost > 10000) { clearInterval(this.timer); this.onLeave?.(); }
    }, 2500);
    return this.id;
  }
  sendTo(id, msg) { this.pub('/c/' + id, { from: 'host', msg }); }
  send(msg) { this.pub('/h', { from: this.id, msg }); }
  kick(id) { this.pub('/c/' + id, { kind: 'bye', from: 'host' }); this.peers.delete(id); }
  close() {
    clearInterval(this.timer);
    this.closed = true;
    for (const c of this.extra || []) { try { c.publish(TOPIC + 'lobby/' + this.code, '', { retain: true }); } catch { /* ignore */ } setTimeout(() => { try { c.end(true); } catch { /* ignore */ } }, 300); }
    this.extra = [];
    if (this.c) {
      try {
        if (this.lastHost) this.pub('/h', { kind: 'bye', from: this.id });
        else { for (const p of this.peers.keys()) this.pub('/c/' + p, { kind: 'bye', from: 'host' }); this.c.publish(TOPIC + this.code + '/beacon', '', { retain: true }); this.c.publish(TOPIC + 'lobby/' + this.code, '', { retain: true }); }
      } catch { /* ignore */ }
      const c = this.c;
      setTimeout(() => { try { c.end(true); } catch { /* ignore */ } }, 300);
    }
    this.c = null;
  }
}

class LocalTransport {
  constructor() { this.id = rid(); this.peers = new Set(); }
  advertise(info) {
    this.info = info;
    clearInterval(this.advT);
    const post = () => { try { new BroadcastChannel('da-lobby').postMessage(this.info && this.info.pub ? { ...this.info, code: this.code, t: Date.now() } : { code: this.code, gone: true }); } catch { /* ignore */ } };
    post(); this.advT = setInterval(post, 1000);
  }
  async listen(code) {
    this.code = code;
    this.ch = new BroadcastChannel('da-' + code);
    this.ch.onmessage = ({ data: m }) => {
      if (m.to !== this.id && m.to !== 'host') return;
      if (m.kind === 'hello') { this.peers.add(m.from); this.ch.postMessage({ to: m.from, kind: 'welcome', from: this.id }); this.onPeer?.(m.from); }
      else if (m.kind === 'bye') { this.peers.delete(m.from); this.onLeave?.(m.from); }
      else this.onData?.(m.from, m.msg);
    };
    return code;
  }
  async connect(code) {
    this.ch = new BroadcastChannel('da-' + code);
    return new Promise((res, rej) => {
      const fail = setTimeout(() => rej(new Error('NO GAME WITH THAT CODE.')), 3000);
      this.ch.onmessage = ({ data: m }) => {
        if (m.to !== this.id) return;
        if (m.kind === 'welcome') { clearTimeout(fail); this.hostId = m.from; res(this.id); }
        else if (m.kind === 'bye') this.onLeave?.();
        else this.onData?.(m.msg);
      };
      this.ch.postMessage({ to: 'host', kind: 'hello', from: this.id });
    });
  }
  sendTo(id, msg) { this.ch?.postMessage({ to: id, from: this.id, msg }); }
  send(msg) { this.ch?.postMessage({ to: this.hostId || 'host', from: this.id, msg }); }
  kick(id) { this.ch?.postMessage({ to: id, kind: 'bye', from: this.id }); this.peers.delete(id); }
  close() {
    clearInterval(this.advT);
    if (this.info) try { new BroadcastChannel('da-lobby').postMessage({ code: this.code, gone: true }); } catch { /* ignore */ }
    if (this.ch) {
      if (this.hostId) this.ch.postMessage({ to: this.hostId, kind: 'bye', from: this.id });
      else for (const p of this.peers) this.ch.postMessage({ to: p, kind: 'bye', from: this.id });
      this.ch.close();
    }
    this.ch = null;
  }
}

// the public server list: calls back with the servers it can see (newest first) until you call the stop function
export function listServers(onList, onStatus) {
  const seen = new Map();
  // a server stays in the list while it keeps saying hello (every 5 s). Computers' clocks can be minutes apart, so this
  // only goes by when THIS computer last heard from it.
  const emit = () => onList([...seen.values()].filter((v) => Date.now() - v.at < 25000).sort((a, b) => b.at - a.at));
  const take = (v, retained) => {
    if (!v || !v.code) return;
    if (v.gone || !v.name) { seen.delete(String(v.code).toUpperCase()); emit(); return; }
    // an old leftover from a server that crashed: ignore it unless it's recent (allowing for a badly set clock)
    if (retained && Math.abs(Date.now() - (+v.t || 0)) > 15 * 60000) return;
    const clean = { code: String(v.code).slice(0, 5).toUpperCase(), name: String(v.name).replace(/[^A-Za-z0-9 '!?-]/g, '').slice(0, 22) || 'SERVER', host: String(v.host || '').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 12), n: Math.max(0, Math.min(9, +v.n || 0)), max: Math.max(1, Math.min(9, +v.max || 5)), ch: Math.max(0, Math.min(9, +v.ch || 0)), world: +v.world || 0, at: Date.now() };
    seen.set(clean.code, clean); emit();
  };
  const tick = setInterval(emit, 3000);
  if (new URLSearchParams(location.search).get('net') === 'local') {
    const ch = new BroadcastChannel('da-lobby');
    ch.onmessage = ({ data }) => take(data, false);
    onStatus?.(1, 1);
    return () => { clearInterval(tick); ch.close(); };
  }
  const clients = [];
  let stopped = false, ok = 0, failed = 0;
  loadMQTT().then((mqtt) => {
    for (const b of BROKERS) openBroker(mqtt, b, rid()).then((c) => {
      if (stopped) { c.end(true); return; }
      clients.push(c); ok++; onStatus?.(ok, BROKERS.length);
      c.subscribe(TOPIC + 'lobby/+');
      c.on('message', (topic, buf, packet) => { const code = topic.split('/').pop(); if (!buf || !buf.length) { seen.delete(code); emit(); return; } take(parse(buf), !!(packet && packet.retain)); });
    }, () => { failed++; if (failed === BROKERS.length) onList(null); else onStatus?.(ok, BROKERS.length); });
  }, () => onList(null));
  return () => { stopped = true; clearInterval(tick); for (const c of clients) { try { c.end(true); } catch { /* ignore */ } } };
}

export const makeTransport = () => (new URLSearchParams(location.search).get('net') === 'local' ? new LocalTransport() : new RelayTransport());

// zombie types and states as small numbers for the wire
export const ZT = ['walker', 'runner', 'crawler', 'screamer', 'brute', 'bloater', 'riot', 'goliath', 'spitter', 'mother'];
export const ZS = ['walk', 'pile', 'roof', 'grab', 'fall'];
export const q1 = (v) => Math.round(v * 10) / 10;
export const q2 = (v) => Math.round(v * 100) / 100;
