'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneInput } from './profile';

const INTRO_SECONDS = 2.6;
const START = new THREE.Vector3(0, 1.6, 23);
const REST = new THREE.Vector3(0, 0, 14);

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Three inputs move the camera: a one-off dolly-in on load, scroll (flies
 * forward and down through the books as the hero scrolls away) and the
 * pointer (a small damped parallax).
 */
export function CameraRig({ input }: { input: SceneInput }) {
  const started = useRef<number | null>(null);
  const smoothed = useMemo(() => ({ x: 0, y: 0, scroll: 0 }), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, clock }, delta) => {
    if (started.current === null) started.current = clock.elapsedTime;
    const intro = easeOutCubic(Math.min((clock.elapsedTime - started.current) / INTRO_SECONDS, 1));

    // Frame-rate independent damping.
    const k = 1 - Math.exp(-delta * 3);
    smoothed.x += (input.pointerX - smoothed.x) * k;
    smoothed.y += (input.pointerY - smoothed.y) * k;
    smoothed.scroll += (input.scroll - smoothed.scroll) * (1 - Math.exp(-delta * 6));

    const s = smoothed.scroll;
    target.lerpVectors(START, REST, intro);
    target.z -= s * 8;
    target.y -= s * 3;
    target.x += smoothed.x * 0.9;
    target.y += smoothed.y * 0.5;
    camera.position.copy(target);

    lookAt.set(smoothed.x * 0.3, -s * 3.6, 0);
    camera.lookAt(lookAt);
  });

  return null;
}
