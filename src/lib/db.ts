import Database from "libsql";

const dbPath = process.env.DB_URL || "./local.db";
const cacheDbPath = process.env.CACHE_DB_URL || "./cache.db";

export const db = new Database(dbPath);
export const cacheDb = new Database(cacheDbPath);

// Allows the other process to read from the database while we're writing to it
db.exec("PRAGMA journal_mode = WAL;");
cacheDb.exec("PRAGMA journal_mode = WAL;");
cacheDb.exec(`ATTACH DATABASE '${dbPath}' AS local;`);

db.prepare(
  `CREATE TABLE IF NOT EXISTS post (
    did TEXT NOT NULL, 
    rkey TEXT NOT NULL, 
    url TEXT NOT NULL, 
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (did, rkey, url)
  )`
).run();

export interface Post {
  did: string;
  rkey: string;
  url: string;
  createdAt: string;
}

// Create dateWritten table to store each unique dateWritten
cacheDb
  .prepare(
    `CREATE TABLE IF NOT EXISTS date_written (
    dateWritten DATETIME NOT NULL,
    PRIMARY KEY (dateWritten)
  )`
  )
  .run();

cacheDb
  .prepare(
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
  )
  .run();

export interface PostWithData extends Post {
  score: number;
  raw_score: number;
  decay: number;
  likes: number;
  reposts: number;
  comments: number;
  dateWritten: string;
}

export function addPost(data: Omit<Post, "createdAt">) {
  const result = db
    .prepare(`INSERT OR REPLACE INTO post (did, rkey, url) VALUES (?, ?, ?)`)
    .run(data.did, data.rkey, data.url);

  console.log("ADD POST", result);
}

db.prepare(
  `CREATE TABLE IF NOT EXISTS reaction (
    id TEXT NOT NULL, 
    did TEXT NOT NULL, 
    rkey TEXT NOT NULL, 
    type TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  )`
).run();

export interface Reaction {
  id: string;
  did: string;
  rkey: string;
  type: "like" | "repost" | "comment";
  url: string;
  createdAt: string;
}

function parseUri(uri: string) {
  const [, did, rkey] =
    uri.match(/^at:\/\/([^/]+)\/app.bsky.feed.post\/([^/]+)/) || [];
  return { did, rkey };
}

export function addReaction(
  data: Omit<Reaction, "createdAt" | "rkey" | "did">
) {
  const { did, rkey } = parseUri(data.url);
  const id = `${data.id}-${data.type}-${new Date().getTime()}`;
  const result = db
    .prepare(
      `
      INSERT OR IGNORE INTO reaction (id, type, did, rkey)
      SELECT ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM post WHERE did = ? AND rkey = ?)
      `
    )
    .run(id, data.type, did, rkey, did, rkey);

  if (result.changes === 0) {
    return;
  }
  console.log("ADD REACTION", result);
}

export function getStartTime() {
  const defaultStartTime = db
    .prepare(
      `SELECT datetime(strftime('%s', 'now') - strftime('%s', 'now') % 600, 'unixepoch') AS value;`
    )
    .get() as { value: string };

  return defaultStartTime.value;
}

export function getCurrentTime() {
  const defaultStartTime = db
    .prepare(`SELECT STRFTIME('%Y-%m-%d %H:%M:%S', 'now') AS value;`)
    .get() as { value: string };

  return defaultStartTime.value;
}
