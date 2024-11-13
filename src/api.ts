import Fastify from "fastify";
import { getTopLinks } from "./lib/feed.js";
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
      feeds: [{ uri: `at://${DID}/app.bsky.feed.generator/trending-links` }],
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

    console.log("\nGOT", req.query, "\n");

    switch (query.feed) {
      case `at://${DID}/app.bsky.feed.generator/trending-links`: {
        const top = await getTopLinks();
        const feed = Object.values(top)
          .slice(0, limit)
          .map((posts) => {
            const post = posts[0]!;
            return {
              post: `at://${post.did}/app.bsky.feed.post/${post.rkey}`,
            };
          });

        // TODO: cursor

        res.send({ feed });
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
