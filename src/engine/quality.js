// Başlangıç kalite tahmini (?q=low|high ile zorlanabilir)
export function detectQuality() {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'high') return q;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  return mobile || cores <= 4 || mem <= 4 ? 'low' : 'high';
}

// FPS izleyici: 2 sn'lik pencerelerde ardışık 2 kez < 50 fps → bir kademe düşür.
export function createGovernor(onDegrade, { warmup = 3 } = {}) {
  let elapsed = 0, acc = 0, frames = 0, strikes = 0, level = 0;
  return {
    tick(dt) {
      elapsed += dt;
      if (elapsed < warmup || level >= 3) return;
      acc += dt;
      frames++;
      if (acc < 2) return;
      const fps = frames / acc;
      acc = 0;
      frames = 0;
      if (fps < 50) {
        if (++strikes >= 2) {
          level++;
          strikes = 0;
          onDegrade(level, fps);
        }
      } else strikes = 0;
    },
  };
}
