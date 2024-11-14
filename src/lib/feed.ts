import { db, getStartTime, Post } from "./db.js";

interface PostWithData extends Post {
  uri: string;
  url: string;
}

function getPostScore(post: PostWithData) {
  // calculate a decaying score based on the last 24 hours
  // the older the post the lesser the score
  const timeDiff = Date.now() - new Date(post.createdAt).getTime();
  const decay = 1 - timeDiff / 1000 / 60 / 60 / 24;

  return (post.likes + post.reposts + post.comments) * decay;
}

function sumPostScore(posts: PostWithData[]) {
  return posts.reduce((acc, post) => acc + getPostScore(post), 0);
}

interface PostWithData extends Post {
  likes: number;
  reposts: number;
  comments: number;
}

export function parseCursor(cursor: string | undefined) {
  if (!cursor) {
    return { startTime: undefined, index: undefined };
  }

  const [startTime, index] = cursor.split("/");
  return { startTime, index: parseInt(index || "0") };
}

export type ParsedCursor = ReturnType<typeof parseCursor>;

export interface RankLinksOptions {
  limit: number;
  cursor?: ParsedCursor;
  range?: string;
}

export async function rankLinks({
  limit,
  cursor = { startTime: undefined, index: undefined },
  range = "1 day",
}: RankLinksOptions) {
  const defaultStartTime = getStartTime();
  const startTime = cursor.startTime ?? defaultStartTime;
  const cacheKey = `${startTime}/${range}`;
  const cached = db
    .prepare(`SELECT value FROM cache WHERE key = ?`)
    .get(cacheKey) as { value: string } | undefined;

  let items: [string, PostWithData[]][];

  if (cached) {
    console.log("CACHE HIT", cacheKey);
    items = JSON.parse(cached.value);
  } else {
    console.log("CACHE MISS", cacheKey);
    const minTime = `DATETIME('${startTime}', '-${range}')`;
    const maxTime = `DATETIME('${startTime}')`;

    const posts = db
      .prepare(
        `
          SELECT 
              post.did,
              post.rkey,
              post.url,
              post.createdAt,
              COUNT(CASE WHEN reaction.type = 'like' THEN 1 END) AS likes,
              COUNT(CASE WHEN reaction.type = 'repost' THEN 1 END) AS reposts,
              COUNT(CASE WHEN reaction.type = 'comment' THEN 1 END) AS comments
          FROM 
              post
              LEFT JOIN reaction ON post.rkey = reaction.rkey AND post.did = reaction.did
          WHERE
              post.createdAt >= ${minTime}
              AND post.createdAt <= ${maxTime}
              AND (reaction.createdAt >= ${minTime} AND post.createdAt <= ${maxTime} OR reaction.createdAt IS NULL)
          GROUP BY
              post.did, post.rkey, post.url, post.createdAt;
        `
      )
      .all() as PostWithData[];

    const top: Record<string, PostWithData[]> = {};

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];

      if (!post) {
        continue;
      }

      if (!top[post.url]) {
        top[post.url] = [];
      }

      top[post.url]?.push(post);
    }

    items = Object.entries(top)
      .sort((a, b) => sumPostScore(b[1]) - sumPostScore(a[1]))
      .map(([url, posts]): [string, PostWithData[]] => [
        url,
        posts.sort((a, b) => getPostScore(b) - getPostScore(a)),
      ])
      .slice(0, 1500);

    db.prepare(`INSERT OR REPLACE INTO cache (key, value) VALUES (?, ?)`).run(
      cacheKey,
      JSON.stringify(items)
    );
  }

  if (cursor.index) {
    items = items.slice(cursor.index + 1);
  }

  items = items.slice(0, limit);

  return {
    items: Object.fromEntries(items),
    cursor: `${startTime}/${(cursor.index || 0) + limit}`,
  };
}

export function constructFeed(
  items: Awaited<ReturnType<typeof rankLinks>>["items"]
) {
  return Object.values(items).map((item) => {
    const post = item[0]!;
    return {
      post: `at://${post.did}/app.bsky.feed.post/${post.rkey}`,
    };
  });
}

export async function trendingLinks(options: Omit<RankLinksOptions, "range">) {
  return rankLinks({ ...options, range: "1 day" });
}

export async function trendingLinksHourly(
  options: Omit<RankLinksOptions, "range">
) {
  return rankLinks({ ...options, range: "1 hour" });
}
