import { CommitCreateEvent } from "@skyware/jetstream";
import Database from "libsql/promise";

import { dbPath, cacheDbPath } from "./constants.js";

export const db = new Database(dbPath, {});
export const cacheDb = new Database(cacheDbPath, {});

// Allows the other process to read from the database while we're writing to it
await db.exec("PRAGMA journal_mode = WAL;");
await cacheDb.exec("PRAGMA journal_mode = WAL;");

export interface Post {
  did: string;
  rkey: string;
  url: string;
  createdAt: string;
}

export interface PostWithData extends Post {
  score: number;
  raw_score: number;
  decay: number;
  likes: number;
  reposts: number;
  comments: number;
  dateWritten: string;
}

export async function addPost(data: {
  event: CommitCreateEvent<"app.bsky.feed.post">;
  url: string;
}) {
  let text = data.event.commit.record.text;

  if (
    data.event.commit.record.embed &&
    "external" in data.event.commit.record.embed
  ) {
    text += `\n\n${data.event.commit.record.embed.external.title}\n\n${data.event.commit.record.embed.external.description}`;
  }

  try {
    const result = (
      await db.prepare(
        `INSERT OR REPLACE INTO post (did, rkey, url, text) VALUES (?, ?, ?, ?)`
      )
    ).run(data.event.did, data.event.commit.rkey, data.url, text);

    console.log("ADD POST", result);
  } catch (e) {
    console.error(e);
  }
}

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

export async function addReaction(
  data: Omit<Reaction, "createdAt" | "rkey" | "did">
) {
  const { did, rkey } = parseUri(data.url);
  const id = `${data.id}-${data.type}-${new Date().getTime()}`;

  const result = (
    await db.prepare(
      `
      INSERT OR IGNORE INTO reaction (id, type, did, rkey)
      SELECT ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM post WHERE did = ? AND rkey = ?)
      `
    )
  ).run(id, data.type, did, rkey, did, rkey);

  if (result.changes === 0) {
    return;
  }
  console.log("ADD REACTION", result);
}

export async function getStartTime() {
  const defaultStartTime = (
    await db.prepare(
      `SELECT datetime(strftime('%s', 'now') - strftime('%s', 'now') % 600, 'unixepoch') AS value;`
    )
  ).get() as { value: string };

  return defaultStartTime.value;
}

export async function getCurrentTime() {
  const defaultStartTime = (
    await db.prepare(`SELECT STRFTIME('%Y-%m-%d %H:%M:%S', 'now') AS value;`)
  ).get() as { value: string };

  return defaultStartTime.value;
}
