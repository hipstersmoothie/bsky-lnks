import { db, Post } from "./db.js";

interface PostWithData extends Post {
  uri: string;
  url: string;
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
  cursor?: number;
  range?: string;
}

export async function rankLinks({
  limit,
  cursor,
  range = "1 day",
}: RankLinksOptions) {
  const posts = db
    .prepare(
      `
      SELECT
        did,
        rkey,
        url,
        createdAt,
        likes + reposts AS score,
        likes,
        reposts,
        comments
      FROM
        (
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
          LEFT JOIN reaction ON post.rkey = reaction.rkey
          AND post.did = reaction.did
          WHERE
            post.createdAt >= DATETIME(
              'now',
              '-${range}'
            )
          GROUP BY
            post.did,
            post.rkey,
            post.url
        )
      ORDER BY
        score DESC
      LIMIT
        ${limit}
        ${cursor ? `OFFSET ${cursor}` : ""};
        `
    )
    .all() as PostWithData[];

  return {
    items: posts,
    cursor: (cursor || 0) + limit,
  };
}

export function constructFeed(items: PostWithData[]) {
  return items.map((post) => {
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
