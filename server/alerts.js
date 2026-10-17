import { randomUUID } from 'node:crypto';

// One step of an alert's life, given the latest price. Returns a new alert, never mutates.
// An alert that fired is disarmed; a repeating one re-arms only once the price has gone
// back across the line, so a price wobbling around the target fires once per crossing.
export function evaluateAlert(alert, price, now) {
  if (!alert.enabled) return { fire: false, alert };
  const hit = alert.direction === 'above' ? price >= alert.target : price <= alert.target;
  if (hit && alert.armed) return { fire: true, alert: { ...alert, armed: false, firedAt: now, enabled: alert.repeat } };
  if (!hit && !alert.armed && alert.repeat) return { fire: false, alert: { ...alert, armed: true } };
  return { fire: false, alert };
}

const fromRow = r => r && ({ ...r, repeat: !!r.repeat, enabled: !!r.enabled, armed: !!r.armed });

export function createAlertStore(db) {
  const q = {
    list: db.prepare('SELECT * FROM alerts WHERE device = ? ORDER BY createdAt'),
    get: db.prepare('SELECT * FROM alerts WHERE device = ? AND id = ?'),
    enabled: db.prepare('SELECT * FROM alerts WHERE enabled = 1'),
    insert: db.prepare('INSERT INTO alerts (id, device, item, direction, target, repeat, enabled, armed, firedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, 1, 1, NULL, ?)'),
    save: db.prepare('UPDATE alerts SET direction = ?, target = ?, repeat = ?, enabled = ?, armed = ?, firedAt = ? WHERE id = ?'),
    remove: db.prepare('DELETE FROM alerts WHERE device = ? AND id = ?'),
  };
  const save = a => q.save.run(a.direction, a.target, a.repeat ? 1 : 0, a.enabled ? 1 : 0, a.armed ? 1 : 0, a.firedAt, a.id);

  return {
    list: device => q.list.all(device).map(fromRow),

    create(device, { item, direction, target, repeat }) {
      const id = randomUUID();
      q.insert.run(id, device, item, direction, target, repeat ? 1 : 0, Date.now());
      return fromRow(q.get.get(device, id));
    },

    // Callers validate the patch. Turning an alert on, or moving its line, arms it again.
    update(device, id, patch) {
      const before = fromRow(q.get.get(device, id));
      if (!before) return null;
      const after = { ...before, ...patch };
      if (patch.enabled || patch.target !== undefined || patch.direction !== undefined) after.armed = true;
      save(after);
      return after;
    },

    remove: (device, id) => q.remove.run(device, id).changes > 0,

    // Returns the alerts that fired, in their new state.
    checkAll(quotes, now = Date.now()) {
      const fired = [];
      for (const alert of q.enabled.all().map(fromRow)) {
        const price = quotes.get(alert.item)?.price;
        if (price === undefined) continue;
        const r = evaluateAlert(alert, price, now);
        if (r.alert !== alert) save(r.alert);
        if (r.fire) fired.push(r.alert);
      }
      return fired;
    },
  };
}
