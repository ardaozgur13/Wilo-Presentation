import * as THREE from 'three';
import gsap from 'gsap';
import { C } from '../world/palette.js';
import { mat, edges } from '../world/materials.js';
import { makeTag } from '../world/labels.js';
import { ANCHORS } from '../world/station.js';
import { makeFader } from '../scenes/fx/util.js';
import { fmt } from './sim.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LINE = 1; // Hat 2 → pompa indeksi 1, partikül yolu 2

// Prototip senaryolarının 3D karşılıkları:
// kaçak → borudan su fışkırır · donma → sensör değeri sabit + turuncu · kısık vana → vana kızarır, pompa titrer
// Onay → Edge'den "Veri seti" rafına uçan veri küpü.
export function createStage(world) {
  const { station, particles } = world;
  const pump = station.pumps[LINE];
  const valve = station.valves[LINE];

  // ---------- Kaçak: su püskürtmesi ----------
  const LEAK_AT = V(0.14, 1.66, -0.7);
  const N = 170;
  const drop = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.045, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0x5fa9c4 }),
    N,
  );
  drop.frustumCulled = false;
  drop.count = 0;
  world.scene.add(drop);
  const dp = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: Math.random() }));
  const puddleMat = new THREE.MeshBasicMaterial({ color: 0x5fa9c4, transparent: true, opacity: 0.35, depthWrite: false });
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 28), puddleMat);
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(1.7, 0.13, -0.4);
  puddle.scale.setScalar(0.001);
  world.scene.add(puddle);

  // ---------- Veri seti rafı ----------
  const store = new THREE.Group();
  store.position.set(5.7, 0.12, 4.85);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.3), mat(C.paper2));
  plate.position.y = 0.04;
  plate.receiveShadow = true;
  edges(plate, 20, 0.6);
  store.add(plate);
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.4, 0.04), mat(C.ink2));
    post.position.set(x, 0.7, z);
    store.add(post);
  }
  const storeTag = makeTag('VERİ SETİ · 0', 'teal', 'fx');
  storeTag.position.set(0, 1.85, 0);
  store.add(storeTag);
  const pulseMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), pulseMat);
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.1;
  store.add(pulse);
  world.scene.add(store);
  const storeFader = makeFader(store);
  pulseMat.userData.baseOpacity = 0; // halka yalnızca küp indiğinde kendi animasyonuyla görünür

  const cubeGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
  const cubeMat = mat(C.teal, { emissive: C.teal, emissiveIntensity: 0.15 });
  const fixMat = mat(0x3f9e8f, { emissive: C.orange, emissiveIntensity: 0.12 });
  const cubes = [];
  const slot = (n) => {
    const layer = Math.floor(n / 9);
    const r = n % 9;
    return V(((r % 3) - 1) * 0.32, 0.08 + 0.14 + layer * 0.29, (Math.floor(r / 3) - 1) * 0.32);
  };

  function flyCube(corrected = false) {
    const n = cubes.length;
    const cube = new THREE.Mesh(cubeGeo, corrected ? fixMat : cubeMat);
    edges(cube, 20, 0.6);
    cube.castShadow = true;
    store.add(cube);
    cubes.push(cube);
    const from = store.worldToLocal(ANCHORS.edge.clone().add(V(0, 0.3, 0.2)));
    const to = slot(n);
    const mid = from.clone().lerp(to, 0.5);
    mid.y = Math.max(from.y, to.y) + 1.8;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const o = { u: 0 };
    cube.position.copy(from);
    cube.scale.setScalar(0.4);
    gsap.to(cube.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(3)' });
    gsap.to(o, {
      u: 1,
      duration: 1.25,
      ease: 'power2.inOut',
      onUpdate: () => {
        curve.getPoint(o.u, cube.position);
        cube.rotation.set(o.u * Math.PI * 2, o.u * Math.PI, 0);
      },
      onComplete: () => {
        cube.rotation.set(0, 0, 0);
        storeTag.userData.tag.textContent = `VERİ SETİ · ${cubes.length}`;
        gsap.fromTo(pulse.scale, { x: 0.6, y: 0.6, z: 0.6 }, { x: 1.8, y: 1.8, z: 1.8, duration: 0.8, ease: 'power2.out' });
        gsap.fromTo(pulseMat, { opacity: 0.9 }, { opacity: 0, duration: 0.8 });
        gsap.fromTo(storeTag.userData.tag, { scale: 1.25 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
      },
    });
  }

  // ---------- Senaryo durumları (0..1, yumuşak geçiş) ----------
  const fx = { leak: 0, valve: 0 };
  const valveBase = new THREE.Color(C.steel);
  const valveHot = new THREE.Color(0xc8553d);
  function setScenario(name) {
    gsap.to(fx, { leak: name === 'leak' ? 1 : 0, valve: name === 'valve' ? 1 : 0, duration: 1.6, ease: 'power2.inOut', overwrite: 'auto' });
    const flow = name === 'leak' ? 1.35 : name === 'valve' ? 0.5 : 1;
    gsap.to(particles.paths[LINE + 1], { flow, duration: 1.6, overwrite: 'auto' });
  }

  // ---------- Canlı etiket değerleri ----------
  const tags = station.tags;
  const live = ['PT-101', 'PT-102', 'PT-103', 'FT-201', 'P-02'];
  function setLive(s, frozenAlert) {
    if (!s) return;
    tags['PT-102'].userData.tag.textContent = `PT-102 · ${fmt(s.p)} bar`;
    tags['PT-101'].userData.tag.textContent = `PT-101 · ${fmt(4.31 + Math.sin(s.time) * 0.01)} bar`;
    tags['PT-103'].userData.tag.textContent = `PT-103 · ${fmt(4.22 + Math.cos(s.time) * 0.01)} bar`;
    tags['FT-201'].userData.tag.textContent = `FT-201 · ${fmt(s.q, 1)} m³/h`;
    tags['P-02'].userData.tag.textContent = `P-02 · ${fmt(s.w)} kW`;
    tags['PT-102'].userData.tag.classList.toggle('alert', !!frozenAlert);
  }
  function restoreTags() {
    for (const k of live) {
      tags[k].userData.tag.textContent = tags[k].userData.base;
      tags[k].userData.tag.classList.remove('alert');
    }
  }

  // ---------- Kare güncellemesi ----------
  const dummy = new THREE.Object3D();
  const gravity = -9.0;
  function update(dt, t) {
    // püskürtme
    const L = fx.leak;
    drop.count = Math.round(N * L);
    for (let k = 0; k < drop.count; k++) {
      const d = dp[k];
      d.life += dt * 1.6;
      if (d.life >= 1 || d.p.lengthSq() === 0) {
        d.life = Math.random() * 0.2;
        d.p.copy(LEAK_AT);
        d.v.set(2.2 + Math.random() * 1.4, 1.2 + Math.random() * 1.4, (Math.random() - 0.3) * 1.2);
      }
      d.v.y += gravity * dt;
      d.p.addScaledVector(d.v, dt);
      if (d.p.y < 0.14) { d.p.y = 0.14; d.v.multiplyScalar(0.2); }
      dummy.position.copy(d.p);
      dummy.scale.setScalar(0.6 + Math.random() * 0.6);
      dummy.updateMatrix();
      drop.setMatrixAt(k, dummy.matrix);
    }
    drop.instanceMatrix.needsUpdate = true;
    puddle.scale.setScalar(0.001 + L * (1.1 + Math.sin(t * 0.8) * 0.05));
    puddleMat.opacity = 0.35 * L;

    // kısık vana: kızarma + pompa titreşimi
    const Vv = fx.valve;
    valve.material.color.copy(valveBase).lerp(valveHot, Vv);
    valve.material.emissive.copy(valveHot);
    valve.material.emissiveIntensity = Vv * (0.35 + Math.sin(t * 6) * 0.15);
    pump.shake.position.set(
      Math.sin(t * 53) * 0.018 * Vv,
      Math.sin(t * 61) * 0.012 * Vv,
      Math.cos(t * 47) * 0.014 * Vv,
    );
  }

  function show() { storeFader.show(0.8, 0.8); }
  function hide() {
    storeFader.hide(0.4);
    setScenario('normal');
    restoreTags();
  }
  function reset() {
    setScenario('normal');
    for (const c of cubes) store.remove(c);
    cubes.length = 0;
    storeTag.userData.tag.textContent = 'VERİ SETİ · 0';
  }

  return { setScenario, setLive, restoreTags, flyCube, update, show, hide, reset, fx };
}
