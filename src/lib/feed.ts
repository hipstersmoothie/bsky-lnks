import { cacheDb, PostWithData } from "./db.js";

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
  const posts = cacheDb
    .prepare(
      `
      SELECT
        did,
        rkey,
        url,
        createdAt,
        score,
        likes,
        reposts,
        comments
      FROM
        post
      WHERE
        createdAt >= DATETIME('now', '-${range}')
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
