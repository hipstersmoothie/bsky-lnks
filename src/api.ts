import Fastify from "fastify";
import {
  constructFeed,
  trendingLinks,
  trendingLinksHourly,
} from "./lib/feed.js";
import { DID, HOST } from "./lib/constants.js";

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
    let oldCursor = undefined;
    if (query.cursor && query.cursor.includes("/")) {
      // We don't need the date anymore, but can grab the index
      const [, index] = query.cursor.split("/");
      oldCursor = index;
    }
    const cursor = oldCursor
      ? parseInt(oldCursor)
      : query.cursor
      ? parseInt(query.cursor)
      : 0;

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

const port = process.env.PORT ? parseInt(process.env.PORT) : 4000;

server.listen({ port, host: "::" }).then(() => {
  console.log(`Server listening on port ${port}`);
});
