import { state, bus, series } from './app.js';
import { Chart, Seg } from './chart.js';
import { norm } from './series.js';
import { spring, settle, flash } from './motion.js';
import { formatPrice, formatPct, nf, ago, jalaliToday } from './format.js';
import { RANGES, RANGE_KEYS, dirCls, arrow, unitText, iconHTML, subText, agoHTML, chartColor, writeValue } from './ui.js';
import { loadFavs, saveFavs, toggleFav } from './favs.js';
import { toast } from './alerts.js';
import { shareWithAndroid } from './native.js';

const $ = id => document.getElementById(id);
const CATS = [
  { label: 'ارز', tab: 'fx' },
  { label: 'رمزارز', tab: 'crypto' },
  { label: 'طلا و سکه', tab: 'gold', foot: 'حباب یعنی قیمت سکه چقدر از ارزش طلای داخلش بیشتر است.' },
  { label: 'نقره', tab: 'silver' },
];
const SPARK_W = 46, SPARK_H = 24;

// Tapping a row asks the sheet to open; home doesn't know about the sheet.
const openItem = id => bus.dispatchEvent(new CustomEvent('open', { detail: id }));

// ---------- hero ----------
let heroKey = null, heroRange = 0, heroSeries = [];
const heroSvg = $('hChart');
const heroChart = Chart(heroSvg, heroSvg.getBoundingClientRect().width || 326, 140,
  i => writeValue(state.items.get(heroKey), state.quotes.get(heroKey), heroSeries, heroRange, i, $('hPrice'), $('hChange')));

async function renderHero(animate) {
  const key = heroKey, range = heroRange, item = state.items.get(key), quote = state.quotes.get(key);
  $('hName').textContent = item.name;
  $('hUnit').textContent = subText(item, quote) + ' · ' + unitText(item);
  $('hIcon').innerHTML = iconHTML(item, 'lg');
  writeValue(item, quote, heroSeries.length && !animate ? heroSeries : [], range, null, $('hPrice'), $('hChange'));
  const s = await series(key, RANGE_KEYS[range]);
  if (key !== heroKey || range !== heroRange) return;
  heroSeries = s;
  chartColor(heroSvg, s);
  if (!heroChart.scrubbing) {
    heroChart.set(norm(s.map(p => p.price)), animate);
    writeValue(item, quote, s, range, null, $('hPrice'), $('hChange'));
  }
}
Seg($('hSeg'), RANGES, i => { heroRange = i; renderHero(true); });

function chipInner(item, q) {
  return `<span class="c-top">${iconHTML(item, 'sm')}<span class="c-name">${item.short ?? item.name}</span></span><b class="c-price">${q ? formatPrice(item, q.price, true) : '—'}</b><span class="c-ch ${dirCls(q?.changePct)}">${arrow(q?.changePct)} ${q ? formatPct(q.changePct) : ''}</span>`;
}
function renderChips() {
  $('top3').innerHTML = favs.map(k => `<button class="chip" data-chip="${k}" aria-pressed="${k === heroKey}">${chipInner(state.items.get(k), state.quotes.get(k))}</button>`).join('')
    + '<button class="chip add" aria-label="افزودن قیمت">+ افزودن</button>';
}
$('top3').addEventListener('click', e => {
  if (e.target.closest('.add')) { renderFavPanel(); $('favDlg').showModal(); return; }
  const b = e.target.closest('.chip'); if (!b || b.dataset.chip === heroKey) return;
  heroKey = b.dataset.chip;
  $('top3').querySelectorAll('.chip[data-chip]').forEach(c => c.setAttribute('aria-pressed', c === b));
  renderHero(true); settle($('hPrice')); settle($('hName'));
});

// ---------- favourites ----------
// The top row. Starred anywhere (list rows or the add panel), saved on this device only.
let favs = [];
const storage = () => { try { return localStorage; } catch { return null; } };
const starHTML = (item, on) => `<button class="star" data-star="${item.id}" aria-pressed="${on}" aria-label="نشان کردن ${item.name}"></button>`;

function toggleStar(id) {
  const next = toggleFav(favs, id);
  // The toast would sit under the open panel, so the panel says it itself.
  const note = $('favDlg').open ? text => { $('favNote').textContent = text; } : toast;
  if (next === favs) { note('دست‌کم یک قیمت باید بالای صفحه بماند.'); return; }
  $('favNote').textContent = '';
  favs = next;
  saveFavs(storage(), favs);
  shareWithAndroid('favs', JSON.stringify(favs));
  document.querySelectorAll(`[data-star="${id}"]`).forEach(b => b.setAttribute('aria-pressed', favs.includes(id)));
  if (!favs.includes(heroKey)) { heroKey = favs[0]; renderHero(true); }
  renderChips();
}

function renderFavPanel() {
  $('favNote').textContent = '';
  $('favList').innerHTML = CATS.map(c => {
    const rows = [...state.items.values()].filter(i => i.tab === c.tab).map(item =>
      `<button class="frow" data-star="${item.id}" aria-pressed="${favs.includes(item.id)}">${iconHTML(item, 'sm')}<span class="f-name">${item.name}</span><span class="star" aria-hidden="true"></span></button>`);
    return `<div class="f-sec">${c.label}</div><div class="fgroup">${rows.join('')}</div>`;
  }).join('');
}
$('favList').addEventListener('click', e => {
  const b = e.target.closest('[data-star]'); if (b) toggleStar(b.dataset.star);
});

// ---------- list ----------
let pillMode = 'pct', cat = 0;
function pillText(item, q) {
  if (!q) return '—';
  const s = q.changePct > 0 ? '+' : q.changePct < 0 ? '−' : '';
  return pillMode === 'pct' ? s + formatPct(q.changePct) : s + formatPrice(item, Math.abs(q.change), true);
}
const sparkPts = prices => norm(prices).map((v, i) => (i * SPARK_W / (prices.length - 1)).toFixed(1) + ',' + (2 + (1 - v) * (SPARK_H - 4)).toFixed(1)).join(' ');
const smallHTML = (item, q) => {
  const sub = subText(item, q);
  return (sub ? sub + ' · ' : '') + agoHTML(q);
};

function rowHTML(id) {
  const item = state.items.get(id), q = state.quotes.get(id), c = dirCls(q?.changePct);
  return `<div class="row" role="button" tabindex="0" data-key="${id}">${starHTML(item, favs.includes(id))}${iconHTML(item)}
    <span class="nm"><b>${item.name}</b><small>${smallHTML(item, q)}</small></span>
    <svg class="spark ${c}" viewBox="0 0 ${SPARK_W} ${SPARK_H}" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
    <span class="pr"><b class="price">${q ? formatPrice(item, q.price, true) : '—'}</b><span class="pill ${c}" data-pill="${id}">${pillText(item, q)}</span></span></div>`;
}

async function drawSpark(id) {
  const s = await series(id, 'day');
  const line = document.querySelector(`.row[data-key="${id}"] .spark polyline`);
  if (line && s.length) line.setAttribute('points', sparkPts(s.map(p => p.price)));
}

function renderList() {
  const c = CATS[cat], ids = [...state.items.values()].filter(i => i.tab === c.tab).map(i => i.id);
  $('list').innerHTML = `<div class="group">${ids.map(rowHTML).join('')}</div>`;
  $('foot').textContent = c.foot || '';
  ids.forEach(drawSpark);
}

let listSp = null;
Seg($('catSeg'), CATS.map(c => c.label), (i, prev) => {
  cat = i; renderList();
  const start = -28 * Math.sign(i - prev), lw = $('listwrap');   // RTL: later tabs sit to the left, so content arrives from the left
  listSp && listSp.stop();
  listSp = spring({ from: 0, to: 1, response: .38, damping: 1, onUpdate: t => { lw.style.transform = `translateX(${start * (1 - t)}px)`; lw.style.opacity = Math.min(1, .15 + t); } });
});
$('list').addEventListener('click', e => {
  const star = e.target.closest('[data-star]');
  if (star) { toggleStar(star.dataset.star); return; }
  if (e.target.closest('.pill')) {
    pillMode = pillMode === 'pct' ? 'toman' : 'pct';
    document.querySelectorAll('[data-pill]').forEach(p => p.textContent = pillText(state.items.get(p.dataset.pill), state.quotes.get(p.dataset.pill)));
    return;
  }
  const row = e.target.closest('.row'); if (row) openItem(row.dataset.key);
});
$('list').addEventListener('keydown', e => {
  const row = e.target.closest('.row');
  // Only the row itself: Enter on its star button must not also open the sheet.
  if (row && e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openItem(row.dataset.key); }
});

function updateRow(id, dir) {
  const row = document.querySelector(`.row[data-key="${id}"]`); if (!row) return;
  const item = state.items.get(id), q = state.quotes.get(id), c = dirCls(q.changePct);
  const p = row.querySelector('.price'); p.textContent = formatPrice(item, q.price, true); flash(p, dir);
  const pill = row.querySelector('.pill'); pill.className = 'pill ' + c; pill.textContent = pillText(item, q);
  row.querySelector('.spark').setAttribute('class', 'spark ' + c);
  row.querySelector('.nm small').innerHTML = smallHTML(item, q);
}

// ---------- status line ----------
function renderStatus() {
  $('liveDot').classList.toggle('off', !state.online);
  $('ago').textContent = state.online ? ago(state.lastLoad) : 'اتصال برقرار نیست';
  document.querySelectorAll('.row').forEach(row => {
    const id = row.dataset.key;
    row.querySelector('.nm small').innerHTML = smallHTML(state.items.get(id), state.quotes.get(id));
  });
}

// ---------- scroll chrome ----------
const screen = $('screen');
screen.addEventListener('scroll', () => {
  $('nav').classList.toggle('compact', screen.scrollTop > 44);
  const navH = $('nav').offsetHeight;
  const top = $('segwrap').getBoundingClientRect().top - screen.getBoundingClientRect().top;
  $('segwrap').classList.toggle('stuck', top <= navH + .5);
}, { passive: true });

// ---------- live data ----------
let first = true;
bus.addEventListener('quotes', e => {
  if (first) {
    first = false;
    favs = loadFavs(storage(), state.top, new Set(state.items.keys()));
    heroKey = favs[0];
    shareWithAndroid('favs', JSON.stringify(favs));
    renderChips(); renderList(); renderHero(false); renderStatus();
    return;
  }
  renderChips();
  for (const [id, dir] of e.detail) updateRow(id, dir);
  if (e.detail.get(heroKey)) { renderHero(false); flash($('hPrice'), e.detail.get(heroKey)); }
  renderStatus();
});
bus.addEventListener('offline', renderStatus);
setInterval(renderStatus, 30_000);

$('today').textContent = jalaliToday();
