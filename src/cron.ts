import { CronJob } from "cron";
import { cacheDb, db } from "./lib/db.js";

// Delete old data every hour
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

const writeCache = () => {
  const range = "1 day";

  // Delete all old post views from cache
  cacheDb
    .prepare(
      `DELETE FROM post WHERE dateWritten < DATETIME('now', '-${range}');`
    )
    .run();

  // Delete all old dateWritten from cache
  cacheDb
    .prepare(
      `DELETE FROM date_written WHERE dateWritten < DATETIME('now', '-${range}');`
    )
    .run();

  // Write scored posts to cache
  const writePosts = cacheDb.prepare(
    `
      INSERT INTO post (
        did,
        rkey,
        url,
        createdAt,
        score,
        raw_score,
        decay,
        likes,
        reposts,
        comments,
        dateWritten
      )
      SELECT
        did,
        rkey,
        url,
        createdAt,
        max(raw_score * decay) as score,
        raw_score,
        decay,
        likes,
        reposts,
        comments,
        DATETIME('now') as dateWritten
      FROM
        (
          SELECT
            local.post.did,
            local.post.rkey,
            local.post.url,
            local.post.createdAt,
            (1 - (unixepoch('now') - unixepoch(local.post.createdAt)) * 1.0 / 1000 / 60 / 60 / 24) as decay,
            COUNT(local.reaction.type) AS raw_score,
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
          local.post.createdAt >= DATETIME('now', '-${range}')
        GROUP BY
          local.post.did,
          local.post.rkey,
          local.post.url
      )
      GROUP BY
        url
      ORDER BY
        score DESC;
      `
  );

  const lastRun = writePosts.run();
  cacheDb
    .prepare(
      `INSERT INTO date_written (dateWritten)
      SELECT dateWritten FROM post WHERE rowid = ?;
      `
    )
    .run(lastRun.lastInsertRowid);

  console.log("WRITE POSTS", lastRun);
};

// write cache immediately at startup
writeCache();

// Generate a new feed every 10 minutes
CronJob.from({
  start: true,
  cronTime: "0/10 * * * *",
  onTick: writeCache,
});
