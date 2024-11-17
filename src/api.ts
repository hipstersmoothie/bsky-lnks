import Fastify from "fastify";
import {
  constructFeed,
  parseCursor,
  trendingLinks,
  trendingLinksHourly,
} from "./lib/feed.js";
import { DID, HOST } from "./lib/constants.js";
import { db } from "./lib/db.js";

const server = Fastify({
  logger: true,
});

// Tell Bluesky about the feed
server.route({
  method: "GET",
  url: "/.well-known/did.json",
  handler: async (_, res) => {
    res.send({
      "@context": ["https://www.w3.org/ns/did/v1"],
      id: DID,
      service: [
        {
          id: "#bsky_fg",
          serviceEndpoint: `https://${HOST}`,
          type: "BskyFeedGenerator",
        },
      ],
    });
  },
});

// Define the feeds we support
server.route({
  method: "GET",
  url: "/xrpc/app.bsky.feed.describeFeedGenerator",
  handler: async (_, res) => {
    res.send({
      did: DID,
      feeds: [
        { uri: `at://${DID}/app.bsky.feed.generator/trending-links` },
        { uri: `at://${DID}/app.bsky.feed.generator/trend-links-24` },
      ],
    });
  },
});

// Construct the feed
server.route({
  method: "GET",
  url: "/xrpc/app.bsky.feed.getFeedSkeleton",
  handler: async (req, res) => {
    const query = req.query as {
      feed: string;
      cursor?: string;
      limit: string;
    };
    const limit = parseInt(query.limit);
    const cursor = query.cursor ? parseCursor(query.cursor) : undefined;

    console.log("\nGOT", req.query, "\n");

    switch (query.feed) {
      case `at://${DID}/app.bsky.feed.generator/trending-links`: {
        const { items, cursor: newCursor } = await trendingLinks({
          limit,
          cursor,
        });

        res.send({ feed: constructFeed(items), cursor: newCursor });
        return;
      }
      case `at://${DID}/app.bsky.feed.generator/trend-links-24`: {
        const { items, cursor: newCursor } = await trendingLinksHourly({
          limit,
          cursor,
        });

        res.send({ feed: constructFeed(items), cursor: newCursor });
        return;
      }
      default: {
        res.code(404).send();
      }
    }
  },
});

// Get all the posts data
server.route({
  method: "GET",
  url: "/dump",
  handler: async (_, res) => {
    res.send({
      posts: await (await db.prepare(`SELECT * FROM post`)).all(),
    });
  },
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 4000;

server.listen({ port, host: "::" }).then(() => {
  console.log(`Server listening on port ${port}`);
});
