import * as THREE from 'three';
import gsap from 'gsap';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { C } from './palette.js';
import { setLineNight } from './materials.js';
import { buildGround } from './ground.js';
import { buildStation, flowPaths } from './station.js';
import { createParticles } from './particles.js';
import { setTagGroup } from './labels.js';

export function createWorld(container, { quality = 'high' } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'low' ? 1 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.className = 'labels';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.paper);
  scene.fog = new THREE.Fog(C.paper, 60, 220);

  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 800);

  // Yumuşak, maket ışığı
  const hemi = new THREE.HemisphereLight(0xffffff, 0xe6dfd0, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(14, 24, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality === 'low' ? 1024 : 2048, quality === 'low' ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -24; sc.right = 24; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 70;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const ground = buildGround(scene);
  const station = buildStation(scene);
  const particles = createParticles(scene, flowPaths(), quality === 'low' ? 320 : 760);

  // ---- Gece modu (sahne 2) ----
  const night = { v: 0 };
  const dayBg = new THREE.Color(C.paper);
  const nightBg = new THREE.Color(C.night);
  function applyNight() {
    const v = night.v;
    scene.background.copy(dayBg).lerp(nightBg, v);
    scene.fog.color.copy(scene.background);
    hemi.intensity = THREE.MathUtils.lerp(1.6, 0.22, v);
    sun.intensity = THREE.MathUtils.lerp(1.9, 0.12, v);
    ground.gridMats.forEach((m, i) => { m.opacity = ground.gridBase[i] * (1 - v * 0.6); });
    setLineNight(v);
  }
  function setNight(v, duration = 1.2) {
    if (duration <= 0) { night.v = v; applyNight(); return; }
    gsap.to(night, { v, duration, ease: 'power2.inOut', onUpdate: applyNight, overwrite: 'auto' });
  }

  // ---- İstasyon etiketlerinin görünürlüğü (efekt etiketleri etkilenmez) ----
  function setLabels(on, duration = 0.6) {
    setTagGroup('station', on, duration);
  }

  // ---- Sis (harita sahnesinde uzağı görmek için açılır) ----
  const fogBase = { near: scene.fog.near, far: scene.fog.far };
  function setFog(near = fogBase.near, far = fogBase.far, duration = 1.5) {
    gsap.to(scene.fog, { near, far, duration, ease: 'power2.inOut', overwrite: 'auto' });
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // Sahneye özel güncelleyiciler (alarm ikonları, tarama dalgası vb.) buraya eklenir
  const updaters = new Set();

  function update(dt, t) {
    particles.update(dt, t);
    for (const fn of updaters) fn(dt, t);
  }

  function render() {
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  // Performans düşüşünde kademeli kalite azaltma
  function degrade(level) {
    if (level === 1) particles.setCount(particles.mesh.count * 0.6);
    if (level === 2) { renderer.setPixelRatio(1); particles.setCount(particles.mesh.count * 0.7); }
    if (level === 3) { sun.castShadow = false; renderer.shadowMap.enabled = false; }
  }

  return {
    renderer, labelRenderer, scene, camera, sun, hemi,
    ground, station, particles, updaters,
    setNight, setLabels, setFog, update, render, resize, degrade,
  };
}
