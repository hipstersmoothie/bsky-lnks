# Bluesky Trending Links

This repo contains the code the "Trending Links" feeds I've created for Bluesky.

## Feeds

- [Trending Links](https://bsky.app/profile/did:plc:m2sjv3wncvsasdapla35hzwj/feed/trending-links) - Most popular links over the last 24 hours
- [Trending Links Hourly](https://bsky.app/profile/did:plc:m2sjv3wncvsasdapla35hzwj/feed/trend-links-24) - Most popular Links of the last hour

## Algorithm

The feed uses the following strategy to rank posts:

- Add together all the reactions to the post (comments, likes, reposts)
- Apply a "decay" to that value. The older the link the higher the decay
- For each link do the above and add them all together

Posts are then ordered according to that score.
