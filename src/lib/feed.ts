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

export async function getTopLinks() {
  const toTopOfHour = 0; //new Date().getMinutes();
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
            post.createdAt >= STRFTIME('%Y-%m-%d %H:%M:%S', 'now', '-${toTopOfHour} minutes', '-1 day')
            AND post.createdAt <= STRFTIME('%Y-%m-%d %H:%M:%S', 'now', '-${toTopOfHour} minutes')
            AND (reaction.createdAt >= STRFTIME('%Y-%m-%d %H:%M:%S', 'now', '-${toTopOfHour} minutes', '-1 day') 
                AND post.createdAt <= STRFTIME('%Y-%m-%d %H:%M:%S', 'now', '-${toTopOfHour} minutes')
                    OR reaction.createdAt IS NULL)
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

  return Object.fromEntries(
    Object.entries(top)
      .sort((a, b) => sumPostScore(b[1]) - sumPostScore(a[1]))
      .map(([url, posts]): [string, PostWithData[]] => [
        url,
        posts.sort((a, b) => getPostScore(b) - getPostScore(a)),
      ])
  );
}
