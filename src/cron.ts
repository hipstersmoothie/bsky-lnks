import { CronJob } from "cron";
import { cacheDb, db } from "./lib/db.js";

// Delete old data
CronJob.from({
  start: true,
  cronTime: "0 * * * *",
  onTick: () => {
    // Delete posts older than 1 day
    const deletePosts = db.prepare(
      `
        DELETE FROM post
        WHERE createdAt < DATETIME('now', '-2 day');
      `
    );

    console.log("DELETE POSTS", deletePosts.run());

    // Delete posts older than 1 day
    const deleteReactions = db.prepare(
      `
        DELETE FROM reaction
        WHERE createdAt < DATETIME('now', '-2 day');
      `
    );

    console.log("DELETE REACTIONS", deleteReactions.run());
  },
});

CronJob.from({
  start: true,
  cronTime: "*/10 * * * *",
  onTick: () => {
    // Delete all posts from cache
    cacheDb.prepare("DELETE FROM post;").run();

    // Write scored posts to cache
    const writePosts = cacheDb.prepare(
      `
      INSERT INTO post (did, rkey, url, createdAt, score, likes, reposts, comments)
       SELECT
        local.post.did,
        local.post.rkey,
        local.post.url,
        local.post.createdAt,
        COUNT(
          CASE
            WHEN local.reaction.type = 'like' THEN 1
            WHEN local.reaction.type = 'repost' THEN 1
          END
        ) AS score,
        COUNT(
          CASE
            WHEN local.reaction.type = 'like' THEN 1
          END
        ) AS likes,
        COUNT(
          CASE
            WHEN local.reaction.type = 'repost' THEN 1
          END
        ) AS reposts,
        COUNT(
          CASE
            WHEN local.reaction.type = 'comment' THEN 1
          END
        ) AS comments
      FROM
        local.post
      LEFT JOIN local.reaction ON local.post.rkey = local.reaction.rkey
      AND local.post.did = local.reaction.did
      WHERE
        local.post.createdAt >= DATETIME('now', '-1 day')
      GROUP BY
        local.post.did,
        local.post.rkey,
        local.post.url
      ORDER BY
          score DESC;
      `
    );

    console.log("WRITE POSTS", writePosts.run());
  },
});
