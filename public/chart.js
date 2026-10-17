import { spring } from './motion.js';
import { N } from './series.js';

export function Chart(svg, W, H, onScrub) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const gid = 'g' + Math.random().toString(36).slice(2);
  svg.innerHTML = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    <path class="area" fill="url(#${gid})"/><path class="line" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <line class="scrub-line" y1="0" y2="${H}"/><circle class="scrub-dot" r="5"/>`;
  const area = svg.querySelector('.area'), line = svg.querySelector('.line'), sl = svg.querySelector('.scrub-line'), dot = svg.querySelector('.scrub-dot');
  const PAD = 8, X = i => i * W / (N - 1), Y = v => PAD + (1 - v) * (H - 2 * PAD);
  let ys = null, anim = null, idx = null;
  function draw(arr) {
    ys = arr; let d = '';
    arr.forEach((v, i) => d += (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1));
    line.setAttribute('d', d); area.setAttribute('d', arr.length ? d + `L${W},${H}L0,${H}Z` : '');
    if (idx != null && ys.length) placeDot();
  }
  function placeDot() { const px = X(idx); sl.setAttribute('x1', px); sl.setAttribute('x2', px); dot.setAttribute('cx', px); dot.setAttribute('cy', Y(ys[idx])); }
  function move(e) {
    if (!ys || !ys.length) return;
    const r = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(N - 1, Math.round((e.clientX - r.left) / r.width * (N - 1))));
    if (i === idx) return; idx = i; placeDot(); onScrub(i);
  }
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); svg.classList.add('scrubbing'); idx = null; move(e); });
  svg.addEventListener('pointermove', e => { if (svg.classList.contains('scrubbing')) move(e); });
  const end = () => { if (!svg.classList.contains('scrubbing')) return; svg.classList.remove('scrubbing'); idx = null; onScrub(null); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  return {
    set(arr, animate) {
      anim && anim.stop();
      if (!ys || !ys.length || !arr.length || !animate) return draw(arr);
      const from = ys.slice();
      anim = spring({ from: 0, to: 1, response: .5, damping: 1, onUpdate: t => draw(from.map((f, i) => f + (arr[i] - f) * t)) });
    },
    get scrubbing() { return idx != null; },
  };
}

export function Seg(el, labels, onChange) {
  el.innerHTML = '<span class="thumb"></span>' + labels.map((l, i) => `<button role="tab" aria-selected="${i === 0}">${l}</button>`).join('');
  const thumb = el.querySelector('.thumb'), btns = [...el.querySelectorAll('button')];
  let cur = 0, x = 0, sp = null;
  const paint = v => { x = v; thumb.style.transform = `translateX(${v}px)`; };
  const place = () => { sp && sp.stop(); thumb.style.width = btns[cur].offsetWidth + 'px'; paint(btns[cur].offsetLeft); };
  function select(i, animate) {
    if (i === cur) return;
    const prev = cur; cur = i;
    btns.forEach((b, j) => b.setAttribute('aria-selected', j === i));
    if (!animate) return place();
    const v0 = sp ? sp.velocity : 0; sp && sp.stop();
    sp = spring({ from: x, to: btns[i].offsetLeft, velocity: v0, response: .32, damping: 1, eps: .3, onUpdate: paint });
    return prev;
  }
  btns.forEach((b, i) => b.addEventListener('click', () => {
    if (i === cur) return;
    const prev = select(i, true); navigator.vibrate && navigator.vibrate(6); onChange(i, prev);
  }));
  addEventListener('resize', place); document.fonts && document.fonts.ready.then(place); place();
  return { select, place };
}
