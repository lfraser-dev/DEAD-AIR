// procedural background music: a slow minor pad and bass that never stops, with drums and an arp that
// fade in when the fighting starts. Notes are scheduled a little ahead on the audio clock.
const A = 220;
const hz = (semi) => A * Math.pow(2, semi / 12);
// chords as semitones from A: Am, F, C, G  /  Am, Em, F, G
const PROG = [
  [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
  [[0, 3, 7], [-5, -2, 2], [-4, 0, 3], [-2, 2, 5]],
];
const ARP = [0, 1, 2, 1, 2, 0, 1, 2];

export class Music {
  constructor(snd) {
    this.snd = snd; this.on = false; this.vol = 0.5; this.I = 0; this.next = 0; this.step = 0; this.bar = 0;
  }
  start() {
    const c = this.snd.ctx;
    if (!c || this.out) return;
    this.out = c.createGain(); this.out.gain.value = 0;
    // the music has its own volume, so it skips the sound-effects volume
    if (!this.snd.musicBus) { this.snd.musicBus = c.createGain(); this.snd.musicBus.gain.value = 0.5; this.snd.musicBus.connect(c.destination); }
    this.out.connect(this.snd.musicBus);
    this.pad = c.createGain(); this.pad.gain.value = 1; this.pad.connect(this.out);
    this.hot = c.createGain(); this.hot.gain.value = 0; this.hot.connect(this.out);
    this.next = c.currentTime + 0.1;
  }
  stop() {
    if (!this.out) return;
    const c = this.snd.ctx, o = this.out;
    o.gain.setTargetAtTime(0, c.currentTime, 0.3);
    setTimeout(() => { try { o.disconnect(); } catch { /* gone */ } }, 1500);
    this.out = null;
  }
  // intensity 0..1 (calm .. heavy fighting), call every frame
  tick(on, intensity) {
    const c = this.snd.ctx;
    if (!c) return;
    if (!on) { this.stop(); return; }
    if (!this.out) this.start();
    const t = c.currentTime;
    this.I += (intensity - this.I) * 0.02;
    this.out.gain.setTargetAtTime(0.16 * this.vol, t, 0.5);
    this.hot.gain.setTargetAtTime(Math.min(1, this.I * 1.4), t, 0.6);
    const beat = 60 / (84 + this.I * 30) / 2;           // eighth notes
    if (this.next < t - 1) this.next = t + 0.05;          // the tab slept: catch up
    while (this.next < t + 0.35) { this.play(this.next, beat); this.next += beat; }
  }
  play(t, beat) {
    const s = this.step % 8, bar = this.bar, prog = PROG[Math.floor(bar / 4) % 2], ch = prog[bar % 4];
    if (s === 0) {
      // the pad: one soft chord for the whole bar
      for (const n of ch) this.note(this.pad, hz(n), t, beat * 8.2, 'triangle', 0.05, 1.2, 700);
      this.note(this.pad, hz(ch[0] - 24), t, beat * 7.5, 'sine', 0.22, 0.05, 300);
    }
    if (s === 4) this.note(this.pad, hz(ch[0] - 24), t, beat * 3.5, 'sine', 0.16, 0.05, 300);
    // the fighting layer
    this.note(this.hot, hz(ch[ARP[s]] + 12), t, beat * 0.9, 'square', 0.025, 0.005, 1800);
    if (s === 0 || s === 3 || s === 4) this.kick(t);
    if (s === 2 || s === 6) this.snare(t);
    this.hat(t, s % 2 ? 0.015 : 0.03);
    this.step++;
    if (this.step % 8 === 0) this.bar++;
  }
  note(dst, f, t, dur, type, vol, att, cut) {
    const c = this.snd.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.value = f;
    const o2 = type === 'triangle' ? c.createOscillator() : null;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut;
    const g = c.createGain(); g.gain.value = 0;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setTargetAtTime(0, t + Math.max(att, dur - 0.3), 0.25);
    o.connect(lp);
    if (o2) { o2.type = type; o2.frequency.value = f * 1.006; o2.connect(lp); o2.start(t); o2.stop(t + dur + 1.5); }
    lp.connect(g).connect(dst);
    o.start(t); o.stop(t + dur + 1.5);
  }
  kick(t) {
    const c = this.snd.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.hot); o.start(t); o.stop(t + 0.32);
  }
  snare(t) {
    const c = this.snd.ctx;
    const n = c.createBufferSource(); n.buffer = this.snd.noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(bp).connect(g).connect(this.hot); n.start(t, Math.random()); n.stop(t + 0.2);
  }
  hat(t, v) {
    const c = this.snd.ctx;
    const n = c.createBufferSource(); n.buffer = this.snd.noise;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(hp).connect(g).connect(this.hot); n.start(t, Math.random()); n.stop(t + 0.06);
  }
}
