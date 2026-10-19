// The prices a visitor picked for the top row. Pure: storage is passed in, so the Node tests can use it.
const KEY = 'favs';

// Saved favourites the app still lists, else `defaults`. Blocked storage or junk also gives the defaults.
export function loadFavs(storage, defaults, known, log = console) {
  try {
    const saved = JSON.parse(storage.getItem(KEY));
    const kept = Array.isArray(saved) ? saved.filter(id => known.has(id)) : [];
    if (kept.length) return kept;
  } catch (err) {
    log.warn('[favs] using defaults:', err.message);
  }
  return [...defaults];
}

export function saveFavs(storage, favs, log = console) {
  try {
    storage.setItem(KEY, JSON.stringify(favs));
  } catch (err) {
    log.warn('[favs] not saved, this visit only:', err.message);
  }
}

// Star adds to the end, un-star removes. The last one stays, so the same list comes back.
export const toggleFav = (favs, id) =>
  !favs.includes(id) ? [...favs, id] : favs.length > 1 ? favs.filter(x => x !== id) : favs;
