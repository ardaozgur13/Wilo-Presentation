import * as THREE from 'three';
import { C } from './palette.js';
import { mat, solid, lineMat, dashedMat } from './materials.js';
import { makeTag } from './labels.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Ölçü çizgisi: iki uçta kısa dik çizgiler + ok başları + ortada etiket.
function dimension(a, b, text, normal = V(0, 0, 1)) {
  const g = new THREE.Group();
  const m = lineMat(0.6);
  const t = normal.clone().multiplyScalar(0.25);
  const pts = [
    a, b,
    a.clone().sub(t), a.clone().add(t),
    b.clone().sub(t), b.clone().add(t),
  ];
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), m));

  const dir = b.clone().sub(a).normalize();
  const coneGeo = new THREE.ConeGeometry(0.07, 0.3, 6);
  const coneMat = new THREE.MeshBasicMaterial({ color: C.ink2 });
  for (const [p, d] of [[a, dir.clone()], [b, dir.clone().negate()]]) {
    const c = new THREE.Mesh(coneGeo, coneMat);
    c.position.copy(p).addScaledVector(d, 0.15);
    c.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().negate());
    g.add(c);
  }
  const label = makeTag(text, 'dim');
  label.position.copy(a).lerp(b, 0.5);
  g.add(label);
  return g;
}

export function buildGround(scene) {
  const group = new THREE.Group();

  // Kağıt zemin (gölge alır)
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: C.paper, roughness: 1 }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  group.add(plane);

  // Izgara: 1 m ince, 5 m kalın
  const fine = new THREE.GridHelper(240, 240, C.line, C.line);
  fine.material.transparent = true;
  fine.material.opacity = 0.55;
  fine.position.y = 0.003;
  const major = new THREE.GridHelper(240, 48, C.ink2, C.ink2);
  major.material.transparent = true;
  major.material.opacity = 0.22;
  major.position.y = 0.005;
  group.add(fine, major);

  // Beton döşeme
  const slab = solid(new THREE.BoxGeometry(22.5, 0.12, 10), mat(C.concrete), { threshold: 10 });
  slab.position.set(-1.25, 0.06, 0);
  slab.castShadow = false;
  group.add(slab);

  // Pompa binası: kesik çizgili hayalet hacim
  const bGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(15.6, 4.8, 8));
  const building = new THREE.LineSegments(bGeo, dashedMat(0.28));
  building.computeLineDistances();
  building.position.set(1.4, 2.4 + 0.12, 0.4);
  group.add(building);

  // Ölçüler
  group.add(dimension(V(-12.5, 0.02, 6.4), V(10, 0.02, 6.4), '22,5 m', V(0, 0, 1)));
  group.add(dimension(V(-13.7, 0.02, -5), V(-13.7, 0.02, 5), '10,0 m', V(1, 0, 0)));
  group.add(dimension(V(-12.2, 0.12, -0.2), V(-12.2, 3.72, -0.2), '3,6 m', V(1, 0, 0)));

  scene.add(group);
  return { group, gridMats: [fine.material, major.material], gridBase: [0.55, 0.22] };
}
