// Every price the app shows. `key` is the item's name at its source.
// Display fields (flag, sym, glyph, metal…) travel to the browser with the item.
export const ITEMS = [
  { id: 'usd', tab: 'fx', source: 'tgju', key: 'price_dollar_rl', unit: 'toman', name: 'دلار آمریکا', short: 'دلار', sub: 'USD', flag: '🇺🇸' },
  { id: 'eur', tab: 'fx', source: 'tgju', key: 'price_eur', unit: 'toman', name: 'یورو', sub: 'EUR', flag: '🇪🇺' },
  { id: 'gbp', tab: 'fx', source: 'tgju', key: 'price_gbp', unit: 'toman', name: 'پوند انگلیس', sub: 'GBP', flag: '🇬🇧' },
  { id: 'aed', tab: 'fx', source: 'tgju', key: 'price_aed', unit: 'toman', name: 'درهم امارات', sub: 'AED', flag: '🇦🇪' },
  { id: 'try', tab: 'fx', source: 'tgju', key: 'price_try', unit: 'toman', name: 'لیر ترکیه', sub: 'TRY', flag: '🇹🇷' },
  { id: 'iqd', tab: 'fx', source: 'tgju', key: 'price_iqd', unit: 'toman', name: 'دینار عراق', sub: 'IQD', flag: '🇮🇶' },
  { id: 'cny', tab: 'fx', source: 'tgju', key: 'price_cny', unit: 'toman', name: 'یوان چین', sub: 'CNY', flag: '🇨🇳' },

  { id: 'btc', tab: 'crypto', source: 'nobitex', key: 'btc', unit: 'toman', name: 'بیت‌کوین', short: 'بیت‌کوین', sub: 'BTC', sym: '₿', bg: '#f7931a' },
  { id: 'eth', tab: 'crypto', source: 'nobitex', key: 'eth', unit: 'toman', name: 'اتریوم', sub: 'ETH', sym: 'Ξ', bg: '#627eea' },
  { id: 'usdt', tab: 'crypto', source: 'nobitex', key: 'usdt', unit: 'toman', name: 'تتر', sub: 'USDT', sym: '₮', bg: '#26a17b' },
  { id: 'doge', tab: 'crypto', source: 'nobitex', key: 'doge', unit: 'toman', name: 'دوج‌کوین', sub: 'DOGE', sym: 'Ð', bg: '#c2a633' },
  { id: 'sol', tab: 'crypto', source: 'nobitex', key: 'sol', unit: 'toman', name: 'سولانا', sub: 'SOL', sym: '◎', bg: 'linear-gradient(135deg,#9945ff,#14f195)' },
  { id: 'xrp', tab: 'crypto', source: 'nobitex', key: 'xrp', unit: 'toman', name: 'ریپل', sub: 'XRP', sym: '✕', bg: '#23292f' },

  { id: 'g18', tab: 'gold', source: 'tgju', key: 'geram18', unit: 'toman', name: 'طلای ۱۸ عیار', short: 'طلا ۱۸', sub: 'هر گرم', glyph: '۱۸', metal: 'gold' },
  { id: 'g24', tab: 'gold', source: 'tgju', key: 'geram24', unit: 'toman', name: 'طلای ۲۴ عیار', sub: 'هر گرم', glyph: '۲۴', metal: 'gold' },
  { id: 'msq', tab: 'gold', source: 'tgju', key: 'mesghal', unit: 'toman', name: 'مثقال طلا', sub: '۴٫۶۰۸ گرم', glyph: 'م', metal: 'gold' },
  { id: 'emami', tab: 'gold', source: 'tgju', key: 'sekee', unit: 'toman', name: 'سکه امامی', glyph: 'ا', metal: 'coin', weight: 8.133 },
  { id: 'bahar', tab: 'gold', source: 'tgju', key: 'sekeb', unit: 'toman', name: 'سکه بهار آزادی', glyph: 'ب', metal: 'coin', weight: 8.133 },
  { id: 'nim', tab: 'gold', source: 'tgju', key: 'nim', unit: 'toman', name: 'نیم سکه', glyph: '½', metal: 'coin', weight: 4.066 },
  { id: 'rob', tab: 'gold', source: 'tgju', key: 'rob', unit: 'toman', name: 'ربع سکه', glyph: '¼', metal: 'coin', weight: 2.033 },
  { id: 'gerami', tab: 'gold', source: 'tgju', key: 'gerami', unit: 'toman', name: 'سکه گرمی', glyph: 'گ', metal: 'coin', weight: 1.011 },
  { id: 'goz', tab: 'gold', source: 'tgju', key: 'ons', unit: 'usd', name: 'انس طلا', sub: 'بازار جهانی', glyph: 'oz', metal: 'gold' },

  { id: 's999', tab: 'silver', source: 'tgju', key: 'silver_999', unit: 'toman', name: 'نقره ۹۹۹', sub: 'هر گرم', glyph: '۹۹۹', metal: 'silver' },
  { id: 's925', tab: 'silver', source: 'tgju', key: 'silver_925', unit: 'toman', name: 'نقره ۹۲۵', sub: 'هر گرم', glyph: '۹۲۵', metal: 'silver' },
  { id: 'soz', tab: 'silver', source: 'tgju', key: 'silver', unit: 'usd', name: 'انس نقره', sub: 'بازار جهانی', glyph: 'oz', metal: 'silver' },
];

export const TOP_IDS = ['g18', 'usd', 'btc'];

const byId = new Map(ITEMS.map(i => [i.id, i]));
export const itemById = id => byId.get(id);
