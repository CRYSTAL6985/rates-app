// Theme button: auto (follow the phone) → dark → light. The choice is remembered on this device.
const MODES = ['auto', 'dark', 'light'];
const LABEL = { auto: 'پوسته: خودکار', dark: 'پوسته: تیره', light: 'پوسته: روشن' };
const ICON = {
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  dark: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
};
const btn = document.getElementById('themeBtn');
const read = () => { try { return localStorage.getItem('theme') ?? 'auto'; } catch { return 'auto'; } };

// The browser bar follows the page colour: both metas take the forced theme's colour, or their own again on auto.
const PAGE = { dark: '#060709', light: '#eceef2' };
const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
metas.forEach(m => { m.dataset.own = m.content; });

function apply(mode) {
  if (mode === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
  metas.forEach(m => { m.content = PAGE[mode] ?? m.dataset.own; });
  btn.setAttribute('aria-label', LABEL[mode]);
  btn.querySelector('svg').innerHTML = ICON[mode];
}

// Kept here too, so the button still cycles when storage is blocked.
let mode = MODES.includes(read()) ? read() : 'auto';
btn.addEventListener('click', () => {
  mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  try { localStorage.setItem('theme', mode); } catch { /* private mode: this visit only */ }
  apply(mode);
});
apply(mode);
