// Klavye, tekerlek, tıklama ve dokunma ile sunum kontrolü.
const CONTROL = /^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/;

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

export function bindInput({ next, prev, isInteractive, onReset }) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const onControl = CONTROL.test(e.target.tagName) || e.target.isContentEditable;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
        if (typing) return;
        e.preventDefault();
        next();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        if (typing) return;
        e.preventDefault();
        prev();
        break;
      case ' ':
        // odaktaki buton boşlukla basılabilsin
        if (onControl) return;
        e.preventDefault();
        next();
        break;
      case 'f':
      case 'F':
        if (typing) return;
        toggleFullscreen();
        break;
      case 'r':
      case 'R':
        if (typing) return;
        onReset();
        break;
      default:
    }
  });

  // Tekerlek: hareket başına tek adım. Trackpad ataleti tek bir "jest" sayılır;
  // yeni jest için 350 ms sessizlik + en az 900 ms aralık gerekir.
  let acc = 0;
  let lastWheel = 0;
  let lastFire = 0;
  let fired = false;
  window.addEventListener('wheel', (e) => {
    if (e.target.closest?.('[data-scroll]')) return;
    const now = performance.now();
    if (now - lastWheel > 350) { fired = false; acc = 0; }
    lastWheel = now;
    if (fired || now - lastFire < 900) return;
    acc += e.deltaY;
    if (Math.abs(acc) > 50) {
      (acc > 0 ? next : prev)();
      fired = true;
      lastFire = now;
    }
  }, { passive: true });

  // Tıklama (sürükleme değilse) → ileri. Etkileşimli sahnede ve UI üzerinde değil.
  let down = null;
  window.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  window.addEventListener('pointerup', (e) => {
    if (!down || e.button !== 0) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    const moved = Math.hypot(dx, dy);
    const start = down;
    down = null;
    if (e.target.closest?.('.ui, button, a, input, select')) return;

    // Dokunmatik kaydırma
    if (e.pointerType === 'touch' && moved > 50) {
      const d = Math.abs(dx) > Math.abs(dy) ? -dx : -dy;
      (d > 0 ? next : prev)();
      return;
    }
    if (moved < 10 && performance.now() - start.t < 500 && !isInteractive()) {
      // Dokunmatikte ekranın sol kenarına dokunmak geri götürür (hikâye/sunum alışkanlığı)
      if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.25) prev();
      else next();
    }
  });
}
