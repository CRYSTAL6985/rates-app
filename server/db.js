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
  `);
  return db;
}
