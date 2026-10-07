'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mulberry32 } from './profile';

const LEATHER = ['#8c2a2f', '#2a6650', '#2b3f7a', '#b0823a', '#6a3866', '#2a6b78', '#7a5232', '#d4c094', '#3e4363'];
const COVER = 0.035;

type Book = {
  position: THREE.Vector3;
  base: THREE.Quaternion;
  axis: THREE.Vector3;
  spin: number;
  bob: number;
  bobSpeed: number;
  phase: number;
  t: number;
  h: number;
  d: number;
};

function makeBooks(count: number, spread: number): Book[] {
  const rand = mulberry32(7);
  const books: Book[] = [];
  while (books.length < count) {
    const position = new THREE.Vector3((rand() - 0.5) * 28 * spread, -10 + rand() * 18, -24 + rand() * 30);
    // Keep the camera's flight path clear so nothing clips through the lens.
    if (Math.abs(position.x) < 2.6 * spread && position.z > 1 && position.y > -5) continue;
    const h = 1.4 + rand() * 0.9;
    books.push({
      position,
      base: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * Math.PI, rand() * Math.PI * 2, rand() * Math.PI)),
      axis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
      spin: (0.04 + rand() * 0.1) * (rand() > 0.5 ? 1 : -1),
      bob: 0.12 + rand() * 0.3,
      bobSpeed: 0.18 + rand() * 0.3,
      phase: rand() * Math.PI * 2,
      t: 0.28 + rand() * 0.34,
      h,
      d: h * (0.66 + rand() * 0.1),
    });
  }
  return books;
}

/** Fine vertical lines read as stacked page edges on the fore-edge and top of each book. */
function makePageTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 4;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#efe4c8';
  ctx.fillRect(0, 0, 64, 4);
  for (let x = 0; x < 64; x += 2) {
    ctx.fillStyle = `rgba(120, 96, 60, ${0.08 + Math.random() * 0.14})`;
    ctx.fillRect(x, 0, 1, 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Each book is four parts drawn with three instanced meshes (leather shell,
 * page block, gilt bands), so 70 books cost three draw calls.
 */
export function Books({ count, spread }: { count: number; spread: number }) {
  const books = useMemo(() => makeBooks(count, spread), [count, spread]);
  const shell = useRef<THREE.InstancedMesh>(null);
  const pages = useRef<THREE.InstancedMesh>(null);
  const bands = useRef<THREE.InstancedMesh>(null);
  const pageTexture = useMemo(makePageTexture, []);

  useEffect(() => () => pageTexture.dispose(), [pageTexture]);

  // Per-instance leather colour; three shell parts per book share it.
  useEffect(() => {
    const mesh = shell.current;
    if (!mesh) return;
    const rand = mulberry32(11);
    const color = new THREE.Color();
    books.forEach((_, i) => {
      color.set(LEATHER[Math.floor(rand() * LEATHER.length)]);
      for (let part = 0; part < 3; part++) mesh.setColorAt(i * 3 + part, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // instanceColor did not exist when the shader was first compiled.
    (mesh.material as THREE.Material).needsUpdate = true;
  }, [books]);

  const scratch = useMemo(
    () => ({
      book: new THREE.Matrix4(),
      part: new THREE.Matrix4(),
      out: new THREE.Matrix4(),
      quat: new THREE.Quaternion(),
      spinQuat: new THREE.Quaternion(),
      pos: new THREE.Vector3(),
      partPos: new THREE.Vector3(),
      partScale: new THREE.Vector3(),
      identity: new THREE.Quaternion(),
      one: new THREE.Vector3(1, 1, 1),
    }),
    []
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const s = scratch;
    const { current: shellMesh } = shell;
    const { current: pageMesh } = pages;
    const { current: bandMesh } = bands;
    if (!shellMesh || !pageMesh || !bandMesh) return;

    const setPart = (mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      s.partPos.set(x, y, z);
      s.partScale.set(sx, sy, sz);
      s.part.compose(s.partPos, s.identity, s.partScale);
      s.out.multiplyMatrices(s.book, s.part);
      mesh.setMatrixAt(index, s.out);
    };

    for (let i = 0; i < books.length; i++) {
      const b = books[i];
      s.spinQuat.setFromAxisAngle(b.axis, time * b.spin);
      s.quat.copy(b.base).multiply(s.spinQuat);
      s.pos.copy(b.position);
      s.pos.y += Math.sin(time * b.bobSpeed + b.phase) * b.bob;
      s.book.compose(s.pos, s.quat, s.one);

      // Local axes: x = thickness, y = height, z = width (spine at -z).
      setPart(shellMesh, i * 3, b.t / 2 - COVER / 2, 0, 0, COVER, b.h, b.d);
      setPart(shellMesh, i * 3 + 1, -b.t / 2 + COVER / 2, 0, 0, COVER, b.h, b.d);
      setPart(shellMesh, i * 3 + 2, 0, 0, -b.d / 2 + COVER / 2, b.t, b.h, COVER);
      setPart(pageMesh, i, 0, 0, COVER / 2, b.t - COVER * 2 - 0.01, b.h * 0.95, b.d * 0.94);
      setPart(bandMesh, i * 2, 0, b.h * 0.32, -b.d / 2 - 0.004, b.t * 1.02, 0.045, 0.012);
      setPart(bandMesh, i * 2 + 1, 0, -b.h * 0.32, -b.d / 2 - 0.004, b.t * 1.02, 0.045, 0.012);
    }
    shellMesh.instanceMatrix.needsUpdate = true;
    pageMesh.instanceMatrix.needsUpdate = true;
    bandMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={shell} args={[undefined, undefined, books.length * 3]} frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.62} metalness={0.06} />
      </instancedMesh>
      <instancedMesh ref={pages} args={[undefined, undefined, books.length]} frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial map={pageTexture} roughness={0.85} emissive="#5a4426" emissiveIntensity={0.35} />
      </instancedMesh>
      <instancedMesh ref={bands} args={[undefined, undefined, books.length * 2]} frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial color="#d9b46a" metalness={0.9} roughness={0.28} emissive="#8a6420" emissiveIntensity={0.55} />
      </instancedMesh>
    </group>
  );
}
