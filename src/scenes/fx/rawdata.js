import * as THREE from 'three';
import gsap from 'gsap';
import { makeTag } from '../../world/labels.js';
import { ANCHORS } from '../../world/station.js';

// Sahne 3 — PLC dolabından havaya etiketsiz, birimsiz sayılar yükselir.
const KEYS = ['40012 = 4250', 'DB104.DBD24 = 2.1', 'AI_07 = 0'];
const FILLER = [
  '40031 = 17', '%IW64 = 13824', 'DB12.DBW8 = 1', '40007 = 65535', 'AI_03 = 8.7',
  'DB104.DBX2.1 = 1', '30001 = 412', '%MW120 = -1', '40044 = 0', 'AI_11 = 2047',
  'DB7.DBD0 = 0.0', '40019 = 3', '%ID32 = 1.2E+3',
];

export function createRawData({ world }) {
  const group = new THREE.Group();
  group.visible = false;
  world.scene.add(group);

  const origin = ANCHORS.plc.clone().setY(2.45);
  const objs = [];
  KEYS.forEach((k) => objs.push({ obj: makeTag(k, 'raw key', 'fx'), key: true }));
  for (let i = 0; i < 9; i++) objs.push({ obj: makeTag(FILLER[i], 'raw', 'fx'), key: false });
  objs.forEach(({ obj }) => { obj.element.style.opacity = 0; group.add(obj); });

  let active = false;
  let calls = [];

  function run(o) {
    if (!active) return;
    const { obj, key } = o;
    const el = obj.element;
    if (!key) obj.userData.tag.textContent = FILLER[(Math.random() * FILLER.length) | 0];
    const spread = key ? 1.1 : 1.8;
    obj.position.set(
      origin.x + (Math.random() - 0.5) * spread,
      origin.y + Math.random() * 0.3,
      origin.z + 0.2 + (Math.random() - 0.5) * 0.8,
    );
    const dur = key ? 5.2 : 3.6 + Math.random() * 1.4;
    gsap.to(obj.position, {
      y: obj.position.y + (key ? 1.5 : 1.9),
      x: obj.position.x + (Math.random() - 0.5) * 0.8,
      duration: dur,
      ease: 'none',
      onComplete: () => run(o),
    });
    gsap.fromTo(el, { opacity: 0 }, {
      keyframes: [
        { opacity: 1, duration: 0.5 },
        { opacity: 1, duration: dur - 1.2 },
        { opacity: 0, duration: 0.7 },
      ],
    });
  }

  return {
    enter() {
      active = true;
      group.visible = true;
      calls.forEach((c) => c.kill());
      calls = objs.map((o, i) =>
        gsap.delayedCall(0.9 + (o.key ? i * 1.6 : 0.4 + (i - 3) * 0.45), () => run(o)),
      );
    },
    exit() {
      active = false;
      calls.forEach((c) => c.kill());
      objs.forEach(({ obj }) => {
        gsap.killTweensOf(obj.position);
        gsap.killTweensOf(obj.element);
        gsap.to(obj.element, { opacity: 0, duration: 0.3 });
      });
      gsap.delayedCall(0.35, () => { if (!active) group.visible = false; });
    },
  };
}
