import gsap from 'gsap';
import { createSim, clock } from './sim.js';
import { diagnose, KIND_LABEL } from './rules.js';
import { createPanel, SCENARIOS } from './panel.js';
import { createStage } from './stage.js';

const EVENT_KINDS = new Set(['leak', 'valve', 'sensor']);
const DEBOUNCE = 4; // yeni karar türü için ardışık örnek sayısı (≈1 s)

// Sahne 7 — prototip denetleyicisi: simülasyon → kural motoru → panel + 3D sahne.
export function createPrototype({ world }) {
  const sim = createSim();
  const stage = createStage(world);
  const panel = createPanel({ onScenario, onApprove, onCorrect });

  let active = false;
  let shown = null;          // panelde gösterilen karar
  let cand = { kind: null, n: 0 };
  let handled = false;       // mevcut karar onaylandı/düzeltildi mi
  let done = null;           // panelde gösterilen "kayda geçti" bilgisi
  let records = 0;
  let alarms = 2;
  let sinceScenario = 0;
  let sampleNo = 0;

  function onScenario(id) {
    sim.setScenario(id);
    stage.setScenario(id);
    panel.setScenario(id);
    panel.resetDecision();
    shown = null;
    cand = { kind: null, n: 0 };
    handled = false;
    done = null;
    sinceScenario = 0;
    refreshUi();
  }

  function stamp() { return clock(sim.state.simTime, '.'); }

  function onApprove() {
    // "Olay yok" kararı da onaylanabilir: normal çalışma örneği de veri setine etiketli girer
    if (!shown || shown.kind === 'analyzing' || handled) return;
    handled = true;
    records++;
    panel.addLog(`${stamp()} · <b>onaylandı</b> · ${KIND_LABEL[shown.kind]} (Hat 2)`);
    stage.flyCube(false);
    done = { text: `✓ Onaylandı — kayıt #${records} veri setine eklendi` };
    refreshUi();
  }

  function onCorrect(to) {
    if (!shown || shown.kind === 'analyzing' || handled) return;
    handled = true;
    records++;
    const from = KIND_LABEL[shown.kind];
    const text = to === shown.kind
      ? `${stamp()} · <b>onaylandı</b> · ${from} (Hat 2)`
      : `${stamp()} · <b>düzeltildi</b> · ${from} → ${KIND_LABEL[to]}`;
    panel.addLog(text, to === shown.kind ? '' : 'fixd');
    stage.flyCube(to !== shown.kind);
    done = to === shown.kind
      ? { text: `✓ Onaylandı — kayıt #${records} veri setine eklendi` }
      : { text: `✎ Düzeltildi → ${KIND_LABEL[to]} — kayıt #${records} veri setine eklendi`, fixed: true };
    refreshUi();
  }

  function refreshUi() {
    const kind = shown?.kind ?? 'analyzing';
    const isEvent = EVENT_KINDS.has(kind);
    const decided = kind !== 'analyzing' && !handled;
    panel.setActions({ approve: decided, fix: decided, done: handled ? done : null });
    panel.setCounters({ alarms, events: isEvent ? 1 : 0, records });
  }

  function onSample(s) {
    sampleNo++;
    const d = diagnose(sim.state.history, sim.state);

    // Karar türü değişimini kısa süre doğrula (titreşmeyi önler)
    if (d.kind === cand.kind) cand.n++;
    else cand = { kind: d.kind, n: 1 };
    if (!shown || d.kind === shown.kind || cand.n >= DEBOUNCE) {
      if (shown && d.kind !== shown.kind) { handled = false; done = null; }
      shown = d;
    }
    panel.setDecision(shown);

    // Ham alarm sayısı: olay başladığında hızla 40'a tırmanır; Burble bunları tek olaya indirger
    const alarmTarget = sim.state.scenario === 'normal' ? 2 : Math.min(40, 2 + Math.round(38 * Math.min(1, sinceScenario / 3)));
    alarms += Math.sign(alarmTarget - alarms) * Math.min(3, Math.abs(alarmTarget - alarms));

    const frozenAlert = shown.kind === 'sensor';
    if (sampleNo % 2 === 0) {
      panel.pushSample(s, frozenAlert);
      stage.setLive(s, frozenAlert);
      panel.setClock(s.time);
    }
    refreshUi();
  }

  function update(dt, t) {
    if (!active) return;
    sinceScenario += dt;
    const s = sim.step(dt);
    if (s) onSample(s);
    stage.update(dt, t);
  }

  // İlk girişte terminal boş görünmesin
  function prefill() {
    for (let k = 0; k < 40; k++) {
      const s = sim.step(0.25);
      if (s) onSample(s);
    }
  }

  function reset() {
    sim.reset();
    stage.reset();
    panel.clearLog();
    panel.clearTerm();
    records = 0;
    alarms = 2;
    onScenario('normal');
    prefill();
  }

  // Klavye: 1–4 senaryo seçer (yalnızca prototip açıkken)
  window.addEventListener('keydown', (e) => {
    if (!active || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= SCENARIOS.length) onScenario(SCENARIOS[n - 1][0]);
  });
  window.addEventListener('burble:reset', reset);

  onScenario('normal');
  prefill();

  return {
    enter() {
      active = true;
      world.updaters.add(update);
      stage.show();
      stage.setScenario(sim.state.scenario);
      gsap.killTweensOf(panel.el);
      gsap.fromTo(panel.el, { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.8, delay: 1.3, ease: 'power3.out' });
    },
    exit() {
      active = false;
      world.updaters.delete(update);
      stage.hide();
      gsap.killTweensOf(panel.el);
      gsap.to(panel.el, { autoAlpha: 0, x: 40, duration: 0.35, ease: 'power2.in' });
      if (panel.el.contains(document.activeElement)) document.activeElement.blur();
    },
  };
}
