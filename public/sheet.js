import { state, bus, series } from './app.js';
import { Chart, Seg } from './chart.js';
import { norm } from './series.js';
import { spring, project, rubber, flash } from './motion.js';
import { formatPrice, parseNum, tomanPer, nf } from './format.js';
import { RANGES, RANGE_KEYS, iconHTML, subText, chartColor, writeValue } from './ui.js';

const $ = id => document.getElementById(id);
const sheet = $('sheet'), scrim = $('scrim'), screen = $('screen'), sBody = $('sBody');
let sheetKey = null, sheetRange = 0, sheetSeries = [], sheetY = 0, sheetH = 0, sheetSp = null;

const item = () => state.items.get(sheetKey);
const quote = () => state.quotes.get(sheetKey);
const sheetSvg = $('sChart');
const sheetChart = Chart(sheetSvg, Math.min(innerWidth, 560) - 32, 170,
  i => writeValue(item(), quote(), sheetSeries, sheetRange, i, $('sPrice'), $('sChange')));
const sheetSeg = Seg($('sSeg'), RANGES, i => { sheetRange = i; renderChart(true); });

async function renderChart(animate) {
  const key = sheetKey, range = sheetRange;
  const s = await series(key, RANGE_KEYS[range]);
  if (key !== sheetKey || range !== sheetRange) return;
  sheetSeries = s;
  chartColor(sheetSvg, s);
  if (sheetChart.scrubbing) return;
  sheetChart.set(norm(s.map(p => p.price)), animate);
  writeValue(item(), quote(), s, range, null, $('sPrice'), $('sChange'));
}

function renderStats() {
  const it = item(), q = quote();
  const hasBuySell = q?.buy != null && q?.sell != null;
  $('sStats').classList.toggle('no-bs', !hasBuySell);
  if (hasBuySell) { $('sBuy').textContent = formatPrice(it, q.buy); $('sSell').textContent = formatPrice(it, q.sell); }
  $('sHigh').textContent = q ? formatPrice(it, q.high) : '—';
  $('sLow').textContent = q ? formatPrice(it, q.low) : '—';
}

// ---------- open / close ----------
function setSheet(y) {
  sheetY = y; sheet.style.transform = `translateY(${y}px)`;
  const p = Math.max(0, Math.min(1, 1 - y / sheetH));
  scrim.style.opacity = .35 * p;
  screen.style.transform = p ? `translateY(${10 * p}px) scale(${1 - .07 * p})` : '';
}
function animateSheet(to, velocity, opts, done) {
  sheetSp && sheetSp.stop();
  sheetSp = spring({ from: sheetY, to, velocity, eps: .5, ...opts, onUpdate: setSheet, onDone: () => { sheetSp = null; done && done(); } });
}

export function openSheet(id) {
  sheetKey = id;
  const it = item(), q = quote();
  $('sIcon').innerHTML = iconHTML(it, 'lg'); $('sName').textContent = it.name; $('sSub').textContent = subText(it, q);
  sheetRange = 0; sheetSeg.select(0, false); sBody.scrollTop = 0;
  sheetSeries = [];
  writeValue(it, q, [], 0, null, $('sPrice'), $('sChange'));
  sheetChart.set([], false);
  renderChart(false);
  renderStats();
  $('cAU').textContent = it.tab === 'fx' || it.tab === 'crypto' ? it.sub : it.unit === 'usd' ? 'انس' : it.metal === 'coin' ? 'عدد' : 'گرم';
  $('cA').value = '۱'; convFromA();
  sheet.style.visibility = 'visible'; scrim.classList.add('open');
  sheetH = sheet.offsetHeight;
  setSheet(sheetH);
  sheetSeg.place();
  animateSheet(0, 0, { response: .42, damping: 1 });
  $('sClose').focus({ preventScroll: true });
}

export function closeSheet(v = 0) {
  scrim.classList.remove('open');
  animateSheet(sheetH, v, { response: .4, damping: 1 }, () => { sheet.style.visibility = 'hidden'; sheetKey = null; screen.style.transform = ''; });
}

bus.addEventListener('open', e => openSheet(e.detail));
$('sClose').addEventListener('click', () => closeSheet());
scrim.addEventListener('click', () => closeSheet());
addEventListener('keydown', e => { if (e.key === 'Escape' && sheetKey) closeSheet(); });

// drag: 1:1 tracking, grab mid-flight, velocity handoff, momentum projection, rubber band past the top
let drag = null;
sheet.addEventListener('pointerdown', e => {
  if (!sheetKey || e.target.closest('input,button,svg.chart,.seg')) return;
  const caught = !!sheetSp; sheetSp && sheetSp.stop(); sheetSp = null;
  drag = { id: e.pointerId, y0: e.clientY, base: sheetY, active: caught, hist: [{ t: e.timeStamp, y: e.clientY }], fromTop: !!e.target.closest('.sh-top') };
  if (caught) sheet.setPointerCapture(e.pointerId);
});
sheet.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dy = e.clientY - drag.y0;
  if (!drag.active) {
    if (Math.abs(dy) < 8) return;
    if (!drag.fromTop && (dy < 0 || sBody.scrollTop > 0)) { drag = null; return; }   // let the content scroll
    drag.active = true; drag.y0 = e.clientY; drag.base = sheetY; sheet.setPointerCapture(e.pointerId);
  }
  const raw = drag.base + (e.clientY - drag.y0);
  setSheet(raw < 0 ? -rubber(-raw, sheetH) : raw);
  drag.hist.push({ t: e.timeStamp, y: e.clientY }); if (drag.hist.length > 6) drag.hist.shift();
});
function release(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (!d.active) { if (sheetY > .5) animateSheet(0, 0, { response: .4, damping: 1 }); return; }
  const h = d.hist.filter(p => e.timeStamp - p.t < 100), f = h[0], l = h[h.length - 1];
  const v = f && l && l.t > f.t ? (l.y - f.y) / (l.t - f.t) * 1000 : 0;
  if (sheetY + project(v) > sheetH * .45) closeSheet(v);
  else animateSheet(0, v, { response: .33, damping: .82 });   // a little bounce only because a throw preceded it
}
sheet.addEventListener('pointerup', release);
sheet.addEventListener('pointercancel', release);

// ---------- calculator ----------
const per = () => tomanPer(item(), quote(), state.quotes.get('usd'));
function convFromA() {
  const n = parseNum($('cA').value), t = n * per();
  $('cT').value = Number.isFinite(t) ? nf.format(Math.round(t)) : '';
}
function convFromT() {
  const n = parseNum($('cT').value), a = n / per();
  $('cA').value = Number.isFinite(a) ? new Intl.NumberFormat('fa-IR', { maximumFractionDigits: item().tab === 'crypto' ? 6 : 3 }).format(a) : '';
}
$('cA').addEventListener('input', convFromA);
$('cT').addEventListener('input', convFromT);

// ---------- live data ----------
bus.addEventListener('quotes', e => {
  if (!sheetKey) return;
  const dir = e.detail.get(sheetKey);
  if (!dir) return;
  renderStats();
  if (!sheetChart.scrubbing) { renderChart(false); flash($('sPrice'), dir); }
  if (document.activeElement !== $('cT')) convFromA();
});
