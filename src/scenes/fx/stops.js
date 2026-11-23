import * as THREE from 'three';
import gsap from 'gsap';
import { C } from '../../world/palette.js';
import { mat, edges, lineMat } from '../../world/materials.js';
import { makeTag } from '../../world/labels.js';
import { ANCHORS } from '../../world/station.js';
import { makeFader, loop } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const STOP_X = [-4, 0, 4, 8];
const Z = 8.6;
const NAMES = ['Anlamlandırma', 'Güven', 'Teşhis', 'Uzman onayı'];

// Sahne 5 — veri akışı 4 durağa bölünür; her adımda bir durak ışıklanır,
// sonda 4. duraktan 1.'ye dönen kesik çizgili halka belirir.
export function createStops({ world }) {
  const group = new THREE.Group();
  world.scene.add(group);

  // ---- Veri rayı: Edge → zemin → durakların önü ----
  const e = ANCHORS.edge;
  const rail = [
    V(e.x, e.y - 0.17, e.z + 0.22), V(e.x, 0.06, e.z + 0.22), V(e.x, 0.06, 5.9),
    V(-7, 0.06, 5.9), V(-7, 0.06, Z), V(11.5, 0.06, Z),
  ];
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rail), lineMat(0.55)));
  const cum = [0];
  for (let i = 1; i < rail.length; i++) cum.push(cum[i - 1] + rail[i].distanceTo(rail[i - 1]));
  const railLen = cum[cum.length - 1];
  const at = (d, out) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    return out.lerpVectors(rail[i - 1], rail[i], (d - cum[i - 1]) / (cum[i] - cum[i - 1]));
  };

  // ---- Duraklar ----
  const iconGeos = [
    new THREE.OctahedronGeometry(0.36, 0),
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.TetrahedronGeometry(0.42, 0),
    new THREE.CylinderGeometry(0.3, 0.3, 0.42, 6),
  ];
  const ink = new THREE.Color(C.ink2);
  const teal = new THREE.Color(C.teal);
  const line = new THREE.Color(C.line);
  const stops = STOP_X.map((x, i) => {
    const g = new THREE.Group();
    g.position.set(x, 0, Z);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.28, 6), mat(C.paper2));
    ped.position.y = 0.14;
    ped.receiveShadow = true;
    ped.castShadow = true;
    edges(ped, 20, 0.55);
    const ringMat = new THREE.MeshBasicMaterial({ color: C.line });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.035, 4, 6), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = Math.PI / 6;
    ring.position.y = 0.29;
    const iconMat = mat(C.ink2, { emissive: C.teal, emissiveIntensity: 0 });
    const icon = new THREE.Mesh(iconGeos[i], iconMat);
    icon.position.y = 1.25;
    icon.castShadow = true;
    edges(icon, 20, 0.5);
    if (i === 1) { // çapraz kontrol: iki kutu
      const twin = new THREE.Mesh(iconGeos[1], iconMat);
      twin.position.set(0.18, 0.18, 0.18);
      twin.scale.setScalar(0.7);
      icon.add(twin);
    }
    const tag = makeTag(`<b>${i + 1}</b>${NAMES[i]}`, 'stop', 'fx', true);
    tag.position.y = 2.15;
    g.add(ped, ring, icon, tag);
    group.add(g);
    return { g, ring, ringMat, icon, iconMat, tag, s: { v: 0 }, x };
  });

  function applyStop(st) {
    const v = st.s.v;
    st.ringMat.color.copy(line).lerp(teal, v);
    st.iconMat.color.copy(ink).lerp(teal, v);
    st.iconMat.emissiveIntensity = v * 0.35;
    st.tag.userData.tag.classList.toggle('on', v > 0.5);
  }
  stops.forEach(applyStop);

  // ---- Raydaki veri partikülleri ----
  const N = 90;
  const pGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
  const pMesh = new THREE.InstancedMesh(pGeo, new THREE.MeshBasicMaterial(), N);
  pMesh.frustumCulled = false;
  const pu = new Float32Array(N).map((_, i) => (i / N) * railLen);
  const grey = new THREE.Color(0x8a857b);
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) pMesh.setColorAt(i, grey);
  group.add(pMesh);

  // ---- Geri besleme halkası ----
  const loopCurve = new THREE.CatmullRomCurve3([
    V(8.6, 0.08, Z + 1.1), V(10.6, 0.08, Z + 2.8), V(6, 0.08, Z + 4.6), V(2, 0.08, Z + 4.9),
    V(-2, 0.08, Z + 4.6), V(-6.4, 0.08, Z + 2.8), V(-4.6, 0.08, Z + 1.1),
  ]);
  const loopPts = loopCurve.getPoints(160);
  const loopGeo = new THREE.BufferGeometry().setFromPoints(loopPts);
  const loopMat = new THREE.LineDashedMaterial({ color: C.teal, dashSize: 0.35, gapSize: 0.22, transparent: true });
  const loopLine = new THREE.Line(loopGeo, loopMat);
  loopLine.computeLineDistances();
  loopGeo.setDrawRange(0, 0);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 8), new THREE.MeshBasicMaterial({ color: C.teal }));
  const tEnd = loopCurve.getTangent(1);
  arrow.position.copy(loopPts[loopPts.length - 1]);
  arrow.quaternion.setFromUnitVectors(V(0, 1, 0), tEnd);
  arrow.scale.setScalar(0.001);
  const loopTag = makeTag('↻ her onay → daha iyi öneri', 'teal', 'fx');
  loopTag.position.set(2, 0.1, Z + 5.1);
  loopTag.userData.tag.style.opacity = 0; // dış eleman fader'a, iç etiket halkaya ait
  group.add(loopLine, arrow, loopTag);
  const loopState = { v: 0 };

  const fader = makeFader(group);
  // halka ve etiket kendi opaklığını yönetir
  loopMat.userData.baseOpacity = 1;

  let lit = 0;
  const tmp = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const ticker = loop(world, (dt, t) => {
    for (let i = 0; i < N; i++) {
      pu[i] = (pu[i] + dt * 2.2) % railLen;
      at(pu[i], tmp);
      tmp.y += 0.06;
      // geçilen yanık durak sayısı kadar su yeşili
      let passed = 0;
      if (Math.abs(tmp.z - Z) < 0.01) for (let k = 0; k < lit; k++) if (tmp.x > STOP_X[k]) passed++;
      col.copy(grey).lerp(teal, passed ? 0.35 + (passed / 4) * 0.65 : 0);
      pMesh.setColorAt(i, col);
      pMesh.setMatrixAt(i, m4.makeTranslation(tmp.x, tmp.y, tmp.z));
    }
    pMesh.instanceMatrix.needsUpdate = true;
    pMesh.instanceColor.needsUpdate = true;
    stops.forEach((st, k) => {
      st.icon.rotation.y = t * 0.6 + k;
      st.icon.position.y = 1.25 + (k < lit ? Math.sin(t * 2 + k) * 0.08 : 0);
    });
  });

  function setLoop(on) {
    gsap.to(loopState, {
      v: on ? 1 : 0,
      duration: on ? 1.6 : 0.4,
      ease: 'power2.inOut',
      overwrite: 'auto',
      onUpdate() {
        loopGeo.setDrawRange(0, Math.round(loopState.v * loopPts.length));
        arrow.scale.setScalar(loopState.v > 0.97 ? 1 : 0.001);
        loopTag.userData.tag.style.opacity = Math.max(0, (loopState.v - 0.6) / 0.4);
      },
    });
  }

  return {
    enter() {
      fader.show(0.9, 0.6);
      ticker.start();
    },
    step(i) {
      lit = Math.min(i, 4);
      stops.forEach((st, k) => {
        gsap.to(st.s, { v: k < lit ? 1 : 0, duration: 0.6, onUpdate: () => applyStop(st), overwrite: 'auto' });
        if (k === lit - 1) {
          gsap.fromTo(st.icon.scale, { x: 1.5, y: 1.5, z: 1.5 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(3)' });
        }
      });
      setLoop(i >= 5);
    },
    exit() {
      fader.hide(0.4).eventCallback('onComplete', () => ticker.stop());
      setLoop(false);
    },
  };
}
