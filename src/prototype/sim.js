// Hat 2 (P-02) için basit, fizik tabanlı JS simülasyonu.
// Değerler: p basınç [bar], q debi [m³/h], w motor gücü [kW], i motor akımı [A].
// Normal çalışma noktası: 4,25 bar · 42,5 m³/h · η≈0,70 → 7,16 kW.

export const RHO = 1000;
export const G = 9.81;
export const M_PER_BAR = 10.197; // 1 bar ≈ 10,2 mSS

export const BASE = { p: 4.25, q: 42.5, w: 7.16, i: 12.2 };

const TARGETS = {
  normal: { ...BASE },
  leak: { p: 3.62, q: 51.0, w: 7.88, i: 13.4 },   // basınç ↓  debi ↑  güç ↑
  valve: { p: 5.02, q: 31.0, w: 7.42, i: 13.9 },  // basınç ↑  debi ↓  akım ↑
};

export const SAMPLE_DT = 0.25;   // örnekleme aralığı [s]
const HISTORY = 48;              // 12 s pencere
const TAU = 1.3;                 // sürecin zaman sabiti [s]

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function createSim() {
  const st = {
    scenario: 'normal',
    ...BASE,
    t: 0,
    simTime: 3 * 3600 + 14 * 60, // 03:14:00
    frozenValue: null,
    frozenSince: null,
    history: [],
    acc: 0,
  };

  function setScenario(name) {
    st.scenario = name;
    st.history = [];
    if (name === 'freeze') {
      st.frozenValue = BASE.p;
      st.frozenSince = st.simTime - (6 * 3600 + 7 * 60); // donma 6 saat önce başladı
    } else {
      st.frozenValue = null;
      st.frozenSince = null;
    }
  }

  function target() {
    if (st.scenario === 'freeze') {
      // VFD devri salınıyor (talep değişimi). Benzeşim yasaları: Q∝n, H∝n², P∝n³
      const n = 1 + 0.07 * Math.sin(st.t * 0.75);
      return { q: BASE.q * n, p: BASE.p * n * n, w: BASE.w * n ** 3, i: BASE.i * n ** 2.6 };
    }
    return TARGETS[st.scenario];
  }

  // Yeni örnek üretildiyse onu döndürür
  function step(dt) {
    st.t += dt;
    st.simTime += dt;
    const tgt = target();
    const k = 1 - Math.exp(-dt / TAU);
    for (const key of ['p', 'q', 'w', 'i']) st[key] += (tgt[key] - st[key]) * k;

    st.acc += dt;
    if (st.acc < SAMPLE_DT) return null;
    st.acc -= SAMPLE_DT;
    const s = {
      time: st.simTime,
      p: st.frozenValue ?? st.p + gauss() * 0.012,
      q: st.q + gauss() * 0.22,
      w: st.w + gauss() * 0.03,
      i: st.i + gauss() * 0.05,
      frozen: st.frozenValue != null,
    };
    st.history.push(s);
    if (st.history.length > HISTORY) st.history.shift();
    return s;
  }

  function reset() {
    Object.assign(st, BASE, { t: 0, simTime: 3 * 3600 + 14 * 60, acc: 0 });
    setScenario('normal');
  }

  return { state: st, setScenario, step, reset };
}

// ---- Biçimlendirme (Türkçe ondalık virgül) ----
export const fmt = (x, d = 2) => x.toFixed(d).replace('.', ',');
export const pct = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(0)} %`;
export function clock(sec, sep = ':') {
  const s = Math.floor(sec) % 86400;
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return sep === '.' ? `${hh}.${mm}` : `${hh}:${mm}:${ss}`;
}
