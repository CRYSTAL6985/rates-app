// Number and date formatting. Also imported by the Node tests, so no DOM here.
export const nf = new Intl.NumberFormat('fa-IR');
const nf2 = new Intl.NumberFormat('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfc = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

export const formatPct = v => nf2.format(Math.abs(v)) + '٪';

export function formatPrice(item, v, compact) {
  if (item.unit === 'usd') return nf2.format(v) + ' دلار';
  if (compact && v >= 1e9) return nfc.format(v / 1e9) + ' میلیارد';
  return nf.format(Math.round(v));
}

const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';

export function parseNum(s) {
  const latin = String(s)
    .replace(/[۰-۹]/g, d => FA.indexOf(d))
    .replace(/[٠-٩]/g, d => AR.indexOf(d))
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.');
  return /^\d+(\.\d+)?$/.test(latin) ? Number(latin) : NaN;
}

export function ago(ms, now = Date.now()) {
  const s = (now - ms) / 1000;
  if (s < 60) return 'همین الان';
  if (s < 3600) return nf.format(Math.floor(s / 60)) + ' دقیقه پیش';
  if (s < 86400) return nf.format(Math.floor(s / 3600)) + ' ساعت پیش';
  return nf.format(Math.floor(s / 86400)) + ' روز پیش';
}

export const jalaliToday = () =>
  new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

// Toman value of one unit. Ounces are priced in dollars, so they go through the dollar rate.
export const tomanPer = (item, quote, usdQuote) =>
  item.unit === 'usd' ? quote.price * (usdQuote?.price ?? NaN) : quote.price;
