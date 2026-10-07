'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LIGHT_COLOR, LIGHT_DIRECTION } from './profile';

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Bright through the middle of the beam, soft at its silhouette.
    float facing = pow(abs(dot(vNormal, vView)), 2.2);
    // Fades in from the window and out towards the floor.
    float along = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
    float drift = 0.82 + 0.18 * sin(uTime * 0.45 + uSeed * 6.2831);
    float alpha = uOpacity * facing * along * drift;
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;

const SHAFTS = [
  { offset: [5.5, 4, -10], radius: 2.6, opacity: 0.26 },
  { offset: [2.2, 4.5, -6], radius: 1.7, opacity: 0.2 },
  { offset: [8.5, 3, -15], radius: 3.4, opacity: 0.2 },
  { offset: [-0.8, 5, -3], radius: 1.2, opacity: 0.14 },
] as const;

/** Additive cones angled from an unseen high window: cheap fake volumetric light. */
export function LightShafts({ spread }: { spread: number }) {
  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(...LIGHT_DIRECTION).normalize();
    // CylinderGeometry points along +y; the wide end should face down the beam.
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
  }, []);

  const materials = useMemo(
    () =>
      SHAFTS.map(
        (shaft, i) =>
          new THREE.ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: fragment,
            uniforms: {
              uColor: { value: new THREE.Color(LIGHT_COLOR) },
              uTime: { value: 0 },
              uSeed: { value: i / SHAFTS.length },
              uOpacity: { value: shaft.opacity },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          })
      ),
    []
  );

  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame(({ clock }) => {
    for (const material of materials) material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <group>
      {SHAFTS.map((shaft, i) => (
        <mesh key={i} position={[shaft.offset[0] * spread, shaft.offset[1], shaft.offset[2]]} quaternion={quaternion} material={materials[i]} renderOrder={2}>
          <cylinderGeometry args={[shaft.radius * 0.35, shaft.radius, 34, 32, 1, true]} />
        </mesh>
      ))}
    </group>
  );
}
