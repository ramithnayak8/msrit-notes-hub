'use client';

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LIGHT_DIRECTION, mulberry32 } from './profile';

const HEIGHT = 22;

const vertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    // Slow rise with a wrap, plus lazy sideways drift.
    p.y = mod(p.y + uTime * (0.04 + aSeed.x * 0.1) + ${HEIGHT / 2}.0, ${HEIGHT}.0) - ${HEIGHT / 2}.0;
    p.x += sin(uTime * (0.15 + aSeed.y * 0.25) + aSeed.z * 6.2831) * 0.45;
    p.z += cos(uTime * (0.12 + aSeed.x * 0.2) + aSeed.w * 6.2831) * 0.45;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    // Motes near the lens grow and soften: a cheap stand-in for depth of field.
    gl_PointSize = min(uSize * (0.35 + aSeed.w) * uPixelRatio * (14.0 / max(dist, 0.1)), 72.0);
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed.z * 2.0) + aSeed.x * 40.0);
    vAlpha = (0.3 + 0.7 * aSeed.y) * twinkle * smoothstep(0.6, 3.5, dist) * (1.0 - smoothstep(20.0, 34.0, dist));
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(uColor * a * vAlpha, a * vAlpha);
  }
`;

/** Dust motes, concentrated inside the light shafts where real dust would be visible. */
export function Dust({ count, spread }: { count: number; spread: number }) {
  const pixelRatio = useThree((state) => state.viewport.dpr);

  const geometry = useMemo(() => {
    const rand = mulberry32(23);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);
    const dir = new THREE.Vector3(...LIGHT_DIRECTION).normalize();
    for (let i = 0; i < count; i++) {
      let x: number, y: number, z: number;
      if (i % 3 !== 0) {
        // Along a beam from the window, scattered around its axis.
        const along = rand() * 20;
        x = (6 + dir.x * along) * spread + (rand() - 0.5) * 5 * spread;
        y = 6 + dir.y * along + (rand() - 0.5) * 3;
        z = -9 + dir.z * along + (rand() - 0.5) * 8;
      } else {
        x = (rand() - 0.5) * 26 * spread;
        y = (rand() - 0.5) * HEIGHT;
        z = -20 + rand() * 26;
      }
      positions.set([x, y, z], i * 3);
      seeds.set([rand(), rand(), rand(), rand()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    return g;
  }, [count, spread]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uSize: { value: 2.6 },
          uColor: { value: new THREE.Color('#ffe2b0') },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPixelRatio.value = pixelRatio;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}
