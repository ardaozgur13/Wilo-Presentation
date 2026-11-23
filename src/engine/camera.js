import * as THREE from 'three';
import gsap from 'gsap';

// Kamera "rig"i: hedef pozisyon/odak noktası, GSAP ile kavisli uçuş,
// hafif nefes alma hareketi, fare paralaksı ve ekran kaydırma (viewOffset).
export function createRig(camera) {
  const pos = new THREE.Vector3();
  const target = new THREE.Vector3();
  const opt = { shift: 0, shiftY: 0, fov: 35 };
  let tween = null;

  const pointer = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  // Ekran düzeni: "portrait" (dikey telefon), "narrow" (dar ve kareye yakın), "wide" (masaüstü/projeksiyon)
  const NARROW = 900;
  function layout() {
    const w = window.innerWidth;
    const aspect = w / window.innerHeight;
    if (aspect < 0.8) return 'portrait';
    if (w <= NARROW && aspect < 1.3) return 'narrow';
    return 'wide';
  }
  // Sahne kamerasının bu düzene uygun varyantı:
  //  - portrait: cam.portrait → cam.narrow → otomatik (yatay kaydırma yok; metin altta ise sahne yukarı, üstte ise aşağı)
  //  - narrow:   cam.narrow
  function pick(cam) {
    const mode = layout();
    if (mode === 'portrait') {
      if (cam.portrait) return { ...cam, ...cam.portrait };
      if (cam.narrow) return { ...cam, ...cam.narrow };
      const top = (cam.corner || 'bl').startsWith('t');
      return { ...cam, shift: 0, shiftY: top ? -0.1 : 0.13 };
    }
    if (mode === 'narrow' && cam.narrow) return { ...cam, ...cam.narrow };
    return cam;
  }

  function set(cam) {
    cam = pick(cam);
    tween?.kill();
    pos.fromArray(cam.pos);
    target.fromArray(cam.target);
    opt.shift = cam.shift ?? 0;
    opt.shiftY = cam.shiftY ?? 0;
    opt.fov = cam.fov ?? 35;
  }

  function flyTo(cam, duration = 2.4) {
    if (duration <= 0) { set(cam); return; }
    cam = pick(cam);
    tween?.kill();
    const fromP = pos.clone();
    const fromT = target.clone();
    const toP = new THREE.Vector3().fromArray(cam.pos);
    const toT = new THREE.Vector3().fromArray(cam.target);
    // uzun yolculuklarda hafif yay çiz
    const lift = Math.min(10, fromP.distanceTo(toP) * 0.16);
    const o = { p: 0 };
    tween = gsap.timeline()
      .to(o, {
        p: 1,
        duration,
        ease: 'power3.inOut',
        onUpdate() {
          pos.lerpVectors(fromP, toP, o.p);
          pos.y += Math.sin(o.p * Math.PI) * lift;
          target.lerpVectors(fromT, toT, o.p);
        },
      }, 0)
      .to(opt, { shift: cam.shift ?? 0, shiftY: cam.shiftY ?? 0, fov: cam.fov ?? 35, duration, ease: 'power3.inOut' }, 0);
  }

  // Düzen değişirse (pencere boyutu, telefonun döndürülmesi) mevcut sahnenin kamerasını yeniden uygula
  let lastLayout = layout();
  let currentCam = null;
  window.addEventListener('resize', () => {
    const mode = layout();
    if (mode !== lastLayout && currentCam) flyTo(currentCam, 0.6);
    lastLayout = mode;
  });
  const track = (fn) => (cam, ...rest) => { currentCam = cam; return fn(cam, ...rest); };

  const dir = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const right = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function update(t, w, h) {
    smooth.x += (pointer.x - smooth.x) * 0.04;
    smooth.y += (pointer.y - smooth.y) * 0.04;

    dir.subVectors(pos, target);
    let dist = dir.length();
    // dar/dikey ekranlarda kamerayı geri çek
    const aspect = w / h;
    const k = aspect < 1.6 ? Math.pow(1.6 / aspect, 0.75) : 1;
    dist *= k;
    dir.normalize();

    tmp.copy(target).addScaledVector(dir, dist);
    right.crossVectors(dir, UP).normalize();
    const amp = dist * 0.006;
    tmp.addScaledVector(right, Math.sin(t * 0.21) * amp * 2 - smooth.x * dist * 0.012);
    tmp.y += Math.sin(t * 0.33) * amp + smooth.y * dist * 0.008;

    camera.position.copy(tmp);
    camera.lookAt(target);
    camera.fov = opt.fov;
    if (Math.abs(opt.shift) > 1e-4 || Math.abs(opt.shiftY) > 1e-4) {
      camera.setViewOffset(w, h, opt.shift * w, opt.shiftY * h, w, h);
    }
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  return { pos, target, opt, set: track(set), flyTo: track(flyTo), update };
}
