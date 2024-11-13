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

export async function getTopLinks() {
  const toTopOfHour = new Date().getMinutes();
  const posts = db
    .prepare(
      `
        SELECT * FROM post
        WHERE createdAt >= STRFTIME('%Y-%m-%d %H:%M:%S', 'now', '-${toTopOfHour} minutes', '-1 day')
          AND createdAt < STRFTIME('%Y-%m-%d %H:%M:%S', 'now', '-${toTopOfHour} minutes');
      `
    )
    .all() as Post[];

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

  return Object.fromEntries(
    Object.entries(top)
      .sort((a, b) => sumPostScore(b[1]) - sumPostScore(a[1]))
      .map(([url, posts]): [string, PostWithData[]] => [
        url,
        posts.sort((a, b) => getPostScore(b) - getPostScore(a)),
      ])
  );
}
