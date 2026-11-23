import * as THREE from 'three';
import gsap from 'gsap';
import { makeTag } from '../../world/labels.js';
import { makeFader } from './util.js';

// Sahne 6 — havada büyük formül + değişkenlerin ekipman üzerindeki karşılıkları.
export function createFormula({ world }) {
  const group = new THREE.Group();
  world.scene.add(group);

  const f = makeTag(
    `<span class="f-main">ρ·g·Q·H = η·P</span>
     <span class="f-legend">hidrolik güç = verim × elektrik gücü</span>`,
    'formula', 'fx', true,
  );
  f.position.set(0, 4.7, 0.2);
  group.add(f);

  const chips = [
    ['H · basma yüksekliği', [0.44, 3.05, -0.7]],
    ['Q · debi', [5.6, 3.1, -0.7]],
    ['η · verim', [0, 1.75, 1.35]],
    ['P · motor gücü', [4.4, 2.55, 3.55]],
  ].map(([text, p]) => {
    const c = makeTag(text, 'var', 'fx');
    c.position.set(...p);
    group.add(c);
    return c;
  });

  const fader = makeFader(group);
  return {
    enter() {
      fader.show(0.01, 0);
      const els = [f, ...chips].map((o) => o.userData.tag);
      gsap.fromTo(els, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, delay: 1.3, stagger: 0.18, ease: 'power3.out' });
    },
    exit() {
      fader.hide(0.35);
    },
  };
}
