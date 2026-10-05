'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mulberry32 } from './profile';

/** Loose sheets of paper that tumble slowly, with a gentle bend along their width. */
export function FloatingPages({ count, spread }: { count: number; spread: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  const pages = useMemo(() => {
    const rand = mulberry32(41);
    return Array.from({ length: count }, () => ({
      position: new THREE.Vector3((rand() - 0.5) * 20 * spread, (rand() - 0.5) * 12, -14 + rand() * 16),
      rotation: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
      speed: new THREE.Vector3((rand() - 0.5) * 0.3, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.25),
      drift: 0.2 + rand() * 0.4,
      phase: rand() * Math.PI * 2,
    }));
  }, [count, spread]);

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.62, 0.82, 8, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin((x / 0.62) * Math.PI) * 0.06);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const scratch = useMemo(() => ({ obj: new THREE.Object3D() }), []);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const { obj } = scratch;
    pages.forEach((p, i) => {
      obj.position.copy(p.position);
      obj.position.y += Math.sin(t * p.drift + p.phase) * 0.6;
      obj.position.x += Math.cos(t * p.drift * 0.7 + p.phase) * 0.4;
      obj.rotation.set(p.rotation.x + t * p.speed.x, p.rotation.y + t * p.speed.y, p.rotation.z + t * p.speed.z);
      obj.updateMatrix();
      m.setMatrixAt(i, obj.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#efe4c8" roughness={0.9} side={THREE.DoubleSide} emissive="#6b5532" emissiveIntensity={0.35} />
    </instancedMesh>
  );
}
