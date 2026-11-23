import * as THREE from 'three';
import { C } from '../../world/palette.js';
import { makeTag } from '../../world/labels.js';
import { ANCHORS } from '../../world/station.js';
import { makeFader, loop } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Sahne 9 — Edge'den yukarıya tek yönlü, şifreli çıkış; PLC'ye geri ok yok.
export function createUplink({ world }) {
  const group = new THREE.Group();
  world.scene.add(group);

  const e = ANCHORS.edge;
  const curve = new THREE.CatmullRomCurve3([
    V(e.x, e.y + 0.17, e.z), V(e.x + 0.2, e.y + 1.4, e.z - 0.4),
    V(e.x + 1.4, e.y + 3.6, e.z - 2.6), V(e.x + 5, e.y + 10, e.z - 9),
  ]);
  const pts = curve.getPoints(120);
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: C.teal, dashSize: 0.14, gapSize: 0.1 }));
  line.computeLineDistances();
  group.add(line);

  // Yalnızca dışarı giden oklar
  const N = 7;
  const chevGeo = new THREE.ConeGeometry(0.07, 0.2, 6);
  const chevs = new THREE.InstancedMesh(chevGeo, new THREE.MeshBasicMaterial({ color: C.teal }), N);
  chevs.frustumCulled = false;
  group.add(chevs);

  // PLC → Edge okuma yönü
  const readCurve = new THREE.LineCurve3(V(7.05, 1.0, 3.62), V(e.x - 0.05, e.y - 0.12, e.z + 0.24));
  const readChev = new THREE.InstancedMesh(chevGeo, new THREE.MeshBasicMaterial({ color: C.teal }), 3);
  readChev.frustumCulled = false;
  group.add(readChev);

  const t1 = makeTag('MQTT/TLS · tek yönlü ↑', 'teal', 'fx');
  t1.position.copy(curve.getPointAt(0.16)).add(V(0.9, 0, 0));
  const t2 = makeTag('PLC → Edge · okuma', 'var', 'fx');
  t2.position.set(7.4, 0.62, 3.75);
  const t3 = makeTag('Edge → PLC · komut yok ✕', 'alert', 'fx');
  t3.position.set(7.4, 0.2, 3.75);
  group.add(t1, t2, t3);

  const fader = makeFader(group);
  const dummy = new THREE.Object3D();
  const up = V(0, 1, 0);
  const tan = new THREE.Vector3();
  const ticker = loop(world, (dt, t) => {
    for (let i = 0; i < N; i++) {
      const u = ((i / N) + t * 0.12) % 1;
      curve.getPointAt(u, dummy.position);
      curve.getTangentAt(u, tan);
      dummy.quaternion.setFromUnitVectors(up, tan);
      dummy.scale.setScalar(1 + u * 1.5);
      dummy.updateMatrix();
      chevs.setMatrixAt(i, dummy.matrix);
    }
    chevs.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 3; i++) {
      const u = ((i / 3) + t * 0.5) % 1;
      readCurve.getPointAt(u, dummy.position);
      readCurve.getTangentAt(u, tan);
      dummy.quaternion.setFromUnitVectors(up, tan);
      dummy.scale.setScalar(0.45);
      dummy.updateMatrix();
      readChev.setMatrixAt(i, dummy.matrix);
    }
    readChev.instanceMatrix.needsUpdate = true;
  });

  return {
    enter() { fader.show(0.9, 1.1); ticker.start(); },
    exit() { fader.hide(0.4).eventCallback('onComplete', () => ticker.stop()); },
  };
}
