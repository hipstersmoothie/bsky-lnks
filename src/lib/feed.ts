import { cacheDb, PostWithData } from "./db.js";

export function parseCursor(cursor: string | undefined) {
  if (!cursor) {
    return { time: undefined, index: undefined };
  }

  const [time, index] = cursor.split("/");
  return { time, index: parseInt(index || "0") };
}

export type ParsedCursor = ReturnType<typeof parseCursor>;

export interface RankLinksOptions {
  limit: number;
  cursor?: ParsedCursor;
  range?: string;
}

export async function rankLinks({
  limit,
  cursor = { time: undefined, index: undefined },
  range = "1 day",
}: RankLinksOptions) {
  const cursorTime = cursor.time || "now";
  const cursorDateTime = `DATETIME('${cursorTime}', '-${range}')`;

  const posts = cacheDb
    .prepare(
      `
      SELECT
        did,
        rkey,
        url,
        createdAt,
        score,
        dateWritten
      FROM
        post
      WHERE
        createdAt >= ${cursorDateTime} AND
        dateWritten = (
          SELECT
            dateWritten
          FROM
            date_written
          WHERE
            dateWritten >= ${cursorDateTime}
          ORDER BY
            julianday(dateWritten) - julianday('${cursorTime}')
          DESC
          LIMIT 1
        )
      ORDER BY
        score DESC
      LIMIT
        ${limit}
        ${cursor.index ? `OFFSET ${cursor.index}` : ""};
        `
    )
    .all() as PostWithData[];

  return {
    items: posts,
    cursor: `${cursor.time || posts[posts.length - 1]?.dateWritten}/${
      (cursor.index || 0) + (posts.length === limit ? limit : posts.length)
    }`,
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
