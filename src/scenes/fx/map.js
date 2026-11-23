import * as THREE from 'three';
import gsap from 'gsap';
import { C } from '../../world/palette.js';
import { mat, edges } from '../../world/materials.js';
import { makeTag } from '../../world/labels.js';
import { makeFader, rng, loop } from './util.js';

const NODE = new THREE.Vector3(12, 0, -46);

// Sahne 8 — istasyon haritada birçok istasyondan biri olur;
// hepsinden çıkan su yeşili hatlar WATER AI'da birleşir.
export function createMap({ world }) {
  const group = new THREE.Group();
  world.scene.add(group);

  // ---- Minyatür istasyonlar ----
  const G = {
    slab: new THREE.BoxGeometry(7, 0.12, 4),
    tank: new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12),
    pump: new THREE.BoxGeometry(0.6, 0.5, 0.9),
  };
  const M = { slab: mat(C.concrete), tank: mat(C.paper2), pump: mat(C.steel) };
  function mini() {
    const g = new THREE.Group();
    const slab = edges(new THREE.Mesh(G.slab, M.slab), 10, 0.45);
    slab.position.y = 0.06;
    const tank = edges(new THREE.Mesh(G.tank, M.tank), 30, 0.45);
    tank.position.set(-2.3, 0.8, 0);
    g.add(slab, tank);
    for (const x of [-0.6, 0.5, 1.6]) {
      const p = edges(new THREE.Mesh(G.pump, M.pump), 30, 0.45);
      p.position.set(x, 0.37, 0.4);
      g.add(p);
    }
    return g;
  }

  const rand = rng(808);
  const sources = [new THREE.Vector3(-1, 1.5, 0)]; // bu istasyon
  let guard = 0;
  while (sources.length < 22 && guard++ < 500) {
    const a = rand() * Math.PI * 2;
    const r = 22 + rand() * 46;
    const p = new THREE.Vector3(NODE.x + Math.cos(a) * r * 1.25, 0, NODE.z + Math.sin(a) * r);
    if (p.length() < 20) continue; // ana istasyona çok yakın
    if (sources.some((q) => q.distanceTo(p) < 11)) continue;
    const m = mini();
    m.position.copy(p);
    m.rotation.y = Math.round(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.3;
    group.add(m);
    sources.push(p.clone().setY(1.2));
  }

  // ---- Hatlar ----
  const lineMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.85 });
  const curves = [];
  const tubes = sources.map((s, i) => {
    const end = NODE.clone().setY(3.2);
    const mid = s.clone().lerp(end, 0.5);
    mid.y += 6 + s.distanceTo(end) * 0.18;
    const curve = new THREE.QuadraticBezierCurve3(s, mid, end);
    curves.push(curve);
    const geo = new THREE.TubeGeometry(curve, 48, i === 0 ? 0.2 : 0.11, 5, false);
    geo.setDrawRange(0, 0);
    const t = new THREE.Mesh(geo, lineMat);
    group.add(t);
    return t;
  });

  // Hatlar üzerinde akan veri darbeleri
  const PER = 2;
  const pulses = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshBasicMaterial({ color: C.teal }),
    curves.length * PER,
  );
  pulses.frustumCulled = false;
  group.add(pulses);
  const phase = Array.from({ length: curves.length * PER }, () => rand());

  // ---- WATER AI düğümü ----
  const nodeG = new THREE.Group();
  nodeG.position.copy(NODE);
  const pillar = edges(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 2.4, 6), mat(0xfbfaf6)), 20, 0.6);
  pillar.position.y = 1.2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 0.25, 6), mat(C.teal, { emissive: C.teal, emissiveIntensity: 0.4 }));
  cap.position.y = 2.5;
  const haloMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.05;
  nodeG.add(pillar, cap, halo);
  group.add(nodeG);

  const nodeTag = makeTag('WATER AI', 'teal big', 'fx');
  nodeTag.position.copy(NODE).setY(5.6);
  const hereTag = makeTag('BU İSTASYON', '', 'fx');
  hereTag.position.set(-1, 4.5, 0);
  group.add(nodeTag, hereTag);

  const fader = makeFader(group);
  haloMat.userData.baseOpacity = 0.6;

  const dummy = new THREE.Object3D();
  const tmp = new THREE.Vector3();
  const ticker = loop(world, (dt, t) => {
    curves.forEach((c, i) => {
      for (let k = 0; k < PER; k++) {
        const idx = i * PER + k;
        const u = (phase[idx] + t * 0.16) % 1;
        c.getPointAt(u, tmp);
        dummy.position.copy(tmp);
        dummy.scale.setScalar(draw.v > 0.95 ? 1 : 0.001);
        dummy.updateMatrix();
        pulses.setMatrixAt(idx, dummy.matrix);
      }
    });
    pulses.instanceMatrix.needsUpdate = true;
    const h = (t * 0.35) % 1;
    halo.scale.setScalar(3 + h * 9);
    haloMat.opacity = 0.6 * (1 - h) * fader.state.v;
  });

  const draw = { v: 0 };
  function applyDraw() {
    tubes.forEach((tb, i) => {
      // ana istasyonun hattı önce, diğerleri sırayla
      const local = THREE.MathUtils.clamp(draw.v * 1.6 - (i / tubes.length) * 0.6, 0, 1);
      tb.geometry.setDrawRange(0, Math.floor(local * tb.geometry.index.count / 3) * 3);
    });
  }

  return {
    enter() {
      world.setFog(220, 600, 2);
      fader.show(1.2, 0.6);
      draw.v = 0;
      applyDraw();
      gsap.to(draw, { v: 1, duration: 3, delay: 1.8, ease: 'power2.inOut', onUpdate: applyDraw, overwrite: 'auto' });
      ticker.start();
    },
    exit() {
      world.setFog();
      gsap.killTweensOf(draw);
      fader.hide(0.6).eventCallback('onComplete', () => ticker.stop());
    },
  };
}
