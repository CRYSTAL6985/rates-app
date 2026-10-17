export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Spring with Apple's two knobs: response (seconds) and damping ratio. Starts from the live value, carries velocity.
export function spring({ from, to, velocity = 0, response = .4, damping = 1, eps = .001, onUpdate, onDone }) {
  if (reduce) { onUpdate(to); onDone && onDone(); return { stop() {}, velocity: 0 }; }
  const w = 2 * Math.PI / response, k = w * w, c = 2 * damping * w;
  let x = from, v = velocity, last = performance.now(), id = 0;
  const step = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const n = Math.max(1, Math.ceil(dt / .002)), h = dt / n;
    for (let i = 0; i < n; i++) { const a = -k * (x - to) - c * v; v += a * h; x += v * h; }
    if (Math.abs(x - to) < eps && Math.abs(v) < eps * 20) { x = to; v = 0; onUpdate(x); onDone && onDone(); return; }
    onUpdate(x); id = requestAnimationFrame(step);
  };
  id = requestAnimationFrame(step);
  return { stop() { cancelAnimationFrame(id); }, get velocity() { return v; } };
}

// Where a flick would come to rest, and the rubber band past an edge.
export const project = (v, d = .998) => (v / 1000) * d / (1 - d);
export const rubber = (o, dim, c = .55) => (o * dim * c) / (dim + c * Math.abs(o));

export const settle = el => !reduce && el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });

export function flash(el, dir) {
  if (!dir) return;
  el.classList.remove('fu', 'fd'); void el.offsetWidth; el.classList.add(dir > 0 ? 'fu' : 'fd');
}
