'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { Books } from './Books';
import { CameraRig } from './CameraRig';
import { Dust } from './Dust';
import { FloatingPages } from './FloatingPages';
import { LightShafts } from './LightShafts';
import { BACKGROUND, LIGHT_COLOR, type SceneInput, type SceneProfile } from './profile';

/**
 * Watches frame time and steps quality down if the device struggles:
 * first drops post-processing, then caps the pixel ratio at 1.
 */
function AdaptiveQuality({ onDegrade }: { onDegrade: () => void }) {
  const samples = useRef({ total: 0, frames: 0 });
  const setDpr = useThree((state) => state.setDpr);
  const level = useRef(0);

  useFrame((_, delta) => {
    const s = samples.current;
    // Ignore huge gaps (tab switches, the first compile).
    if (delta > 0.25) return;
    s.total += delta;
    s.frames += 1;
    if (s.frames < 90) return;
    const avg = s.total / s.frames;
    s.total = 0;
    s.frames = 0;
    if (avg > 1 / 40 && level.current < 2) {
      level.current += 1;
      if (level.current === 1) onDegrade();
      if (level.current === 2) setDpr(1);
    }
  });
  return null;
}

/** Tells the parent once a real frame has been drawn, so it can fade the canvas in. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(onReady);
  });
  return null;
}

export default function LibraryCanvas({
  profile,
  input,
  active,
  onReady,
}: {
  profile: SceneProfile;
  input: SceneInput;
  active: boolean;
  onReady: () => void;
}) {
  const [post, setPost] = useState(profile.postprocessing);

  useEffect(() => setPost(profile.postprocessing), [profile]);

  return (
    <Canvas
      className="hero-canvas-el"
      dpr={[1, profile.maxDpr]}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: 48, near: 0.1, far: 60, position: [0, 1.6, 23] }}
      aria-hidden
      tabIndex={-1}
    >
      <color attach="background" args={[BACKGROUND]} />
      <fog attach="fog" args={[BACKGROUND, 14, 40]} />

      <hemisphereLight args={['#7d8fc4', '#2a1d0e', 1.1]} />
      <directionalLight position={[8, 12, -4]} intensity={3.4} color={LIGHT_COLOR} />
      <directionalLight position={[-8, 2, 6]} intensity={0.9} color="#7f9bff" />
      <pointLight position={[2, 1, 8]} intensity={40} distance={26} decay={2} color="#ffb877" />

      <Books count={profile.books} spread={profile.spread} />
      <FloatingPages count={profile.pages} spread={profile.spread} />
      <LightShafts spread={profile.spread} />
      <Dust count={profile.dust} spread={profile.spread} />
      <CameraRig input={input} />

      <FirstFrame onReady={onReady} />
      <AdaptiveQuality onDegrade={() => setPost(false)} />

      {post && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom mipmapBlur intensity={0.65} luminanceThreshold={0.5} luminanceSmoothing={0.25} radius={0.72} />
          <Vignette offset={0.28} darkness={0.72} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
