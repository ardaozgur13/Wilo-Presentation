import * as THREE from 'three';
import { C } from './palette.js';

// Mat, düşük poligonlu "maket" malzemesi.
export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
    ...opts,
  });
}

// Çizgi malzemeleri tek yerde tutulur ki gece modunda topluca renk değiştirebilelim.
const lineRegistry = [];
export function lineMat(opacity = 0.55, color = C.ink) {
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  m.userData.dayColor = new THREE.Color(color);
  lineRegistry.push(m);
  return m;
}
export function dashedMat(opacity = 0.3, dash = 0.3, gap = 0.22) {
  const m = new THREE.LineDashedMaterial({
    color: C.ink,
    transparent: true,
    opacity,
    dashSize: dash,
    gapSize: gap,
  });
  m.userData.dayColor = new THREE.Color(C.ink);
  lineRegistry.push(m);
  return m;
}
const nightColor = new THREE.Color(C.nightLine);
export function setLineNight(v) {
  for (const m of lineRegistry) m.color.copy(m.userData.dayColor).lerp(nightColor, v);
}

// Teknik çizim hissi veren ince kenar çizgileri.
const edgeMatCache = new Map();
export function edges(mesh, threshold = 28, opacity = 0.5) {
  let m = edgeMatCache.get(opacity);
  if (!m) { m = lineMat(opacity); m.userData.shared = true; edgeMatCache.set(opacity, m); }
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, threshold), m);
  l.raycast = () => {};
  mesh.add(l);
  return mesh;
}

export function solid(geometry, material, { edge = true, threshold = 28, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = shadow;
  m.receiveShadow = true;
  if (edge) edges(m, threshold);
  return m;
}

const UP = new THREE.Vector3(0, 1, 0);
// İki nokta arasında silindir (boru parçası, kablo vb.)
export function cylBetween(a, b, r, material, seg = 12) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg, 1, false), material);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}
