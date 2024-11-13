import { db, Post } from "./db.js";

interface PostWithData extends Post {
  uri: string;
  url: string;
}

function getPostScore(post: PostWithData) {
  return post.likes + post.reposts;
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
    return { startTime: undefined, url: undefined };
  }

  const [startTime, ...url] = cursor.split("/");
  return { startTime, url: url.join("/") };
}

export type ParsedCursor = ReturnType<typeof parseCursor>;

export interface RankLinksOptions {
  limit: number;
  cursor: ParsedCursor;
  range?: string;
}

export async function rankLinks({
  limit,
  cursor,
  range = "1 day",
}: RankLinksOptions) {
  const startTime = cursor.startTime ? `'${cursor.startTime}'` : `'now'`;
  const minTime = `STRFTIME('%Y-%m-%d %H:%M:%S', ${startTime}, '-${range}')`;
  const maxTime = `STRFTIME('%Y-%m-%d %H:%M:%S', ${startTime})`;

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

    top[post.url]?.push({
      ...post,
      uri: `at://${post.did}/app.bsky.feed.post/${post.rkey}`,
      url: `https://bsky.app/profile/${post.did}/post/${post.rkey}`,
    });
  }

  let items = Object.entries(top)
    .sort((a, b) => sumPostScore(b[1]) - sumPostScore(a[1]))
    .map(([url, posts]): [string, PostWithData[]] => [
      url,
      posts.sort((a, b) => getPostScore(b) - getPostScore(a)),
    ]);

  const urlCursorIndex = items.findIndex(([url]) => url === cursor.url);

  if (urlCursorIndex !== -1) {
    items = items.slice(urlCursorIndex + 1);
  }

  items = items.slice(0, limit);

  const defaultStartTime = db
    .prepare(`SELECT STRFTIME('%Y-%m-%d %H:%M:%S', 'now') AS value;`)
    .get() as { value: string };
  const newStartTime = cursor.startTime || defaultStartTime.value;

  return {
    items: Object.fromEntries(items),
    cursor: `${newStartTime}/${items[items.length - 1]![0]}`,
  };
}

export async function trendingLinks(options: Omit<RankLinksOptions, "range">) {
  return rankLinks({ ...options, range: "1 day" });
}
