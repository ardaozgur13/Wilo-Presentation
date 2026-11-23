import gsap from 'gsap';

// Bir grubun tüm malzemelerini + CSS2D etiketlerini birlikte açıp kapatır.
export function makeFader(root) {
  const mats = [];
  const els = [];
  root.traverse((o) => {
    if (o.material) {
      // Paylaşılan (önbellekteki) malzemeyi soldurmak başka nesneleri de etkiler → kopyala
      if (!Array.isArray(o.material) && o.material.userData.shared) {
        const c = o.material.clone();
        c.userData = { dayColor: o.material.userData.dayColor };
        o.material = c;
      }
      for (const m of [].concat(o.material)) {
        if (mats.includes(m)) continue;
        m.transparent = true;
        m.userData.baseOpacity ??= m.opacity;
        mats.push(m);
      }
    }
    if (o.isCSS2DObject) els.push(o.element);
  });
  const s = { v: 0 };
  const apply = () => {
    for (const m of mats) m.opacity = m.userData.baseOpacity * s.v;
    for (const e of els) e.style.opacity = s.v;
    root.visible = s.v > 0.001;
  };
  apply();
  return {
    state: s,
    // killTweensOf: gecikmeli (henüz başlamamış) tween'leri de iptal eder — hızlı sahne atlamalarında önemli
    show(duration = 0.8, delay = 0) {
      gsap.killTweensOf(s);
      return gsap.to(s, { v: 1, duration, delay, ease: 'power2.out', onUpdate: apply });
    },
    hide(duration = 0.5) {
      gsap.killTweensOf(s);
      return gsap.to(s, { v: 0, duration, ease: 'power2.in', onUpdate: apply });
    },
  };
}

// Tekrarlanabilir rastgele sayı üreteci (sahne her açıldığında aynı yerleşim)
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dünya döngüsüne güncelleyici ekle/çıkar
export function loop(world, fn) {
  return {
    start: () => world.updaters.add(fn),
    stop: () => world.updaters.delete(fn),
  };
}
