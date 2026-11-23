import * as THREE from 'three';
import gsap from 'gsap';
import { C } from '../../world/palette.js';
import { ANCHORS } from '../../world/station.js';

const MAX_R = 32;

function fadeTexture() {
  const cv = document.createElement('canvas');
  cv.width = 2;
  cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, '#000');
  grd.addColorStop(1, '#fff');
  g.fillStyle = grd;
  g.fillRect(0, 0, 2, 64);
  return new THREE.CanvasTexture(cv);
}

// Sahne 4 — Burble Edge'den çıkan tarama dalgası; geçtiği yerde partiküller hizalanır.
export function createScan({ world }) {
  const { particles, station } = world;
  const group = new THREE.Group();
  group.position.set(ANCHORS.edge.x, 0, ANCHORS.edge.z);
  group.visible = false;
  world.scene.add(group);

  const ringMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;

  const ring2Mat = ringMat.clone();
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.995, 1, 128), ring2Mat);
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.15;

  const wallMat = new THREE.MeshBasicMaterial({
    color: C.teal, transparent: true, opacity: 0.22, alphaMap: fadeTexture(),
    side: THREE.DoubleSide, depthWrite: false,
  });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), wallMat);
  wall.position.y = 2;
  group.add(ring, ring2, wall);

  const s = { r: 0.01 };
  let tl = null;

  function apply() {
    const r = Math.max(0.01, s.r);
    const fade = 1 - Math.pow(r / MAX_R, 1.5);
    particles.state.scanRadius = r;
    ring.scale.setScalar(r);
    ring2.scale.setScalar(Math.max(0.01, r * 0.92));
    wall.scale.set(r, 4, r);
    ringMat.opacity = 0.9 * fade;
    ring2Mat.opacity = 0.35 * fade;
    wallMat.opacity = 0.22 * fade;
  }

  return {
    enter() {
      tl?.kill();
      particles.state.scanOrigin.copy(ANCHORS.edge);
      s.r = 0.01;
      apply();
      particles.state.scanRadius = -1;
      tl = gsap.timeline({ delay: 1.3 })
        // Edge önce "uyanır": kısa yanıp sönme
        .call(() => station.setEdgeActive(0.2, 0.15))
        .call(() => station.setEdgeActive(1, 0.2), null, 0.25)
        .call(() => station.setEdgeActive(0.3, 0.15), null, 0.5)
        .call(() => station.setEdgeActive(1, 0.3), null, 0.75)
        .set(group, { visible: true }, 0.9)
        .to(s, { r: MAX_R, duration: 4.2, ease: 'sine.inOut', onUpdate: apply }, 0.9)
        .call(() => {
          particles.set({ order: 1, chaos: 0 }, 0.8);
          particles.state.scanRadius = -1;
          group.visible = false;
        });
    },
    exit() {
      tl?.kill();
      particles.state.scanRadius = -1;
      group.visible = false;
    },
  };
}
