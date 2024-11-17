import "dotenv/config";
import { URL } from "url";
import { Jetstream } from "@skyware/jetstream";
import WebSocket from "ws";

import { addPost, addReaction } from "./lib/db.js";
import { bannedHosts } from "./lib/constants.js";

const jetstream = new Jetstream({
  ws: WebSocket,
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
    addReaction({
      id: event.did,
      type: "comment",
      url: event.commit.record.reply.root.uri,
    });
    return;
  }

  const links = event.commit.record.facets
    ?.map((f) => f.features)
    .flat()
    .filter((f) => f.$type === "app.bsky.richtext.facet#link");

  if (!links || links.length === 0) {
    return;
  }

  const hasBannedHost = links.some((link) => {
    try {
      return bannedHosts.includes(new URL(link.uri).host);
    } catch (e) {
      console.error("URL", link.uri);
      console.error(e);
      return false;
    }
  });

  // If the post has a banned host at all, don't add it to the feed
  if (hasBannedHost) {
    return;
  }

  for (const link of links) {
    addPost({ event, url: link.uri });
  }
});

jetstream.onCreate("app.bsky.feed.like", async (event) => {
  addReaction({
    id: event.did,
    type: "like",
    url: event.commit.record.subject.uri,
  });
});

jetstream.onCreate("app.bsky.feed.repost", async (event) => {
  addReaction({
    id: event.did,
    type: "repost",
    url: event.commit.record.subject.uri,
  });
});

jetstream.start();
