import './panel.css';
import { fmt, clock, BASE } from './sim.js';
import { KIND_LABEL } from './rules.js';

export const SCENARIOS = [
  ['normal', 'Normal'],
  ['freeze', 'Sensör donması'],
  ['leak', 'Boru kaçağı'],
  ['valve', 'Kısık vana'],
];

const FIX_OPTIONS = ['leak', 'valve', 'sensor', 'normal'];

// Operatör paneli DOM'u. Mantık yok; controller (index.js) çağırır.
export function createPanel(handlers) {
  const el = document.createElement('section');
  el.className = 'proto ui';
  el.setAttribute('data-scroll', '');
  el.setAttribute('aria-label', 'Burble operatör paneli');
  el.innerHTML = `
    <header class="proto-head">
      <div class="ph-title">
        <b>Operatör paneli</b>
        <span>Terfi istasyonu · Hat 2 · P-02 · <span data-clock>03:14:00</span></span>
      </div>
      <div class="ph-stats">
        <div class="stat"><small>Alarm → Olay</small>
          <b><span class="al" data-alarms>2</span><span class="arrow">→</span><span class="ev" data-events>0</span></b></div>
        <div class="stat"><small>Onaylı kayıt</small><b data-records>0</b></div>
      </div>
    </header>
    <div class="scen" role="group" aria-label="Senaryo">
      ${SCENARIOS.map(([id, label], i) => `<button type="button" data-s="${id}"><kbd>${i + 1}</kbd>${label}</button>`).join('')}
    </div>
    <div class="proto-body">
      <div class="term">
        <div class="term-head"><span class="live">ham veri · salt okunur</span><span>Modbus · S7</span></div>
        <div class="term-cols">saat      basınç      debi         güç</div>
        <pre data-term></pre>
      </div>
      <div class="decision" aria-live="polite">
        <small class="d-k">Burble kararı</small>
        <div class="d-main wait" data-dmain>Analiz ediliyor</div>
        <div class="d-conf"><span data-dconf>güven —</span><i><b data-dbar></b></i></div>
        <ul class="d-ev" data-dev></ul>
        <small class="d-rule" data-drule></small>
        <div class="d-actions">
          <button type="button" class="btn-ok" data-approve disabled>Onayla</button>
          <button type="button" class="btn-fix" data-fix disabled>Düzelt</button>
        </div>
        <div class="fix-wrap" data-fixmenu hidden>
          <small>Doğru etiket nedir?</small>
          <div class="fix-menu">
            ${FIX_OPTIONS.map((k) => `<button type="button" data-fixto="${k}">${KIND_LABEL[k]}</button>`).join('')}
            <button type="button" class="cancel" data-fixcancel aria-label="Vazgeç">✕</button>
          </div>
        </div>
        <div class="d-done" data-done hidden></div>
        <ol class="log" data-log><li class="empty">Henüz kayıt yok.</li></ol>
      </div>
    </div>
    <footer class="proto-foot">
      <span>Karar: kural + ML · Metin: dil modeli yalnızca Türkçeye çevirir</span>
      <span>Simülasyon · R sıfırla</span>
    </footer>`;
  document.body.appendChild(el);

  const $ = (s) => el.querySelector(s);
  const q = {
    clock: $('[data-clock]'),
    alarms: $('[data-alarms]'),
    events: $('[data-events]'),
    records: $('[data-records]'),
    term: $('[data-term]'),
    dmain: $('[data-dmain]'),
    dconf: $('[data-dconf]'),
    dbar: $('[data-dbar]'),
    dev: $('[data-dev]'),
    drule: $('[data-drule]'),
    approve: $('[data-approve]'),
    fix: $('[data-fix]'),
    fixmenu: $('[data-fixmenu]'),
    log: $('[data-log]'),
    scen: [...el.querySelectorAll('[data-s]')],
  };

  q.scen.forEach((b) => b.addEventListener('click', () => handlers.onScenario(b.dataset.s)));
  const decisionEl = $('.decision');
  const doneEl = $('[data-done]');
  function openFix(open) {
    q.fixmenu.hidden = !open;
    decisionEl.classList.toggle('fixing', open);
    if (open) {
      // mevcut kararı soluk göster; odak ilk seçeneğe
      el.querySelectorAll('[data-fixto]').forEach((b) => b.classList.toggle('cur', b.dataset.fixto === currentKind));
      el.querySelector('[data-fixto]').focus({ preventScroll: true });
      q.fixmenu.scrollIntoView({ block: 'nearest' }); // kısa pencerede menü görünür alana gelsin
    }
  }
  q.approve.addEventListener('click', () => handlers.onApprove());
  q.fix.addEventListener('click', () => openFix(q.fixmenu.hidden));
  $('[data-fixcancel]').addEventListener('click', () => { openFix(false); q.fix.focus(); });
  el.querySelectorAll('[data-fixto]').forEach((b) =>
    b.addEventListener('click', () => { openFix(false); handlers.onCorrect(b.dataset.fixto); }),
  );

  // ---- Terminal ----
  const MAX_LINES = 40;
  const cell = (val, base, d, width, frozen) => {
    const txt = fmt(val, d).padStart(width);
    if (frozen) return `<span class="fz">${txt}</span>`;
    if (Math.abs(val - base) / base > 0.08) return `<span class="hi">${txt}</span>`;
    return txt;
  };
  function pushSample(s, frozenAlert) {
    const line = document.createElement('div');
    line.innerHTML =
      `${clock(s.time)}  ${cell(s.p, BASE.p, 2, 5, frozenAlert)} bar  ` +
      `${cell(s.q, BASE.q, 1, 5)} m³/h  ${cell(s.w, BASE.w, 2, 5)} kW`;
    q.term.appendChild(line);
    while (q.term.childElementCount > MAX_LINES) q.term.firstElementChild.remove();
  }
  function clearTerm() { q.term.innerHTML = ''; }

  // ---- Karar ----
  let lastKey = '';
  let currentKind = null;
  function setDecision(d) {
    currentKind = d.kind;
    const key = `${d.kind}|${d.title}|${d.sub}`;
    if (d.kind === 'analyzing') {
      if (lastKey !== 'analyzing') {
        q.dmain.className = 'd-main wait';
        q.dmain.textContent = 'Analiz ediliyor';
        q.dconf.textContent = 'güven —';
        q.dbar.style.width = '0%';
        q.dev.innerHTML = '';
        q.drule.textContent = 'Sinyaller normalden sapıyor; kurallar değerlendiriliyor.';
      }
      lastKey = 'analyzing';
      return;
    }
    if (key !== lastKey) {
      q.dmain.className = `d-main ${d.kind === 'normal' ? '' : 'event'}`;
      q.dmain.innerHTML = d.kind === 'normal'
        ? `${d.title}<span class="sub">${d.sub}</span>`
        : `Olay: ${d.title}<span class="sub">${d.sub}</span>`;
      lastKey = key;
    }
    q.dconf.textContent = `güven ${fmt(d.conf)}`;
    q.dbar.style.width = `${Math.round(d.conf * 100)}%`;
    q.dev.innerHTML = d.evidence.map((e) => `<li>${e}</li>`).join('');
    q.drule.textContent = d.rule;
  }

  // done: { text, fixed } → butonların yerine "kayda geçti" şeridi
  let doneShown = null;
  function setActions({ approve, fix, done }) {
    q.approve.disabled = !approve;
    q.fix.disabled = !fix;
    if (!fix && !q.fixmenu.hidden) openFix(false);
    const key = done ? done.text : null;
    if (key === doneShown) return;
    doneShown = key;
    decisionEl.classList.toggle('done', !!done);
    doneEl.hidden = !done;
    if (done) {
      doneEl.textContent = done.text;
      doneEl.classList.toggle('fixd', !!done.fixed);
      doneEl.scrollIntoView({ block: 'nearest' });
      if (doneEl.animate) doneEl.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'ease-out' });
    }
  }

  function setScenario(id) {
    q.scen.forEach((b) => b.classList.toggle('on', b.dataset.s === id));
  }

  function setCounters({ alarms, events, records }) {
    if (alarms != null) q.alarms.textContent = alarms;
    if (events != null) q.events.textContent = events;
    if (records != null && q.records.textContent !== String(records)) {
      q.records.textContent = records;
      q.records.classList.remove('flash');
      void q.records.offsetWidth; // animasyonu yeniden başlat
      q.records.classList.add('flash');
    }
  }

  function addLog(html, cls = '') {
    q.log.querySelector('.empty')?.remove();
    const li = document.createElement('li');
    li.className = cls;
    li.innerHTML = html;
    q.log.prepend(li);
    while (q.log.childElementCount > 6) q.log.lastElementChild.remove();
  }
  function clearLog() { q.log.innerHTML = '<li class="empty">Henüz kayıt yok.</li>'; }

  return {
    el,
    q,
    pushSample,
    clearTerm,
    setDecision,
    setActions,
    setScenario,
    setCounters,
    addLog,
    clearLog,
    setClock: (t) => { q.clock.textContent = clock(t); },
    resetDecision: () => { lastKey = ''; },
  };
}
