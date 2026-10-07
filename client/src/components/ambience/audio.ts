/**
 * Procedural soundscapes on Web Audio: filtered noise beds plus scheduled
 * events (crackles, chimes, cricket chirps). No audio files. Loaded lazily the
 * first time someone turns sound on or starts a focus timer.
 */

type Voice = { stop: () => void };

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: Record<'white' | 'pink' | 'brown', AudioBuffer> | null = null;
  private voice: Voice | null = null;
  private voiceGain: GainNode | null = null;
  private scene: string | null = null;

  /** Must run inside a user gesture the first time. */
  unlock(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolume(volume: number): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime, 0.1);
  }

  play(scene: string, volume: number): void {
    const ctx = this.unlock();
    this.setVolume(volume);
    if (this.scene === scene && this.voice) return;
    this.fadeOutCurrent();

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master!);
    gain.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
    this.voiceGain = gain;
    this.scene = scene;
    this.voice = this.build(scene, gain);
  }

  stop(): void {
    this.fadeOutCurrent();
    this.scene = null;
  }

  /** A soft two-note bell, for the end of a focus session. Plays even when ambience is off. */
  chime(): void {
    const ctx = this.unlock();
    const out = ctx.createGain();
    out.gain.value = 0.35;
    out.connect(ctx.destination);
    [659.25, 987.77].forEach((freq, i) => this.bell(ctx, out, freq, ctx.currentTime + i * 0.28, 2.6, 0.5));
    window.setTimeout(() => out.disconnect(), 4000);
  }

  private fadeOutCurrent(): void {
    if (!this.ctx || !this.voiceGain || !this.voice) return;
    const { voice, voiceGain } = this;
    voiceGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    window.setTimeout(() => {
      voice.stop();
      voiceGain.disconnect();
    }, 1800);
    this.voice = null;
    this.voiceGain = null;
  }

  private buffers(ctx: AudioContext) {
    if (this.noise) return this.noise;
    const make = (kind: 'white' | 'pink' | 'brown') => {
      const length = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (kind === 'white') data[i] = white * 0.5;
        else if (kind === 'pink') {
          b0 = 0.99765 * b0 + white * 0.099046;
          b1 = 0.963 * b1 + white * 0.2965164;
          b2 = 0.57 * b2 + white * 1.0526913;
          data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
        } else {
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5;
        }
      }
      return buffer;
    };
    this.noise = { white: make('white'), pink: make('pink'), brown: make('brown') };
    return this.noise;
  }

  /** A looping noise source through a filter, at a fixed level. */
  private bed(ctx: AudioContext, out: AudioNode, kind: 'white' | 'pink' | 'brown', type: BiquadFilterType, freq: number, level: number) {
    const src = ctx.createBufferSource();
    src.buffer = this.buffers(ctx)[kind];
    src.loop = true;
    src.loopStart = Math.random();
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(filter).connect(gain).connect(out);
    src.start();
    return { src, filter, gain };
  }

  private bell(ctx: AudioContext, out: AudioNode, freq: number, at: number, decay: number, level: number) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + decay + 0.1);
  }

  /** Calls `fire` at random intervals until stopped. */
  private every(min: number, max: number, fire: () => void): () => void {
    let id = 0;
    const loop = () => {
      fire();
      id = window.setTimeout(loop, min + Math.random() * (max - min));
    };
    id = window.setTimeout(loop, min + Math.random() * (max - min));
    return () => window.clearTimeout(id);
  }

  private build(scene: string, out: GainNode): Voice {
    const ctx = this.ctx!;
    const sources: AudioScheduledSourceNode[] = [];
    const timers: (() => void)[] = [];
    const add = (b: { src: AudioScheduledSourceNode }) => sources.push(b.src);

    switch (scene) {
      case 'rain': {
        add(this.bed(ctx, out, 'pink', 'lowpass', 5200, 0.55));
        add(this.bed(ctx, out, 'brown', 'lowpass', 260, 0.35));
        timers.push(
          this.every(60, 260, () => {
            const t = ctx.currentTime;
            this.bell(ctx, out, 1800 + Math.random() * 2600, t, 0.05, 0.03);
          })
        );
        break;
      }
      case 'hearth': {
        add(this.bed(ctx, out, 'brown', 'lowpass', 320, 0.55));
        timers.push(
          this.every(40, 420, () => {
            const t = ctx.currentTime;
            const src = ctx.createBufferSource();
            src.buffer = this.buffers(ctx).white;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1500 + Math.random() * 3000;
            filter.Q.value = 1.2;
            const gain = ctx.createGain();
            const level = 0.1 + Math.random() * 0.35;
            gain.gain.setValueAtTime(level, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02 + Math.random() * 0.05);
            src.connect(filter).connect(gain).connect(out);
            src.start(t, Math.random() * 2, 0.1);
          })
        );
        break;
      }
      case 'stars': {
        add(this.bed(ctx, out, 'pink', 'lowpass', 700, 0.12));
        timers.push(
          this.every(1800, 5200, () => {
            const freq = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
            this.bell(ctx, out, freq, ctx.currentTime, 4.5, 0.08);
            this.bell(ctx, out, freq * 2.01, ctx.currentTime, 2, 0.02);
          })
        );
        break;
      }
      case 'snow': {
        const wind = this.bed(ctx, out, 'pink', 'bandpass', 500, 0.9);
        wind.filter.Q.value = 0.8;
        add(wind);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const depth = ctx.createGain();
        depth.gain.value = 300;
        lfo.connect(depth).connect(wind.filter.frequency);
        const swell = ctx.createOscillator();
        swell.frequency.value = 0.045;
        const swellDepth = ctx.createGain();
        swellDepth.gain.value = 0.35;
        swell.connect(swellDepth).connect(wind.gain.gain);
        lfo.start();
        swell.start();
        sources.push(lfo, swell);
        break;
      }
      case 'garden': {
        add(this.bed(ctx, out, 'brown', 'lowpass', 400, 0.2));
        const cricket = (pitch: number, level: number) =>
          this.every(700, 1600, () => {
            const t0 = ctx.currentTime;
            for (let i = 0; i < 3; i++) {
              const t = t0 + i * 0.075;
              const osc = ctx.createOscillator();
              osc.frequency.value = pitch;
              const gain = ctx.createGain();
              gain.gain.setValueAtTime(0, t);
              gain.gain.linearRampToValueAtTime(level, t + 0.008);
              gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
              osc.connect(gain).connect(out);
              osc.start(t);
              osc.stop(t + 0.06);
            }
          });
        timers.push(cricket(4300, 0.025), cricket(4720, 0.015));
        break;
      }
      default: {
        // Night library: room tone and the occasional distant creak of a shelf.
        add(this.bed(ctx, out, 'brown', 'lowpass', 420, 0.5));
        add(this.bed(ctx, out, 'pink', 'lowpass', 1200, 0.05));
        timers.push(
          this.every(9000, 20000, () => this.bell(ctx, out, 90 + Math.random() * 40, ctx.currentTime, 1.4, 0.05))
        );
      }
    }

    return {
      stop: () => {
        timers.forEach((off) => off());
        sources.forEach((s) => {
          try {
            s.stop();
          } catch {
            /* already stopped */
          }
        });
      },
    };
  }
}

export const sound = new SoundEngine();
