import { formatPrice, formatPct, ago } from './format.js';

export const RANGES = ['روز', 'هفته', 'ماه', 'سال'];
export const RANGE_KEYS = ['day', 'week', 'month', 'year'];
const RANGE_TXT = ['امروز', 'در هفتهٔ گذشته', 'در ماه گذشته', 'در سال گذشته'];
const TFMT = [
  { hour: '2-digit', minute: '2-digit' },
  { weekday: 'long', hour: '2-digit', minute: '2-digit' },
  { day: 'numeric', month: 'long' },
  { day: 'numeric', month: 'long', year: 'numeric' },
].map(o => new Intl.DateTimeFormat('fa-IR-u-ca-persian', o));
// Older than this, the age is shown in red.
const STALE_MS = 6 * 3600e3;

export const dirCls = v => (v > 0 ? 'up' : v < 0 ? 'dn' : 'flat');
export const arrow = v => (v > 0 ? '▲' : v < 0 ? '▼' : '–');
export const unitText = item => (item.unit === 'usd' ? 'دلار' : 'تومان');

const METAL = {
  gold: ['radial-gradient(circle at 32% 28%,#fff1c1,#e2b13c 55%,#a87a17)', '#4a3300'],
  coin: ['radial-gradient(circle at 32% 28%,#fff1c1,#e2b13c 55%,#a87a17)', '#4a3300'],
  silver: ['radial-gradient(circle at 32% 28%,#ffffff,#cfd3d8 55%,#8a9099)', '#2b2f35'],
};

export function iconHTML(item, cls = '') {
  let style, inner;
  if (item.flag) { inner = item.flag; style = 'background:var(--fill2)'; }
  else if (item.sym) { inner = item.sym; style = `background:${item.bg};color:#fff;font-size:18px;font-family:system-ui`; }
  else {
    const [bg, fg] = METAL[item.metal]; inner = item.glyph;
    style = `background:${bg};color:${fg};font-size:${item.glyph.length > 2 ? 11 : 14}px` +
      (item.metal === 'coin' ? ';box-shadow:inset 0 0 0 2.5px rgba(255,255,255,.55),inset 0 0 0 4px rgba(120,80,0,.2)' : '');
  }
  return `<span class="ic ${cls}" style="${style}" aria-hidden="true">${inner}</span>`;
}

export const subText = (item, quote) =>
  quote?.bubblePct != null ? 'حباب ' + formatPct(quote.bubblePct) : item.sub ?? '';

export function agoHTML(quote, now = Date.now()) {
  if (!quote) return '';
  const stale = now - quote.updatedAt > STALE_MS;
  return `<span class="ago${stale ? ' stale' : ''}">${ago(quote.updatedAt, now)}</span>`;
}

export const chartColor = (svg, series) =>
  (svg.style.color = !series.length || series.at(-1).price >= series[0].price ? 'var(--green)' : 'var(--red)');

// Big price + change line. `i` is the scrubbed index, or null for "now".
export function writeValue(item, quote, series, r, i, priceEl, changeEl) {
  if (i == null || !series.length) {
    priceEl.textContent = quote ? formatPrice(item, quote.price) : '—';
    if (series.length < 2) { changeEl.innerHTML = '<span class="muted">هنوز نمودار کافی نیست</span>'; return; }
    const first = series[0].price, diff = series.at(-1).price - first;
    changeEl.innerHTML = `<span class="${dirCls(diff)}">${arrow(diff)} ${formatPrice(item, Math.abs(diff))} (${formatPct(diff / first * 100)})</span> <span class="muted">${RANGE_TXT[r]}</span>`;
  } else {
    priceEl.textContent = formatPrice(item, series[i].price);
    changeEl.innerHTML = `<span class="muted">${TFMT[r].format(new Date(series[i].t))}</span>`;
  }
}
