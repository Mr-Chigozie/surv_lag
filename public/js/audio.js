// All sound is synthesised with Web Audio, so there are no asset files to ship.
const ENGINE = {
  car: { base: 55, range: 120, type: "sawtooth", cutoff: 900, gain: 0.05 },
  bike: { base: 90, range: 230, type: "square", cutoff: 1500, gain: 0.035 },
  bus: { base: 38, range: 70, type: "sawtooth", cutoff: 600, gain: 0.06 }
};
const HORNS = {
  car: [420, 525],
  bike: [660, 0],
  bus: [300, 378],
  danfo: [330, 415],
  okada: [700, 0],
  truck: [180, 228],
  tanker: [185, 233],
  brt: [260, 328]
};

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engine = null;
    this.hornNodes = null;
  }

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        const length = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      } catch (error) {
        console.warn("Audio unavailable", error);
        this.enabled = false;
        return null;
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    if (on) this.ensure();
  }

  tone(freq, duration = 0.12, type = "sine", volume = 0.08, when = 0, pan = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(panner).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noiseBurst(duration = 0.3, cutoff = 800, volume = 0.25, sweepTo = null) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = sweepTo ? "bandpass" : "lowpass";
    filter.frequency.setValueAtTime(cutoff, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + duration);
  }

  startEngine(vehicle) {
    this.stopEngine();
    const ctx = this.ensure();
    if (!ctx) return;
    const spec = ENGINE[vehicle];
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = spec.type;
    sub.type = "triangle";
    filter.type = "lowpass";
    filter.frequency.value = spec.cutoff;
    filter.Q.value = 2;
    gain.gain.value = 0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(this.master);
    osc.start();
    sub.start();
    gain.gain.setTargetAtTime(spec.gain, ctx.currentTime, 0.3);
    this.engine = { osc, sub, filter, gain, spec };
  }

  updateEngine(speedRatio, throttle, paused = false) {
    if (!this.engine || !this.ctx) return;
    const { osc, sub, filter, gain, spec } = this.engine;
    const t = this.ctx.currentTime;
    // fake gear shifts: rpm climbs within each gear then drops
    const gears = 5;
    const g = Math.min(gears - 1, Math.floor(speedRatio * gears));
    const within = speedRatio * gears - g;
    const rpm = 0.25 + within * 0.6 + g * 0.06 + throttle * 0.08;
    const freq = spec.base + rpm * spec.range;
    osc.frequency.setTargetAtTime(freq, t, 0.06);
    sub.frequency.setTargetAtTime(freq / 2, t, 0.06);
    filter.frequency.setTargetAtTime(spec.cutoff * (0.7 + throttle * 0.6 + speedRatio * 0.5), t, 0.1);
    gain.gain.setTargetAtTime(paused ? 0 : spec.gain * (0.6 + throttle * 0.5), t, 0.1);
  }

  stopEngine() {
    if (!this.engine) return;
    const { osc, sub, gain } = this.engine;
    const t = this.ctx.currentTime;
    gain.gain.setTargetAtTime(0, t, 0.08);
    osc.stop(t + 0.4);
    sub.stop(t + 0.4);
    this.engine = null;
  }

  hornOn(vehicle) {
    const ctx = this.ensure();
    if (!ctx || this.hornNodes) return;
    const [f1, f2] = HORNS[vehicle];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    filter.connect(gain).connect(this.master);
    const oscs = [f1, f2].filter(Boolean).map((f) => {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      o.connect(filter);
      o.start();
      return o;
    });
    this.hornNodes = { gain, oscs };
  }

  hornOff() {
    if (!this.hornNodes || !this.ctx) return;
    const { gain, oscs } = this.hornNodes;
    const t = this.ctx.currentTime;
    gain.gain.setTargetAtTime(0.0001, t, 0.03);
    oscs.forEach((o) => o.stop(t + 0.2));
    this.hornNodes = null;
  }

  distantHonk(vehicle, distance, pan) {
    const [f1, f2] = HORNS[vehicle] || HORNS.car;
    const volume = Math.max(0.005, 0.04 * (1 - distance / 80));
    const beeps = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < beeps; i++) {
      this.tone(f1, 0.12, "square", volume, i * 0.17, pan);
      if (f2) this.tone(f2, 0.12, "square", volume * 0.8, i * 0.17, pan);
    }
  }

  crash(intensity = 1) {
    this.noiseBurst(0.35 + intensity * 0.25, 900, Math.min(0.5, 0.18 + intensity * 0.2));
    this.tone(70, 0.3, "sine", 0.15);
  }
  scrape() { this.noiseBurst(0.12, 2600, 0.05); }
  pothole() { this.tone(55, 0.22, "sine", 0.22); this.noiseBurst(0.1, 300, 0.12); }
  coin() { this.tone(988, 0.08, "triangle", 0.05); this.tone(1319, 0.14, "triangle", 0.05, 0.06); }
  repair() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, "triangle", 0.05, i * 0.07)); }
  nearMiss() { this.noiseBurst(0.35, 400, 0.12, 3000); }
  countdown(go = false) { this.tone(go ? 880 : 440, go ? 0.45 : 0.18, "square", 0.05); }
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.06, i * 0.11)); }
  lose() { [330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.35, "sawtooth", 0.04, i * 0.16)); }
  pedestrian() { this.tone(620, 0.1, "square", 0.05); this.tone(520, 0.18, "square", 0.05, 0.1); }
}
