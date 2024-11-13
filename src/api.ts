import Fastify from "fastify";
import { getTopLinks } from "./lib/feed.js";
import { DID } from "./lib/constants.js";

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
          serviceEndpoint: "TODO",
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
        {
          uri: `at://${DID}/app.bsky.feed.generator/top-links`,
        },
      ],
    });
  },
});

// Construct the feed
server.route({
  method: "GET",
  url: "/xrpc/app.bsky.feed.getFeedSkeleton",
  handler: async (req, res) => {
    const { feed, cursor } = req.query as Record<string, string | undefined>;

    switch (feed) {
      case `at://${DID}/app.bsky.feed.generator/top-links`: {
        const top = await getTopLinks();
        const feed = Object.values(top)
          .slice(0, 1000)
          .map((posts) => {
            const post = posts[0]!;
            return {
              post: `at://${post.did}/app.bsky.feed.post/${post.rkey}`,
            };
          });

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

server.listen({ port }).then(() => {
  console.log(`Server listening on port ${port}`);
});
