import * as THREE from 'three';
import gsap from 'gsap';
import { C } from './palette.js';

// Boruların içinde akan "veri" partikülleri.
// state.chaos  : 0 sakin → 1 titrek, karışık renk (adsız/bozuk veri)
// state.order  : 0..1 tüm partikülleri hizalı + su yeşili yapar
// scan         : origin + radius; yarıçap içindeki partiküller hizalanır (sahne 4)
export function createParticles(scene, rawPaths, count, maxCount = 1200) {
  const paths = rawPaths.map((pts) => {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { pts, cum, len: cum[cum.length - 1], flow: 1 };
  });
  const totalLen = paths.reduce((s, p) => s + p.len, 0);

  const geo = new THREE.OctahedronGeometry(0.075, 0);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, material, maxCount);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  const pathIdx = new Uint8Array(maxCount);
  const u = new Float32Array(maxCount);
  const speed = new Float32Array(maxCount);
  const seed = new Float32Array(maxCount);
  const ord = new Float32Array(maxCount);
  const rawCol = [];

  const noisy = [C.orange, C.ink, C.steel, 0x8fb8b0, C.ink2, 0xc98a55].map((c) => new THREE.Color(c));
  const calm = new THREE.Color(0x77736a);
  const teal = new THREE.Color(C.teal);

  // Partikülleri yol uzunluğuyla orantılı dağıt
  for (let i = 0; i < maxCount; i++) {
    let r = Math.random() * totalLen;
    let k = 0;
    while (k < paths.length - 1 && r > paths[k].len) { r -= paths[k].len; k++; }
    pathIdx[i] = k;
    u[i] = Math.random() * paths[k].len;
    speed[i] = 1.5 + Math.random() * 0.6;
    seed[i] = Math.random() * 100;
    rawCol.push(noisy[i % noisy.length]);
    mesh.setColorAt(i, calm);
  }
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = Math.min(count, maxCount);
  scene.add(mesh);

  const state = {
    chaos: 0.15,
    order: 0,
    speed: 1,
    scanRadius: -1,
    scanOrigin: new THREE.Vector3(),
  };

  const dummy = new THREE.Object3D();
  const p = new THREE.Vector3();
  const col = new THREE.Color();

  function pointAt(path, d, out) {
    const { pts, cum } = path;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const a = cum[i - 1];
    const t = (d - a) / (cum[i] - a || 1);
    return out.lerpVectors(pts[i - 1], pts[i], t);
  }

  function update(dt, t) {
    const n = mesh.count;
    const ease = Math.min(1, dt * 2.5);
    const scanR2 = state.scanRadius > 0 ? state.scanRadius * state.scanRadius : -1;
    for (let i = 0; i < n; i++) {
      const path = paths[pathIdx[i]];
      const s = seed[i];
      const cLocal = state.chaos * (1 - ord[i]);
      const stutter = 1 + cLocal * Math.sin(t * 3.1 + s * 7) * 0.85;
      u[i] += speed[i] * state.speed * path.flow * stutter * dt;
      if (u[i] > path.len) u[i] -= path.len;
      else if (u[i] < 0) u[i] += path.len;

      pointAt(path, u[i], p);

      // hizalanma hedefi
      let target = state.order;
      if (scanR2 > 0 && p.distanceToSquared(state.scanOrigin) < scanR2) target = 1;
      ord[i] += (target - ord[i]) * ease;

      const c = state.chaos * (1 - ord[i]);
      if (c > 0.001) {
        p.x += Math.sin(t * 9.0 + s * 13.0) * 0.11 * c;
        p.y += Math.sin(t * 11.3 + s * 5.0) * 0.11 * c;
        p.z += Math.cos(t * 8.1 + s * 3.0) * 0.11 * c;
      }
      dummy.position.copy(p);
      dummy.rotation.set(t * 0.8 + s, t * 0.6 + s * 2, 0);
      dummy.scale.setScalar(1 + c * 0.6 * Math.sin(t * 6 + s));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      col.copy(calm).lerp(rawCol[i], Math.min(1, state.chaos * 1.4)).lerp(teal, ord[i]);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  // Sayısal alanları yumuşakça değiştir
  function set(values, duration = 1) {
    if (duration <= 0) Object.assign(state, values);
    else gsap.to(state, { ...values, duration, ease: 'power2.inOut', overwrite: 'auto' });
  }

  function setCount(n) {
    mesh.count = Math.max(80, Math.min(maxCount, Math.round(n)));
  }

  return { mesh, state, paths, update, set, setCount, pointAt };
}
