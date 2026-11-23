import gsap from 'gsap';

// Sahne metni: köşede kicker + başlık + 1-3 satır (+ not / liste / özel HTML).
export function createCaption(root) {
  let current = null;

  function build(scene, index) {
    const el = document.createElement('section');
    el.className = `caption corner-${scene.corner || 'bl'}`;
    const num = String(index + 1).padStart(2, '0');
    let html = '';
    html += `<div class="kicker"><span class="num">${num}</span><span>${scene.kicker || ''}</span></div>`;
    if (scene.title) html += `<h1 class="${scene.titleSize || ''}">${scene.title}</h1>`;
    for (const l of scene.lines || []) html += `<p class="${l.mono ? 'mono' : ''}">${l.text ?? l}</p>`;
    if (scene.html) html += `<div class="extra">${scene.html}</div>`;
    if (scene.note) html += `<small class="note">${scene.note}</small>`;
    el.innerHTML = html;
    return el;
  }

  function show(scene, index, { instant = false } = {}) {
    const old = current;
    const el = build(scene, index);
    root.appendChild(el);
    current = el;
    if (old) {
      gsap.to(old, { autoAlpha: 0, y: -10, duration: 0.35, ease: 'power2.in', onComplete: () => old.remove() });
    }
    gsap.fromTo(
      el.children,
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.75, stagger: 0.08, delay: instant ? 0.1 : 0.9, ease: 'power3.out' },
    );
    return el;
  }

  return { show, get el() { return current; } };
}
