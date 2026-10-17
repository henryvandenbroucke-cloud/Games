/**
 * Tiny synthesized sound kit (Web Audio API, no assets). Merge tones climb a
 * pentatonic scale with the tile value, so bigger merges literally sound
 * better — a small but powerful reward loop.
 */
type AudioContextCtor = typeof AudioContext;

const PENTATONIC = [0, 2, 4, 7, 9];

function noteFrequency(semitonesFromA3: number): number {
  return 220 * Math.pow(2, semitonesFromA3 / 12);
}

/** Map a tile value (2, 4, 8 …) to a pleasant, rising pitch. */
export function frequencyForValue(value: number): number {
  const step = Math.max(0, Math.log2(value) - 1); // 2 → 0, 4 → 1 …
  const octave = Math.floor(step / PENTATONIC.length);
  const degree = PENTATONIC[step % PENTATONIC.length];
  return noteFrequency(3 + octave * 12 + degree); // start on C4
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = false;

  /** Must be called from a user gesture at least once (autoplay policies). */
  unlock(): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor: AudioContextCtor | undefined =
      typeof window === 'undefined'
        ? undefined
        : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 6;
      const master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(compressor).connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      return ctx;
    } catch {
      return null;
    }
  }

  private ready(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.enabled) return null;
    const ctx = this.ensure();
    if (!ctx || !this.master) return null;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return { ctx, out: this.master };
  }

  private tone(freq: number, opts: { at?: number; duration?: number; gain?: number; type?: OscillatorType; glideTo?: number } = {}) {
    const r = this.ready();
    if (!r) return;
    const { ctx, out } = r;
    const start = ctx.currentTime + (opts.at ?? 0);
    const duration = opts.duration ?? 0.18;
    const peak = opts.gain ?? 0.25;

    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, start + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env).connect(out);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private whoosh(gain = 0.05) {
    const r = this.ready();
    if (!r) return;
    const { ctx, out } = r;
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * 0.12);
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    const t = ctx.currentTime;
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(2400, t + 0.08);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    src.connect(filter).connect(env).connect(out);
    src.start(t);
    src.stop(t + 0.12);
  }

  move() {
    this.whoosh(0.045);
  }

  /** `values` are the merge results of one move, any order. */
  merge(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b).slice(-3);
    sorted.forEach((value, i) => {
      const f = frequencyForValue(value);
      this.tone(f, { at: i * 0.045, duration: 0.2, gain: 0.22 });
      this.tone(f * 2, { at: i * 0.045, duration: 0.12, gain: 0.05, type: 'sine' });
    });
  }

  milestone(value: number) {
    const base = frequencyForValue(value);
    [1, 1.25, 1.5, 2].forEach((ratio, i) =>
      this.tone(base * ratio, { at: 0.05 + i * 0.06, duration: 0.32, gain: 0.16, type: 'sine' }),
    );
  }

  newBest() {
    this.tone(880, { duration: 0.16, gain: 0.12, type: 'sine' });
    this.tone(1318.5, { at: 0.09, duration: 0.3, gain: 0.12, type: 'sine' });
  }

  victory() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => this.tone(f, { at: i * 0.09, duration: 0.5, gain: 0.18 }));
    this.tone(1046.5, { at: 0.5, duration: 0.9, gain: 0.12, type: 'sine' });
    this.tone(1567.98, { at: 0.5, duration: 0.9, gain: 0.08, type: 'sine' });
  }

  gameOver() {
    [392, 329.63, 261.63].forEach((f, i) =>
      this.tone(f, { at: i * 0.16, duration: 0.42, gain: 0.16, type: 'sine', glideTo: f * 0.97 }),
    );
  }

  tap() {
    this.tone(1200, { duration: 0.04, gain: 0.06, type: 'sine', glideTo: 900 });
  }
}

export const sound = new SoundEngine();
