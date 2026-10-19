import { state, bus, api } from './app.js';
import { Seg } from './chart.js';
import { currentItem } from './sheet.js';
import { formatPrice, parseNum, nf, alertLine, ago } from './format.js';
import { iconHTML, unitText } from './ui.js';

const $ = id => document.getElementById(id);
const DIRECTIONS = ['above', 'below'];
const TOAST_MS = 6000;
const SEEN_KEY = 'firedSeen';

let alerts = [];
let form = null; // { item, alert? } while the form is open
let direction = 0;

// ---------- small helpers ----------
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: banner just shows again */ } },
};

let toastTimer = 0;
export function toast(text) {
  const el = $('toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, TOAST_MS);
}

document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog.panel').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

// ---------- notifications ----------
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function keyBytes(base64url) {
  const b64 = (base64url + '='.repeat((4 - base64url.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// Returns a message for the user when notifications can't be turned on, or null when they are.
async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIOS && !standalone
      ? 'برای گرفتن اعلان، اول «نرخ» را به صفحهٔ اصلی اضافه کنید: دکمهٔ Share ← Add to Home Screen.'
      : 'این مرورگر اعلان نمی‌دهد. هشدارهای فعال‌شده را وقتی برنامه را باز کنید می‌بینید.';
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'اعلان‌ها برای نرخ خاموش است. از تنظیمات مرورگر روشنش کنید تا هشدارها برسد.';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription()
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes((await api('GET', '/api/push/key')).key) });
    await api('POST', '/api/push/subscribe', sub.toJSON());
    return null;
  } catch (err) {
    console.warn('[push]', err);
    return 'هشدار ذخیره شد، ولی اعلان راه نیفتاد. شاید سرویس اعلان بدون VPN در دسترس نیست.';
  }
}

// ---------- form ----------
const dirSeg = Seg($('aSeg'), ['بالاتر از', 'پایین‌تر از'], i => { direction = i; });

function openForm(itemId, alert) {
  const item = state.items.get(itemId), q = state.quotes.get(itemId);
  form = { item: itemId, alert };
  $('aIcon').innerHTML = iconHTML(item, 'lg');
  $('aName').textContent = item.name;
  $('aUnit').textContent = unitText(item);
  $('aNow').textContent = q ? 'قیمت الان: ' + formatPrice(item, q.price) + ' ' + unitText(item) : '';
  direction = alert ? DIRECTIONS.indexOf(alert.direction) : 0;
  $('aTarget').value = alert ? nf.format(alert.target) : q ? formatPrice(item, q.price) : '';
  $('aRepeat').checked = alert?.repeat ?? false;
  $('aNote').textContent = '';
  $('aDelete').hidden = !alert;
  $('alertDlg').showModal();
  dirSeg.select(direction, false); dirSeg.place();
  $('aTarget').select();
}

$('aForm').addEventListener('submit', async e => {
  e.preventDefault();
  const target = parseNum($('aTarget').value);
  if (!(target > 0)) { $('aNote').textContent = 'یک قیمت درست وارد کنید.'; return; }
  const body = { direction: DIRECTIONS[direction], target, repeat: $('aRepeat').checked };
  $('aSave').disabled = true;
  try {
    if (form.alert) await api('PATCH', `/api/alerts/${form.alert.id}`, { ...body, enabled: true });
    else await api('POST', '/api/alerts', { item: form.item, ...body });
  } catch (err) {
    console.warn('[alerts]', err);
    $('aNote').textContent = 'ذخیره نشد. اتصال را بررسی کنید و دوباره بزنید.';
    return;
  } finally {
    $('aSave').disabled = false;
  }
  $('alertDlg').close();
  await loadAlerts();
  const problem = await enablePush();
  toast(problem ?? `هشدار ${state.items.get(form.item).name} ذخیره شد.`);
});

$('aDelete').addEventListener('click', async () => {
  try { await api('DELETE', `/api/alerts/${form.alert.id}`); } catch (err) {
    console.warn('[alerts]', err);
    $('aNote').textContent = 'حذف نشد. اتصال را بررسی کنید.';
    return;
  }
  $('alertDlg').close();
  await loadAlerts();
});

$('sAlert').addEventListener('click', () => { const id = currentItem(); if (id) openForm(id); });

// ---------- list ----------
function renderList() {
  if (!alerts.length) {
    $('aList').innerHTML = '<p class="empty">هنوز هشداری نساخته‌اید.<br>روی یک قیمت بزنید و «هشدار قیمت» را انتخاب کنید.</p>';
    return;
  }
  $('aList').innerHTML = `<div class="alist">${alerts.map(a => {
    const item = state.items.get(a.item);
    const when = a.firedAt ? ' · آخرین بار ' + ago(a.firedAt) : '';
    return `<div class="arow${a.enabled ? '' : ' off'}" data-id="${a.id}">${iconHTML(item)}
      <span class="nm"><b>${item.name}</b><small>${alertLine(item, a)} · ${a.repeat ? 'هر بار' : 'یک بار'}${when}</small></span>
      <input type="checkbox" role="switch" aria-label="روشن" ${a.enabled ? 'checked' : ''}></div>`;
  }).join('')}</div>`;
}

$('aList').addEventListener('change', async e => {
  const row = e.target.closest('.arow'); if (!row) return;
  try {
    await api('PATCH', `/api/alerts/${row.dataset.id}`, { enabled: e.target.checked });
  } catch (err) {
    console.warn('[alerts]', err);
    e.target.checked = !e.target.checked;
    toast('تغییر ذخیره نشد. اتصال را بررسی کنید.');
    return;
  }
  await loadAlerts();
});
$('aList').addEventListener('click', e => {
  if (e.target.matches('input')) return;
  const row = e.target.closest('.arow'); if (!row) return;
  const alert = alerts.find(a => a.id === row.dataset.id);
  $('listDlg').close();
  openForm(alert.item, alert);
});

$('bell').addEventListener('click', () => { markSeen(); renderList(); $('listDlg').showModal(); });

// ---------- fired since last visit ----------
function markSeen() { store.set(SEEN_KEY, String(Date.now())); $('fired').innerHTML = ''; }

function renderFired() {
  const seen = Number(store.get(SEEN_KEY)) || 0;
  const fresh = alerts.filter(a => a.firedAt && a.firedAt > seen).sort((a, b) => b.firedAt - a.firedAt).slice(0, 3);
  $('fired').innerHTML = fresh.map(a => {
    const item = state.items.get(a.item);
    return `<button class="fired">${iconHTML(item, 'sm')}<span>${item.name} ${a.direction === 'above' ? 'رفت بالای' : 'آمد زیر'} ${nf.format(a.target)} ${unitText(item)}<small>${ago(a.firedAt)}</small></span></button>`;
  }).join('');
}
$('fired').addEventListener('click', () => { markSeen(); renderList(); $('listDlg').showModal(); });

async function loadAlerts() {
  try { alerts = (await api('GET', '/api/alerts')).alerts; } catch (err) { console.warn('[alerts]', err); return; }
  renderList();
  renderFired();
}

// ---------- opening an item from a notification ----------
const openItem = id => { if (state.items.has(id)) bus.dispatchEvent(new CustomEvent('open', { detail: id })); };
navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.open) { openItem(e.data.open); loadAlerts(); } });

let first = true;
bus.addEventListener('quotes', () => {
  if (!first) return;
  first = false;
  loadAlerts();
  const fromNotification = new URLSearchParams(location.search).get('item');
  if (fromNotification) { history.replaceState(null, '', '/'); openItem(fromNotification); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && !first) loadAlerts(); });
