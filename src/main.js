import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { createWorld } from './world/index.js';
import { createRig } from './engine/camera.js';
import { createCaption } from './engine/caption.js';
import { bindInput, toggleFullscreen } from './engine/input.js';
import { detectQuality, createGovernor } from './engine/quality.js';
import { SCENES } from './scenes/index.js';

// ------------------------------------------------------------
//  Sunum motoru
// ------------------------------------------------------------
const quality = detectQuality();
const world = createWorld(document.getElementById('stage'), { quality });
const rig = createRig(world.camera);
const caption = createCaption(document.getElementById('captions'));

const hudCount = document.getElementById('hud-count');
const hudBar = document.getElementById('hud-bar');
const tbSheet = document.getElementById('tb-sheet');

const total = SCENES.length;
const state = { index: -1, step: 0 };

// Sahne kancalarına verilen bağlam
const ctx = { world, rig, caption, gsap, THREE, state, scenes: SCENES, fx: {} };

// Sahnenin 3D efektini ilk ihtiyaçta kur, sonra yeniden kullan
function effectOf(s) {
  if (!s?.effect) return null;
  return (ctx.fx[s.id] ??= s.effect(ctx));
}

function applyWorld(ws = {}, instant) {
  const d = instant ? 0 : 1.4;
  world.setNight(ws.night ?? 0, d);
  world.particles.set({ chaos: ws.chaos ?? 0.12, order: ws.ordered ? 1 : 0 }, d);
  world.station.setEdgeActive(ws.edge ? 1 : 0, instant ? 0.01 : 1);
  world.setLabels(ws.labels ?? true, instant ? 0 : 0.8);
  document.body.classList.toggle('night', !!ws.night);
}

function updateHud() {
  const s = SCENES[state.index];
  const sub = s.steps ? state.step / (s.steps + 1) : 0;
  hudCount.textContent = `${state.index + 1} / ${total}`;
  hudBar.style.width = `${((state.index + sub + 1) / total) * 100}%`;
  tbSheet.textContent = String(state.index + 1).padStart(2, '0');
}

function goTo(i, { instant = false, fromHash = false } = {}) {
  i = Math.max(0, Math.min(total - 1, i));
  if (i === state.index) return;

  const prev = SCENES[state.index];
  prev?.exit?.(ctx);
  effectOf(prev)?.exit?.();

  state.index = i;
  state.step = 0;
  const s = SCENES[i];

  // corner: dikey telefonda sahneyi metnin olmadığı yarıya kaydırmak için
  rig.flyTo({ ...s.cam, corner: s.corner }, instant ? 0 : s.cam.duration ?? 2.4);
  applyWorld(s.world, instant);
  caption.show(s, i, { instant });
  s.enter?.(ctx, { instant });
  effectOf(s)?.enter?.({ instant });
  runStep(s, 0);

  document.body.dataset.scene = s.id;
  document.body.classList.toggle('interactive', !!s.interactive);
  if (!fromHash) history.replaceState(null, '', `#${i + 1}`);
  updateHud();
}

function runStep(s, i) {
  s.step?.(ctx, i);
  effectOf(s)?.step?.(i);
}

function next() {
  const s = SCENES[state.index];
  if (s.steps && state.step < s.steps) {
    state.step++;
    runStep(s, state.step);
    updateHud();
    return;
  }
  goTo(state.index + 1);
}

function prev() {
  const s = SCENES[state.index];
  if (s.steps && state.step > 0) {
    state.step--;
    runStep(s, state.step);
    updateHud();
    return;
  }
  goTo(state.index - 1);
}

function hashIndex() {
  const n = parseInt(location.hash.replace('#', ''), 10);
  return Number.isFinite(n) ? n - 1 : -1;
}

bindInput({
  next,
  prev,
  isInteractive: () => !!SCENES[state.index]?.interactive,
  onReset: () => window.dispatchEvent(new CustomEvent('burble:reset')),
});

// Tam ekran butonu (dokunmatik cihazlarda; iOS Safari desteklemediği için orada gizli kalır)
if (document.fullscreenEnabled) document.body.classList.add('fs-ok');
document.getElementById('hud-fs').addEventListener('click', (e) => {
  toggleFullscreen();
  e.currentTarget.blur();
});

window.addEventListener('hashchange', () => {
  const i = hashIndex();
  if (i >= 0 && i !== state.index) goTo(i, { fromHash: true });
});

// ---- Açılış ----
const start = hashIndex();
if (start >= 0) {
  goTo(start, { instant: true });
} else {
  // Kamera yukarıdan istasyona iner
  rig.set({ pos: [0.5, 75, 6], target: [0, 0, 0], fov: 35 });
  goTo(0);
}

// ---- Döngü ----
const governor = createGovernor((level, fps) => {
  world.degrade(level);
  console.info(`[burble] kalite kademesi ${level} (≈${fps.toFixed(0)} fps)`);
});

const clock = new THREE.Clock();
function frame(dt, t) {
  world.update(dt, t);
  SCENES[state.index]?.update?.(ctx, dt, t);
  rig.update(t, window.innerWidth, window.innerHeight);
  world.render();
}
world.renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  frame(dt, clock.elapsedTime);
  governor.tick(dt);
});

// Geliştirme kolaylığı
window.burble = { goTo: (n) => goTo(n - 1), world, rig, state };
if (import.meta.env.DEV) {
  // Arka plandaki sekmede (rAF durur) zamanı elle ilerletmek için: burble.advance(3)
  let simT = 0;
  window.burble.advance = (sec) => {
    const tl = gsap.globalTimeline;
    for (let s = 0; s < sec; s += 1 / 30) {
      tl.totalTime(tl.totalTime() + 1 / 30);
      simT += 1 / 30;
      frame(1 / 30, clock.elapsedTime + simT);
    }
  };
}
