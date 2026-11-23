import gsap from 'gsap';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Etiketler gruplara kayıtlı tutulur ("station", "fx" ...) ki sahne bazında
// yalnızca istasyon etiketleri gizlenip efekt etiketleri görünür kalabilsin.
const groups = new Map();

// Teknik etiket ("PT-101" gibi). userData.tag → içteki <span>.
export function makeTag(text, cls = '', group = 'station', html = false) {
  const anchor = document.createElement('div');
  anchor.className = 'tag-anchor';
  const tag = document.createElement('span');
  tag.className = `tag ${cls}`.trim();
  if (html) tag.innerHTML = text;
  else tag.textContent = text;
  anchor.appendChild(tag);
  const obj = new CSS2DObject(anchor);
  obj.userData.tag = tag;
  obj.userData.base = text;
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(anchor);
  return obj;
}

export function setTagGroup(group, on, duration = 0.6) {
  const els = groups.get(group);
  if (!els) return;
  gsap.to(els, { opacity: on ? 1 : 0, duration, overwrite: 'auto' });
}
