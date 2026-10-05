/**
 * The hero scene in plain CSS: light from a high window, a few drifting
 * books and dust. It paints with the first HTML, so the hero never waits for
 * WebGL, and it is the permanent scene when 3D is unavailable or turned off.
 */

const BOOKS = [
  { x: '68%', y: '14%', w: 30, h: 150, r: -18, c: '#6b1f24', d: 0, blur: 0 },
  { x: '82%', y: '42%', w: 40, h: 176, r: 24, c: '#1f4a3a', d: -4, blur: 0 },
  { x: '58%', y: '62%', w: 26, h: 128, r: -36, c: '#8a6428', d: -9, blur: 1.5 },
  { x: '90%', y: '8%', w: 22, h: 112, r: 12, c: '#1d2b55', d: -6, blur: 2.5 },
  { x: '74%', y: '74%', w: 34, h: 150, r: 64, c: '#4a2747', d: -2, blur: 0.5 },
  { x: '48%', y: '6%', w: 20, h: 100, r: 40, c: '#1f4f5a', d: -12, blur: 3 },
  { x: '6%', y: '82%', w: 24, h: 118, r: -52, c: '#5a3b24', d: -7, blur: 2 },
];

export function HeroFallback({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className={`hero-fallback${hidden ? ' is-hidden' : ''}`}>
      <div className="hf-glow" />
      <div className="hf-shaft hf-shaft-1" />
      <div className="hf-shaft hf-shaft-2" />
      <div className="hf-shaft hf-shaft-3" />
      {BOOKS.map((b, i) => (
        <span
          key={i}
          className="hf-book"
          style={
            {
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.h,
              '--r': `${b.r}deg`,
              '--c': b.c,
              animationDelay: `${b.d}s`,
              filter: b.blur ? `blur(${b.blur}px)` : undefined,
            } as React.CSSProperties
          }
        />
      ))}
      <div className="hf-dust hf-dust-near" />
      <div className="hf-dust hf-dust-far" />
    </div>
  );
}
