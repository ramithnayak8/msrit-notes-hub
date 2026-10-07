import type { ParticleKind } from './scenes';

/**
 * A small 2D particle field for the ambience layer. Glowing particles are
 * drawn from one pre-rendered sprite, rain is one batched path per frame, and
 * motion is scaled by frame time so it looks the same at 30 or 120 fps.
 */

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  life: number;
};

export type FieldOptions = {
  kind: ParticleKind;
  color: string;
  density: number;
  /** 1 at full effects, lower for "lite". */
  scale: number;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function makeSprite(color: string): HTMLCanvasElement {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // Fade to the same colour at zero alpha; 'transparent' is black and leaves a dark fringe.
  g.addColorStop(0, color);
  g.addColorStop(0.25, `${color}aa`);
  g.addColorStop(1, `${color}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export class ParticleField {
  private ctx: CanvasRenderingContext2D;
  private particles: P[] = [];
  private sprite: HTMLCanvasElement;
  private w = 0;
  private h = 0;
  private t = 0;
  private nextShootingStar = 0;
  private shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null;

  constructor(private canvas: HTMLCanvasElement, private opts: FieldOptions) {
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.sprite = makeSprite(opts.color);
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.scale < 1 ? 1 : 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = Math.round(((this.w * this.h) / 1e6) * this.opts.density * this.opts.scale);
    const count = Math.max(8, Math.min(target, 260));
    while (this.particles.length < count) this.particles.push(this.spawn(true));
    this.particles.length = count;
  }

  private spawn(anywhere: boolean): P {
    const { w, h } = this;
    const base: P = { x: rand(0, w), y: rand(0, h), vx: 0, vy: 0, size: 2, alpha: 0.5, phase: rand(0, Math.PI * 2), life: 1 };
    switch (this.opts.kind) {
      case 'dust':
        return { ...base, vx: rand(-0.08, 0.08), vy: rand(-0.16, -0.04), size: rand(1.5, 4.5), alpha: rand(0.18, 0.5) };
      case 'rain':
        return { ...base, y: anywhere ? base.y : rand(-h * 0.2, 0), vy: rand(9, 15), size: rand(10, 22), alpha: rand(0.1, 0.24) };
      case 'ember':
        return {
          ...base,
          y: anywhere ? rand(h * 0.4, h) : h + rand(0, 40),
          vx: rand(-0.25, 0.25),
          vy: rand(-0.9, -0.35),
          size: rand(1.5, 3.8),
          alpha: rand(0.4, 0.85),
          life: anywhere ? rand(0.2, 1) : 1,
        };
      case 'star':
        return { ...base, size: rand(0.8, 2.4), alpha: rand(0.25, 0.8) };
      case 'snow':
        return { ...base, y: anywhere ? base.y : rand(-40, 0), vx: rand(-0.2, 0.2), vy: rand(0.35, 1.1), size: rand(2, 5.5), alpha: rand(0.35, 0.8) };
      case 'firefly':
        return { ...base, y: rand(h * 0.25, h), vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), size: rand(3, 5.5), alpha: rand(0.5, 0.95) };
    }
  }

  /** Advance by `dt` milliseconds and draw one frame. */
  frame(dt: number): void {
    const step = Math.min(dt, 64) / 16.67;
    this.t += dt / 1000;
    const { ctx, w, h, t } = this;
    ctx.clearRect(0, 0, w, h);

    if (this.opts.kind === 'rain') {
      ctx.strokeStyle = this.opts.color;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      // Two alpha bands keep it to two strokes per frame.
      for (const band of [0, 1]) {
        ctx.globalAlpha = band ? 0.24 : 0.12;
        ctx.beginPath();
        for (let i = band; i < this.particles.length; i += 2) {
          const p = this.particles[i];
          p.y += p.vy * step;
          p.x += p.vy * 0.12 * step;
          if (p.y > h + 30 || p.x > w + 30) Object.assign(p, this.spawn(false), { x: rand(-w * 0.15, w) });
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.size * 0.12, p.y - p.size);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return;
    }

    for (const p of this.particles) {
      let alpha = p.alpha;
      switch (this.opts.kind) {
        case 'dust':
          p.x += (p.vx + Math.sin(t * 0.4 + p.phase) * 0.06) * step;
          p.y += p.vy * step;
          alpha *= 0.6 + 0.4 * Math.sin(t * 0.8 + p.phase);
          break;
        case 'ember':
          p.x += (p.vx + Math.sin(t * 1.6 + p.phase) * 0.35) * step;
          p.y += p.vy * step;
          p.life -= 0.0028 * step;
          alpha *= Math.max(0, p.life) * (0.75 + 0.25 * Math.sin(t * 9 + p.phase));
          if (p.life <= 0) Object.assign(p, this.spawn(false));
          break;
        case 'star':
          alpha *= 0.55 + 0.45 * Math.sin(t * (0.6 + (p.phase % 1)) + p.phase);
          break;
        case 'snow':
          p.x += (p.vx + Math.sin(t * 0.7 + p.phase) * 0.3) * step;
          p.y += p.vy * step;
          break;
        case 'firefly':
          p.vx += rand(-0.03, 0.03) * step;
          p.vy += rand(-0.03, 0.03) * step;
          p.vx = Math.max(-0.45, Math.min(0.45, p.vx));
          p.vy = Math.max(-0.45, Math.min(0.45, p.vy));
          p.x += p.vx * step;
          p.y += p.vy * step;
          alpha *= Math.max(0, Math.sin(t * 0.9 + p.phase)) ** 2;
          break;
      }

      // Wrap around the edges.
      if (p.x < -20) p.x = w + 20;
      else if (p.x > w + 20) p.x = -20;
      if (p.y < -20) {
        if (this.opts.kind === 'ember') Object.assign(p, this.spawn(false));
        else p.y = h + 20;
      } else if (p.y > h + 20) p.y = -20;

      if (alpha < 0.01) continue;
      const r = p.size * (this.opts.kind === 'firefly' ? 4 : 3);
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.sprite, p.x - r, p.y - r, r * 2, r * 2);
    }

    if (this.opts.kind === 'star') this.drawShootingStar(dt);
    ctx.globalAlpha = 1;
  }

  private drawShootingStar(dt: number): void {
    const { ctx, w, h } = this;
    if (!this.shooting && this.t > this.nextShootingStar) {
      this.nextShootingStar = this.t + rand(7, 16);
      this.shooting = { x: rand(w * 0.2, w), y: rand(0, h * 0.4), vx: -rand(7, 10), vy: rand(2.5, 4), life: 1 };
    }
    const s = this.shooting;
    if (!s) return;
    const step = Math.min(dt, 64) / 16.67;
    s.x += s.vx * step;
    s.y += s.vy * step;
    s.life -= 0.022 * step;
    if (s.life <= 0) {
      this.shooting = null;
      return;
    }
    const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 12, s.y - s.vy * 12);
    g.addColorStop(0, this.opts.color);
    g.addColorStop(1, `${this.opts.color}00`);
    ctx.globalAlpha = s.life * 0.8;
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 12, s.y - s.vy * 12);
    ctx.stroke();
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }
}
