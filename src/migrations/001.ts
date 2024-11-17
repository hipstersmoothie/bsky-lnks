import Database from "libsql/promise";

export const migration = async (db: Database, cacheDb: Database) => {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS post (
      did TEXT NOT NULL, 
      rkey TEXT NOT NULL, 
      url TEXT NOT NULL, 
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (did, rkey, url)
    )`
  );

  const hasText = (
    await db.prepare(`
    SELECT name FROM pragma_table_info('post') WHERE name = 'text'
  `)
  ).get();

  if (!hasText) {
    await db.exec(`
      ALTER TABLE post ADD COLUMN text TEXT
      WHERE NOT EXISTS ()
    `);
  }

  await db.exec(
    `CREATE TABLE IF NOT EXISTS reaction (
      id TEXT NOT NULL, 
      did TEXT NOT NULL, 
      rkey TEXT NOT NULL, 
      type TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )`
  );

  // Create dateWritten table to store each unique dateWritten
  await cacheDb.exec(
    `CREATE TABLE IF NOT EXISTS date_written (
      dateWritten DATETIME NOT NULL,
      PRIMARY KEY (dateWritten)
    )`
  );

  await cacheDb.exec(
    `CREATE TABLE IF NOT EXISTS post (
      did TEXT NOT NULL, 
      rkey TEXT NOT NULL, 
      url TEXT NOT NULL, 
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      score REAL DEFAULT 0.0,
      raw_score INTEGER DEFAULT 0,
      decay REAL DEFAULT 0.0,
      likes INTEGER DEFAULT 0,
      reposts INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      dateWritten DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (dateWritten, createdAt, score, url, rkey, did)
    )`
  );
};

export const rollback = async (db: Database, cacheDb: Database) => {
  await db.exec(`DROP TABLE post`);
  await db.exec(`DROP TABLE reaction`);

  await cacheDb.exec(`DROP TABLE post`);
  await cacheDb.exec(`DROP TABLE date_written`);
};
