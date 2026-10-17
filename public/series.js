// Pure helpers for chart data. Also imported by the Node tests, so no DOM here.

// Every chart draws exactly N points, so one range can morph into another.
export const N = 60;

export const norm = vals => {
  const mn = Math.min(...vals), mx = Math.max(...vals), s = mx - mn || 1;
  return vals.map(v => (v - mn) / s);
};

// Spread `points` (oldest first) over N evenly spaced moments, holding the last known price.
export function resample(points) {
  if (points.length < 2) return [];
  const t0 = points[0].t, t1 = points.at(-1).t, out = [];
  let j = 0;
  for (let i = 0; i < N; i++) {
    const t = t0 + (t1 - t0) * i / (N - 1);
    while (j < points.length - 1 && points[j + 1].t <= t) j++;
    out.push({ t, price: points[j].price });
  }
  return out;
}

// History stops at the last close; the chart should end at the live price.
export const withLive = (points, quote) =>
  quote && (!points.length || quote.updatedAt > points.at(-1).t)
    ? [...points, { t: quote.updatedAt, price: quote.price }]
    : points;
