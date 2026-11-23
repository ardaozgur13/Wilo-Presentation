import * as THREE from 'three';
import gsap from 'gsap';
import { C } from './palette.js';
import { mat, solid, edges, cylBetween, lineMat } from './materials.js';
import { makeTag } from './labels.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---- Yerleşim sabitleri (metre) ----
export const PUMP_X = [-3.2, 0, 3.2];
const Y_SUC = 0.9;    // emiş kolektörü yüksekliği
const Z_SUC = -2.4;   // emiş kolektörü hattı
const Z_PUMP = -0.7;  // salyangoz (pompa gövdesi) merkezi
const Y_DIS = 2.7;    // basma kolektörü yüksekliği
const X_DIS_END = 7.6;
const Y_OUT = 0.9;
const TANK = V(-9.5, 0, Z_SUC);
const TANK_R = 2;
const TANK_H = 3.6;

export const ANCHORS = {
  tank: TANK.clone().setY(TANK_H + 0.5),
  plc: V(6.5, 1.3, 3.2),
  plcFront: V(6.5, 1.5, 3.6),
  vfd: V(4.4, 1.2, 3.3),
  edge: V(7.47, 1.5, 3.2),
  outlet: V(16, Y_OUT, Z_PUMP),
};

// Partiküllerin aktığı yollar (borularla birebir aynı)
export function flowPaths() {
  const paths = [];
  // 0: depoya giriş
  paths.push([V(-17, 3.0, Z_SUC), V(-11.5, 3.0, Z_SUC)]);
  // 1..3: her pompa hattı (depo → emiş → pompa → basma → çıkış)
  for (const px of PUMP_X) {
    paths.push([
      V(-7.5, Y_SUC, Z_SUC),
      V(px, Y_SUC, Z_SUC),
      V(px, Y_SUC, Z_PUMP),
      V(px, Y_DIS, Z_PUMP),
      V(X_DIS_END, Y_DIS, Z_PUMP),
      V(X_DIS_END, Y_OUT, Z_PUMP),
      ANCHORS.outlet.clone(),
    ]);
  }
  return paths;
}

export function buildStation(scene) {
  const root = new THREE.Group();
  const tags = {};

  const M = {
    concrete: mat(C.concrete),
    paper: mat(C.paper2),
    steel: mat(C.steel),
    metal: mat(C.metal),
    dark: mat(C.ink2),
    ink: mat(C.ink),
    pipe: new THREE.MeshStandardMaterial({
      color: C.pipe,
      transparent: true,
      opacity: 0.32,
      roughness: 0.6,
      depthWrite: false,
    }),
    flange: mat(C.steel),
  };

  const addTag = (key, text, pos, cls) => {
    const t = makeTag(text, cls);
    t.position.copy(pos);
    root.add(t);
    tags[key] = t;
    return t;
  };

  // ---------- Borular ----------
  const elbowGeo = new Map();
  function pipeRun(pts, r) {
    const g = new THREE.Group();
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = cylBetween(pts[i], pts[i + 1], r, M.pipe, 14);
      seg.renderOrder = 2;
      edges(seg, 40, 0.38);
      g.add(seg);
      if (i > 0) {
        if (!elbowGeo.has(r)) elbowGeo.set(r, new THREE.SphereGeometry(r * 1.06, 12, 8));
        const e = new THREE.Mesh(elbowGeo.get(r), M.pipe);
        e.position.copy(pts[i]);
        e.renderOrder = 2;
        g.add(e);
      }
    }
    // uç flanşları
    for (const [p, q] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]]) {
      const dir = q.clone().sub(p).normalize();
      const f = solid(new THREE.CylinderGeometry(r * 1.5, r * 1.5, 0.07, 14), M.flange, { threshold: 40 });
      f.position.copy(p).addScaledVector(dir, 0.04);
      f.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
      g.add(f);
    }
    root.add(g);
    return g;
  }

  // Depoya giriş
  pipeRun([V(-17, 3.0, Z_SUC), V(-11.5, 3.0, Z_SUC)], 0.18);
  // Emiş kolektörü + pompa dalları
  pipeRun([V(-7.5, Y_SUC, Z_SUC), V(PUMP_X[2], Y_SUC, Z_SUC)], 0.22);
  for (const px of PUMP_X) pipeRun([V(px, Y_SUC, Z_SUC), V(px, Y_SUC, Z_PUMP - 0.3)], 0.16);
  // Basma yükselticileri
  for (const px of PUMP_X) pipeRun([V(px, 1.42, Z_PUMP), V(px, Y_DIS, Z_PUMP)], 0.14);
  // Basma kolektörü → şehir hattı
  pipeRun([
    V(PUMP_X[0], Y_DIS, Z_PUMP),
    V(X_DIS_END, Y_DIS, Z_PUMP),
    V(X_DIS_END, Y_OUT, Z_PUMP),
    ANCHORS.outlet.clone(),
  ], 0.2);

  // ---------- Su deposu ----------
  const tank = new THREE.Group();
  tank.position.copy(TANK);
  const shell = solid(new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 22), M.paper);
  shell.position.y = TANK_H / 2;
  const roof = solid(new THREE.ConeGeometry(TANK_R + 0.08, 0.45, 22), M.paper);
  roof.position.y = TANK_H + 0.225;
  tank.add(shell, roof);
  for (const y of [1.2, 2.4]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(TANK_R + 0.01, 0.025, 4, 44), M.dark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    tank.add(ring);
  }
  // merdiven
  const ladder = new THREE.Group();
  const railGeo = new THREE.BoxGeometry(0.05, TANK_H + 0.3, 0.05);
  for (const x of [-0.22, 0.22]) {
    const rail = new THREE.Mesh(railGeo, M.dark);
    rail.position.set(x, (TANK_H + 0.3) / 2, 0);
    ladder.add(rail);
  }
  const rungGeo = new THREE.BoxGeometry(0.44, 0.03, 0.03);
  for (let y = 0.35; y < TANK_H + 0.2; y += 0.35) {
    const rung = new THREE.Mesh(rungGeo, M.dark);
    rung.position.y = y;
    ladder.add(rung);
  }
  ladder.position.set(0.9, 0, TANK_R * 0.9);
  ladder.rotation.y = 0.45;
  tank.add(ladder);
  root.add(tank);
  addTag('tank', 'T-01 · DEPO', V(TANK.x, TANK_H + 0.9, TANK.z));
  // seviye sensörü
  const lt = solid(new THREE.CylinderGeometry(0.1, 0.1, 0.35, 8), M.steel);
  lt.position.set(TANK.x - 1.1, TANK_H + 0.2, TANK.z + 0.6);
  root.add(lt);
  addTag('LT-001', 'LT-001', V(TANK.x - 1.6, TANK_H + 0.55, TANK.z + 0.6));

  // ---------- Pompalar ----------
  const pumps = [];
  const valves = [];
  const sensors = {};
  PUMP_X.forEach((px, i) => {
    const n = i + 1;
    const pump = new THREE.Group();
    pump.position.set(px, 0, 0);

    const plinth = solid(new THREE.BoxGeometry(1.4, 0.3, 2.7), M.concrete);
    plinth.position.set(0, 0.27, -0.05);
    const frame = solid(new THREE.BoxGeometry(1.1, 0.12, 2.35), M.dark, { edge: false });
    frame.position.set(0, 0.48, -0.05);

    const shake = new THREE.Group(); // titreşim için ayrı pivot
    const volute = solid(new THREE.CylinderGeometry(0.5, 0.5, 0.46, 14), M.steel);
    volute.rotation.x = Math.PI / 2;
    volute.position.set(0, Y_SUC, Z_PUMP);
    const coupling = solid(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 10), M.dark);
    coupling.rotation.x = Math.PI / 2;
    coupling.position.set(0, Y_SUC, -0.27);
    const motorMat = mat(C.metal);
    const motor = solid(new THREE.CylinderGeometry(0.43, 0.43, 1.15, 12), motorMat);
    motor.rotation.x = Math.PI / 2;
    motor.position.set(0, Y_SUC, 0.5);
    const fan = solid(new THREE.CylinderGeometry(0.38, 0.4, 0.26, 12), M.dark);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(0, Y_SUC, 1.2);
    const tbox = solid(new THREE.BoxGeometry(0.32, 0.22, 0.34), M.steel);
    tbox.position.set(0, Y_SUC + 0.52, 0.45);
    // motor kanatçıkları
    for (let k = -2; k <= 2; k++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 1.0), M.steel);
      const a = (k / 2) * 0.9;
      fin.position.set(Math.sin(a + Math.PI / 2) * 0.45, Y_SUC + Math.cos(a + Math.PI / 2) * 0.45, 0.5);
      fin.rotation.z = -a - Math.PI / 2;
      shake.add(fin);
    }
    shake.add(volute, coupling, motor, fan, tbox);
    pump.add(plinth, frame, shake);
    root.add(pump);

    // Vana (yükseltici üzerinde)
    const valve = new THREE.Group();
    valve.position.set(px, 1.95, Z_PUMP);
    const valveMat = mat(C.steel);
    const vBody = solid(new THREE.BoxGeometry(0.42, 0.36, 0.42), valveMat);
    const stem = solid(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6), M.dark, { edge: false });
    stem.rotation.x = Math.PI / 2;
    stem.position.z = 0.4;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 5, 14), M.dark);
    wheel.position.z = 0.62;
    valve.add(vBody, stem, wheel);
    root.add(valve);
    valves.push({ group: valve, material: valveMat, wheel });

    // Basınç transmitteri
    const pt = new THREE.Group();
    pt.position.set(px + 0.14, 2.4, Z_PUMP);
    const stalk = solid(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), M.dark, { edge: false });
    stalk.rotation.z = Math.PI / 2;
    stalk.position.x = 0.11;
    const head = solid(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 10), M.paper);
    head.rotation.z = Math.PI / 2;
    head.position.x = 0.3;
    pt.add(stalk, head);
    root.add(pt);
    sensors[`PT-10${n}`] = { group: pt, pos: V(px + 0.44, 2.4, Z_PUMP) };

    pumps.push({ group: pump, shake, motor, motorMat, x: px, n });
    addTag(`P-0${n}`, `P-0${n}`, V(px, 2.05, 0.6));
    addTag(`PT-10${n}`, `PT-10${n}`, V(px + 0.44, 2.62, Z_PUMP));
  });

  // Debimetre (çıkış hattı)
  const ft = new THREE.Group();
  ft.position.set(11, Y_OUT, Z_PUMP);
  const ftBody = solid(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12), M.steel);
  ftBody.rotation.z = Math.PI / 2;
  const ftHead = solid(new THREE.BoxGeometry(0.26, 0.2, 0.22), M.paper);
  ftHead.position.y = 0.42;
  ft.add(ftBody, ftHead);
  root.add(ft);
  sensors['FT-201'] = { group: ft, pos: V(11, Y_OUT + 0.6, Z_PUMP) };
  addTag('FT-201', 'FT-201', V(11, Y_OUT + 0.75, Z_PUMP));

  // ---------- PLC dolabı ----------
  const plc = new THREE.Group();
  plc.position.set(6.5, 0.12, 3.2);
  const plcBase = solid(new THREE.BoxGeometry(1.5, 0.12, 0.8), M.dark, { edge: false });
  plcBase.position.y = 0.06;
  const plcBody = solid(new THREE.BoxGeometry(1.4, 2.2, 0.7), M.paper);
  plcBody.position.y = 1.22;
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 2.0, 0.01), M.dark);
  seam.position.set(0, 1.22, 0.356);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), M.dark);
  handle.position.set(0.12, 1.3, 0.37);
  plc.add(plcBase, plcBody, seam, handle);
  // durum LED'leri
  const ledMats = [];
  for (let k = 0; k < 6; k++) {
    const lm = new THREE.MeshBasicMaterial({ color: k === 4 ? C.orange : C.teal });
    ledMats.push(lm);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), lm);
    led.position.set(-0.55 + k * 0.08, 2.1, 0.36);
    plc.add(led);
  }
  root.add(plc);
  addTag('PLC', 'PLC-01', V(6.5, 2.85, 3.2));

  // ---------- VFD (pompa sürücüsü) ----------
  const vfd = new THREE.Group();
  vfd.position.set(4.4, 0.12, 3.3);
  for (const x of [-0.3, 0.3]) {
    const leg = solid(new THREE.BoxGeometry(0.06, 0.6, 0.3), M.dark, { edge: false });
    leg.position.set(x, 0.3, 0);
    vfd.add(leg);
  }
  const vfdBody = solid(new THREE.BoxGeometry(0.82, 1.15, 0.45), M.paper);
  vfdBody.position.y = 1.17;
  const disp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.02), mat(C.ink, { emissive: C.teal, emissiveIntensity: 0.15 }));
  disp.position.set(0, 1.45, 0.23);
  const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.02), M.steel);
  keypad.position.set(0, 1.2, 0.23);
  vfd.add(vfdBody, disp, keypad);
  root.add(vfd);
  addTag('VFD', 'VFD-02', V(4.4, 2.15, 3.3));

  // VFD → motor kabloları (zemin kanalı)
  const cableMat = lineMat(0.55);
  PUMP_X.forEach((px) => {
    const pts = [V(4.4, 0.14, 3.0), V(4.4, 0.14, 1.9), V(px, 0.14, 1.9), V(px, 0.14, 1.32), V(px, 0.42, 1.32)];
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat));
  });

  // ---------- Burble Edge ----------
  const edge = new THREE.Group();
  edge.position.copy(ANCHORS.edge);
  const edgeBody = solid(new THREE.BoxGeometry(0.5, 0.34, 0.42), mat(0xfbfaf6));
  const stripeMat = mat(C.ink2, { emissive: C.teal, emissiveIntensity: 0 });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.505, 0.05, 0.425), stripeMat);
  stripe.position.y = 0.06;
  const ledMat = new THREE.MeshBasicMaterial({ color: C.ink2 });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), ledMat);
  led.position.set(0.16, -0.08, 0.215);
  edge.add(edgeBody, stripe, led);
  // PLC'ye kısa okuma kablosu
  const edgeCable = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([V(-0.25, -0.1, 0), V(-0.3, -0.1, 0), V(-0.3, -0.35, 0.1)]),
    lineMat(0.7),
  );
  edge.add(edgeCable);
  root.add(edge);
  addTag('EDGE', 'BURBLE EDGE', V(ANCHORS.edge.x + 0.1, ANCHORS.edge.y + 0.55, ANCHORS.edge.z), 'teal');

  const edgeState = { v: 0 };
  const tealC = new THREE.Color(C.teal);
  const offC = new THREE.Color(C.ink2);
  function applyEdge() {
    stripeMat.color.copy(offC).lerp(tealC, edgeState.v);
    stripeMat.emissiveIntensity = edgeState.v * 0.8;
    ledMat.color.copy(offC).lerp(tealC, edgeState.v);
  }
  function setEdgeActive(v, duration = 1) {
    gsap.to(edgeState, { v, duration, ease: 'power2.out', onUpdate: applyEdge });
  }
  applyEdge();

  scene.add(root);

  return {
    root,
    tags,
    pumps,
    valves,
    sensors,
    tank,
    plc,
    vfd,
    edge,
    ledMats,
    setEdgeActive,
  };
}
