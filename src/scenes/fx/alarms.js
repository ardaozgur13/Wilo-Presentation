import * as THREE from 'three';
import gsap from 'gsap';
import { C } from '../../world/palette.js';
import { ANCHORS, PUMP_X } from '../../world/station.js';
import { rng, loop } from './util.js';

const COUNT = 40;

function alarmTexture() {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(s / 2, 12);
  g.lineTo(s - 10, s - 16);
  g.lineTo(10, s - 16);
  g.closePath();
  g.fillStyle = '#E07A2E';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#F4F1EA';
  g.stroke();
  g.fillStyle = '#F4F1EA';
  g.font = '700 62px "Space Grotesk", Inter, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('!', s / 2, s / 2 + 12);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Sahne 2 — gece 03.00: istasyonun üstünde alarm ikonları tek tek yanar, sayaç 40'a çıkar.
export function createAlarms({ world, caption }) {
  const group = new THREE.Group();
  group.visible = false;
  world.scene.add(group);

  // Alarmların bağlandığı ekipman noktaları
  const bases = [
    ...PUMP_X.map((x) => new THREE.Vector3(x, 1.4, 0.4)),
    ...PUMP_X.map((x) => new THREE.Vector3(x, 2.4, -0.7)),
    ANCHORS.tank.clone().setY(3.8),
    ANCHORS.plc.clone().setY(2.4),
    ANCHORS.vfd.clone().setY(1.8),
    new THREE.Vector3(11, 1.2, -0.7),
    new THREE.Vector3(-3, 0.9, -2.4),
    new THREE.Vector3(5, 2.7, -0.7),
  ];

  const tex = alarmTexture();
  const rand = rng(303);
  const items = [];
  const linePos = new Float32Array(COUNT * 6);
  for (let i = 0; i < COUNT; i++) {
    const b = bases[i % bases.length];
    const p = new THREE.Vector3(
      b.x + (rand() - 0.5) * 2.4,
      b.y + 1.2 + rand() * 2.6,
      b.z + (rand() - 0.5) * 1.8,
    );
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(p);
    sp.scale.setScalar(0.001);
    sp.renderOrder = 5;
    group.add(sp);
    items.push({ sp, mat, base: p.clone(), size: 0.55 + rand() * 0.3, phase: rand() * 6.28, on: false });
    linePos.set([p.x, p.y - 0.3, p.z, b.x, b.y, b.z], i * 6);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setDrawRange(0, 0);
  const lines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({ color: C.orange, transparent: true, opacity: 0.45 }),
  );
  group.add(lines);

  let tl = null;
  let shown = 0;

  const ticker = loop(world, (dt, t) => {
    for (let i = 0; i < shown; i++) {
      const it = items[i];
      it.sp.position.y = it.base.y + Math.sin(t * 1.4 + it.phase) * 0.06;
      it.mat.opacity = 0.7 + 0.3 * Math.sin(t * 5 + it.phase);
    }
  });

  function reveal(i, counter) {
    const it = items[i];
    shown = i + 1;
    gsap.fromTo(it.sp.scale, { x: 0.001, y: 0.001 }, { x: it.size, y: it.size, duration: 0.45, ease: 'back.out(3)' });
    it.mat.opacity = 1;
    lineGeo.setDrawRange(0, shown * 2);
    if (counter) counter.textContent = String(shown);
  }

  return {
    enter() {
      tl?.kill();
      gsap.killTweensOf(group.scale);
      group.visible = true;
      group.scale.setScalar(1);
      shown = 0;
      lineGeo.setDrawRange(0, 0);
      items.forEach((it) => it.sp.scale.setScalar(0.001));
      const counter = caption.el?.querySelector('.alarm-count');
      if (counter) counter.textContent = '0';
      tl = gsap.timeline({ delay: 1.2 });
      for (let i = 0; i < COUNT; i++) {
        // önce seyrek, sonra sağanak
        tl.call(reveal, [i, counter], 3.4 * Math.pow(i / COUNT, 0.6));
      }
      ticker.start();
    },
    exit() {
      tl?.kill();
      gsap.to(items.map((it) => it.sp.scale), {
        x: 0.001, y: 0.001, duration: 0.3, stagger: 0.004,
        onComplete: () => { group.visible = false; ticker.stop(); shown = 0; },
      });
      lineGeo.setDrawRange(0, 0);
    },
  };
}
