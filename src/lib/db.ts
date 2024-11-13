import Database from "libsql";

export const db = new Database(process.env.DB_URL || "./local.db");

db.prepare(
  `CREATE TABLE IF NOT EXISTS post (
    did TEXT NOT NULL, 
    rkey TEXT NOT NULL, 
    url TEXT NOT NULL, 
    createdAt DATETIME,
    likes INTEGER DEFAULT 0,
    reposts INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    PRIMARY KEY (did, rkey, url)
  )`
).run();

export interface Post {
  did: string;
  rkey: string;
  url: string;
  likes: number;
  reposts: number;
  comments: number;
  createdAt: Date;
}

function parseUri(uri: string) {
  const [, did, rkey] =
    uri.match(/^at:\/\/([^\/]+)\/app.bsky.feed.post\/([^\/]+)/) || [];
  return { did, rkey };
}

export function incrementField(
  uri: string,
  field: "likes" | "reposts" | "comments"
) {
  const { did, rkey } = parseUri(uri);

  if (!did || !rkey) {
    return;
  }

  const result = db
    .prepare(
      `
        UPDATE post
        SET ${field} = ${field} + 1
        WHERE did = ? AND rkey = ?
      `
    )
    .run(did, rkey);

  if (result.changes === 0) {
    return;
  }

  console.log(`Added to ${field}`, `at://${did}/app.bsky.feed.post/${rkey}`);
}
