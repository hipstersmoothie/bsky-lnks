import { URL } from "url";
import { Jetstream } from "@skyware/jetstream";

import { db, incrementField } from "./lib/db.js";
import { bannedHosts } from "./lib/constants.js";

// Allows the other process to read from the database while we're writing to it
db.exec("PRAGMA journal_mode = WAL;");

const jetstream = new Jetstream({
  wantedCollections: [
    "app.bsky.feed.post",
    "app.bsky.feed.like",
    "app.bsky.feed.repost",
  ],
});

jetstream.onCreate("app.bsky.feed.post", async (event) => {
  // TODO other langs
  if (!event.commit.record.langs?.some((l) => l === "en")) {
    return;
  }

  if (event.commit.record.reply) {
    incrementField(event.commit.record.reply.root.uri, "comments");
    return;
  }

  const links = event.commit.record.facets
    ?.map((f) => f.features)
    .flat()
    .filter((f) => f.$type === "app.bsky.richtext.facet#link")
    .filter((f) => {
      try {
        return !bannedHosts.includes(new URL(f.uri).host);
      } catch (e) {
        console.error("URL", f.uri);
        console.error(e);
        return false;
      }
    });

  if (!links || links.length === 0) {
    return;
  }

  for (const link of links) {
    const result = db
      .prepare(
        `INSERT OR REPLACE INTO post (did, rkey, url, createdAt) VALUES (?, ?, ?, ?)`
      )
      .run(
        event.did,
        event.commit.rkey,
        link.uri,
        event.commit.record.createdAt
      );

    console.log(result);
  }
});

jetstream.onCreate("app.bsky.feed.like", async (event) => {
  incrementField(event.commit.record.subject.uri, "likes");
});

jetstream.onCreate("app.bsky.feed.repost", async (event) => {
  incrementField(event.commit.record.subject.uri, "reposts");
});

jetstream.start();
