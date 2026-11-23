import { BASE, RHO, G, M_PER_BAR, fmt, pct } from './sim.js';

// Kural motoru — sahne 6'daki üç kuralın kod hâli.
// Karar kurallarla verilir; metin yalnızca sonuçtan üretilir (dil modelinin rolü bu).

const ETA_BAND = [0.62, 0.8];
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const range = (a) => Math.max(...a) - Math.min(...a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ρ·g·Q·H = η·P  →  η = ρ·g·Q·H / P
export function eta(p, q, w) {
  return (RHO * G * (q / 3600) * (p * M_PER_BAR)) / (w * 1000);
}

/**
 * @param history son örnekler (0,25 s aralıklı)
 * @param sim     simülasyon durumu (donma süresi için)
 * @returns {{kind, title?, sub?, conf?, evidence?, rule?, dev?}}
 */
export function diagnose(history, sim) {
  if (history.length < 8) return { kind: 'analyzing', dev: 0 };

  const recent = history.slice(-8); // son 2 s ortalaması (gürültüye karşı)
  const p = mean(recent.map((s) => s.p));
  const q = mean(recent.map((s) => s.q));
  const w = mean(recent.map((s) => s.w));
  const i = mean(recent.map((s) => s.i));
  const dP = (p - BASE.p) / BASE.p;
  const dQ = (q - BASE.q) / BASE.q;
  const dW = (w - BASE.w) / BASE.w;
  const dI = (i - BASE.i) / BASE.i;
  const e = eta(p, q, w);
  const dev = Math.max(Math.abs(dP), Math.abs(dQ), Math.abs(dW), Math.abs(dI));

  // ---- Kural 1: fizik tutarsızlığı → sensör arızası ----
  // Debi ve güç değişiyor ama basınç bir bit bile oynamıyor: ölçüm donmuş.
  const win = history.slice(-24);
  if (win.length >= 24) {
    const pr = range(win.map((s) => s.p));
    const rq = range(win.map((s) => s.q)) / BASE.q;
    const rw = range(win.map((s) => s.w)) / BASE.w;
    if (pr < 1e-9 && (rq > 0.04 || rw > 0.04)) {
      // Donmuş basınçla hesaplanan verim sabit kalmaz — fizik dengesi bozulur
      const etas = win.map((s) => eta(s.p, s.q, s.w));
      const eMin = Math.min(...etas);
      const eMax = Math.max(...etas);
      const hours = sim.frozenSince != null ? Math.floor((sim.simTime - sim.frozenSince) / 3600) : 0;
      return {
        kind: 'sensor',
        title: 'AI_07 → sensör arızası',
        sub: `${hours} saattir sabit`,
        conf: clamp(0.86 + (rq + rw) * 0.45, 0.86, 0.97),
        evidence: [
          `PT-102 (AI_07) ${hours} saattir ${fmt(win[0].p)} bar`,
          `Debi ±${(rq * 50).toFixed(0)} %, güç ±${(rw * 50).toFixed(0)} % oynuyor`,
          `ρ·g·Q·H ≠ η·P → η ${fmt(eMin)}–${fmt(eMax)} arasında oynuyor`,
        ],
        rule: 'Kural 1 · hidrolik değişti, ölçüm aynı → sensör',
        frozenTag: 'PT-102',
        dev,
      };
    }
  }

  // ---- Kural 2: basınç ↓, debi ↑, güç ↑ → gerçek kaçak ----
  if (dP < -0.08 && dQ > 0.08 && dW > 0.04) {
    const score = (Math.min(1, -dP / 0.15) + Math.min(1, dQ / 0.2) + Math.min(1, dW / 0.1)) / 3;
    return {
      kind: 'leak',
      title: "Hat 2'de gerçek basınç kaybı",
      sub: 'muhtemel kaçak',
      conf: clamp(0.7 + 0.25 * score, 0.5, 0.96),
      evidence: [`Basınç ${pct(dP)}`, `Debi ${pct(dQ)}`, `Motor gücü ${pct(dW)}`],
      rule: 'Kural 2 · basınç↓ debi↑ güç↑ → kaçak',
      dev,
    };
  }

  // ---- Kural 3: basınç ↑, debi ↓, akım ↑ → kısık vana ----
  if (dP > 0.08 && dQ < -0.08 && dI > 0.05) {
    const score = (Math.min(1, dP / 0.18) + Math.min(1, -dQ / 0.27) + Math.min(1, dI / 0.14)) / 3;
    return {
      kind: 'valve',
      title: "Hat 2'de debi kısıtı",
      sub: 'muhtemel kısık vana (V-02)',
      conf: clamp(0.68 + 0.25 * score, 0.5, 0.95),
      evidence: [`Basınç ${pct(dP)}`, `Debi ${pct(dQ)}`, `Motor akımı ${pct(dI)}`],
      rule: 'Kural 3 · basınç↑ debi↓ akım↑ → kısık vana',
      dev,
    };
  }

  if (dev > 0.045) return { kind: 'analyzing', dev };

  return {
    kind: 'normal',
    title: 'Olay yok',
    sub: 'Hat 2 tutarlı',
    conf: clamp(0.97 - dev * 2, 0.8, 0.97),
    evidence: [
      `η ${fmt(e)} · beklenen ${fmt(ETA_BAND[0])}–${fmt(ETA_BAND[1])}`,
      'Hidrolik ve elektrik verisi uyumlu',
    ],
    rule: 'Çapraz kontrol · ρ·g·Q·H = η·P',
    dev,
  };
}

export const KIND_LABEL = {
  leak: 'kaçak',
  valve: 'kısık vana',
  sensor: 'sensör arızası',
  normal: 'olay yok',
};
