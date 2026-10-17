import { DatabaseSync } from 'node:sqlite';

export function openDb(path = 'rates.db') {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT NOT NULL,
      t INTEGER NOT NULL,
      price REAL NOT NULL,
      PRIMARY KEY (id, t)
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      device TEXT NOT NULL,
      item TEXT NOT NULL,
      direction TEXT NOT NULL,
      target REAL NOT NULL,
      repeat INTEGER NOT NULL,
      enabled INTEGER NOT NULL,
      armed INTEGER NOT NULL,
      firedAt INTEGER,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS alerts_device ON alerts (device);
  `);
  return db;
}
