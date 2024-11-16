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

## Caching

The query that determines the score and subsequent ordering of posts is run out of bound from queries and cached to a separate database
that acts like a read cache. It enables fast reads that generally are consistent regardless of where in the feed you are requesting.

It is currently set to write to the cache every 10 minutes which means it is as fresh as possible but it also tracks when it was written to.
Using this written time we can use it to lock a user to a specific view based on when it was written to give them a consistent feed
until they refresh it or it expires in 24 hours.

Any posts that are below 10 score points are not cached and omitted from the feed. This happens to be about 90% of all links processed
but as you can guess most posts with links have very little traction and it doesn't make much sense for this feed to show them.