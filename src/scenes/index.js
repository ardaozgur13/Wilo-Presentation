// Her sahne: kamera noktası, metin, dünya durumu ve (isteğe bağlı) adımlar/kancalar.
//
//  cam    : { pos, target, shift (-0.5..0.5 ekran kaydırma), fov, duration }
//  world  : { night 0..1, chaos 0..1, ordered bool, edge bool, labels bool }
//  steps  : sahne içi adım sayısı (→ önce adımları ilerletir, sonra sahneyi)
//  effect : (ctx) => { enter, exit, step? }  — 3D efekt fabrikası (ilk girişte bir kez kurulur)
//  enter(ctx, {instant}) / exit(ctx) / step(ctx, i) / update(ctx, dt, t)

import { createAlarms } from './fx/alarms.js';
import { createRawData } from './fx/rawdata.js';
import { createScan } from './fx/scan.js';
import { createStops } from './fx/stops.js';
import { createFormula } from './fx/formula.js';
import { createMap } from './fx/map.js';
import { createUplink } from './fx/uplink.js';
import { createPrototype } from '../prototype/index.js';

const OPENING_CAM = { pos: [17, 11.5, 21], target: [-0.8, 1.2, 0], shift: -0.06 };

const STOPS = [
  ['Anlamlandırma', 'Ad değil fizik: sinyalin ne olduğu, birimi ve çarpanı bulunur.'],
  ['Güven', 'Hidrolik ve elektrik verisi çapraz kontrol edilir, güven puanı verilir.'],
  ['Teşhis', 'Kural ve ML karar verir; dil modeli sadece Türkçeye çevirir.'],
  ['Uzman onayı', 'Kritik öneriyi mühendis onaylar, kayda geçer.'],
];

export const SCENES = [
  {
    id: 'acilis',
    corner: 'bl',
    kicker: '<span lang="en">Concordia</span> · Water AI Hackathon 2026',
    title: 'Burble',
    titleSize: 'xl',
    lines: ['Su tesislerinin verisini yapay zekânın güvenebileceği veriye çeviriyoruz.'],
    cam: { ...OPENING_CAM, duration: 3.6 },
    world: { chaos: 0.12 },
  },
  {
    id: 'gece',
    corner: 'tl',
    kicker: 'Senaryo',
    title: 'Gece 03.00. <span class="alarm-count">40</span> alarm.',
    lines: ['Hangisi gerçek?'],
    note: 'Temsilî senaryo.',
    cam: { pos: [15, 17, 20], target: [-1, 2.6, 0], shift: -0.04 },
    world: { night: 1, chaos: 0.35 },
    effect: createAlarms,
  },
  {
    id: 'adsiz',
    corner: 'bl',
    kicker: 'Sorun',
    title: 'Veri var, anlamı yok.',
    lines: ['4250: 42,5 m³/saat mi, 4,25 bar mı?'],
    cam: { pos: [10.2, 3.0, 10.4], target: [6.2, 1.9, 3.0], shift: -0.14 },
    world: { chaos: 1 },
    effect: createRawData,
  },
  {
    id: 'burble',
    corner: 'tl',
    kicker: 'Burble devreye girer',
    title: 'Sadece okur.',
    lines: ['Hiçbir cihaza dokunmaz.'],
    cam: { pos: [19, 10, 16], target: [1.2, 1.2, 0.2], shift: 0.04 },
    world: { chaos: 1 }, // Edge'i ve hizalanmayı tarama dalgası açar
    effect: createScan,
  },
  {
    id: 'dort-adim',
    corner: 'tl',
    kicker: 'Nasıl çalışır',
    title: 'Dört adım',
    steps: 5,
    html: `<ul class="list steps">${STOPS.map(
      ([t, d], i) => `<li data-i="${i + 1}"><span class="k">${i + 1}</span><div>${t}<small>${d}</small></div></li>`,
    ).join('')}</ul><div class="loop-line">↻ Her onay bir sonraki öneriyi iyileştirir.</div>`,
    cam: {
      pos: [4, 11, 28], target: [2, 0.6, 7.5], shift: -0.15,
      // dikey telefonda liste üstte; duraklar alt yarıda
      portrait: { pos: [2, 12, 26], target: [2, 0.6, 8.4], shift: 0, shiftY: -0.22 },
    },
    world: { ordered: true, edge: true },
    effect: createStops,
    step(ctx, i) {
      const el = ctx.caption.el;
      if (!el) return;
      el.querySelectorAll('li').forEach((li) => {
        const n = +li.dataset.i;
        li.classList.toggle('on', n <= i);
        li.classList.toggle('current', n === Math.min(i, 4));
      });
      el.querySelector('.loop-line').classList.toggle('on', i >= 5);
    },
  },
  {
    id: 'fizik',
    corner: 'br',
    kicker: 'Fizik konuşur',
    title: 'Fizik konuşur.',
    titleSize: 'm',
    effect: createFormula,
    html: `<ul class="list">
      <li><span class="k">→</span><div>Basınç ve debi değişti, motor gücü aynı<small>sensör arızası</small></div></li>
      <li><span class="k">→</span><div>Basınç düştü, debi arttı, güç yükseldi<small>gerçek kaçak</small></div></li>
      <li><span class="k">→</span><div>Basınç yükseldi, debi düştü, akım yüksek<small>kısık vana</small></div></li>
    </ul>`,
    cam: { pos: [-3, 6.2, 14], target: [1.2, 2.2, 0.4], shift: 0.18 },
    world: { ordered: true, edge: true },
  },
  {
    id: 'prototip',
    corner: 'tl',
    kicker: 'Canlı prototip',
    title: 'Deneyin.',
    titleSize: 'm',
    lines: ['Bir senaryo seçin; Burble\'ın kararını onaylayın ya da düzeltin.'],
    interactive: true,
    cam: {
      pos: [7.4, 14.2, 26.2], target: [2.6, 1, 1.6], shift: 0.25,
      // dar ekranda panel alt yarıda: istasyon üst bölgede, ortalanmış
      narrow: { pos: [5, 13, 24], target: [1.5, 1, 1], shift: 0, shiftY: 0.24 },
    },
    world: { ordered: true, edge: true },
    effect: createPrototype,
  },
  {
    id: 'onem',
    corner: 'bl',
    kicker: 'Neden önemli',
    title: 'Fark edilme süresi: saatlerden dakikalara.',
    lines: ['Mahalle · Operatör · Şehir · Wilo'],
    note: 'Göstergeler pilotta ölçülecek.',
    cam: { pos: [46, 95, 80], target: [6, 0, -18], fov: 32, duration: 3.2 },
    world: { ordered: true, edge: true, labels: false },
    effect: createMap,
  },
  {
    id: 'guvenlik',
    corner: 'bl',
    kicker: 'Güvenlik',
    title: 'Tesise dokunmaz.',
    titleSize: 'm',
    html: `<ul class="list">
      <li><span class="k">01</span><div>Sadece okur</div></li>
      <li><span class="k">02</span><div>Açık port yok</div></li>
      <li><span class="k">03</span><div>Tek yönlü şifreli bağlantı <span style="font-family:var(--f-mono);font-size:.85em">(MQTT/TLS)</span></div></li>
      <li><span class="k">04</span><div>Çökse bile tesis aynen çalışır</div></li>
    </ul>`,
    cam: { pos: [12, 3.8, 10.5], target: [7.4, 2.5, 2.6], shift: -0.2 },
    world: { ordered: true, edge: true, labels: false },
    effect: createUplink,
  },
  {
    id: 'kapanis',
    corner: 'bl',
    kicker: 'Water AI Hackathon 2026',
    title: 'Burble — Concordia',
    titleSize: 'm',
    html: `<div class="team">
      <div><b>Arda Özgür</b></div>
      <div><b>Ali Talha Gezgin</b></div>
      <div><b>Süleyman Yiğit Demircan</b></div>
      <div><b>Mert Giray Yalçın</b></div>
    </div>`,
    cam: { ...OPENING_CAM, duration: 3.2 },
    world: { ordered: true, edge: true },
  },
];
