import Database from "libsql";

export const db = new Database(process.env.DB_URL || "./local.db");

// Allows the other process to read from the database while we're writing to it
db.exec("PRAGMA journal_mode = WAL;");

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
  createdAt: Date;
}

db.prepare(
  `CREATE TABLE IF NOT EXISTS cache (
    key TEXT NOT NULL, 
    value TEXT NOT NULL, 
    PRIMARY KEY (key)
  )`
).run();

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
  createdAt: Date;
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
  const post = db
    .prepare(`SELECT 1 FROM post WHERE did = ? AND rkey = ?`)
    .get(did, rkey) as Post | undefined;

  if (!post) {
    return;
  }

  const id = `${data.id}-${data.type}-${new Date().getTime()}`;
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO reaction (id, type, did, rkey) VALUES (?, ?, ?, ?)`
    )
    .run(id, data.type, did, rkey);

  console.log("ADD REACTION", result);
}

export function getCurrentTime() {
  const defaultStartTime = db
    .prepare(`SELECT STRFTIME('%Y-%m-%d %H:%M:%S', 'now') AS value;`)
    .get() as { value: string };

  return defaultStartTime.value;
}
