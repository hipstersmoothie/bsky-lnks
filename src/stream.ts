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
    addPost({
      did: event.did,
      rkey: event.commit.rkey,
      url: link.uri,
    });
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
