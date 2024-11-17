import "dotenv/config";
import { CronJob } from "cron";
import { cacheDb, db } from "./lib/db.js";
import { dbPath } from "./lib/constants.js";

// Delete old data every hour
CronJob.from({
  start: true,
  cronTime: "0 * * * *",
  onTick: async () => {
    // Delete posts older than 1 day
    const deletePosts = await db.prepare(
      `
        DELETE FROM post
        WHERE createdAt < DATETIME('now', '-2 day');
      `
    );

    console.log("DELETE POSTS", deletePosts.run());

    // Delete posts older than 1 day
    const deleteReactions = await db.prepare(
      `
        DELETE FROM reaction
        WHERE createdAt < DATETIME('now', '-2 day');
      `
    );

    console.log("DELETE REACTIONS", deleteReactions.run());
  },
});

const writeCache = async () => {
  await cacheDb.exec(`ATTACH DATABASE '${dbPath}' AS local;`);

  const range = "1 day";

  // Delete all old post views from cache
  const deletePosts = (
    await cacheDb.prepare(
      `DELETE FROM post WHERE dateWritten < DATETIME('now', '-${range}') OR score <= 10;`
    )
  ).run();

  console.log("DELETE POSTS", deletePosts);

  // Delete all old dateWritten from cache
  const deleteDateWritten = (
    await cacheDb.prepare(
      `DELETE FROM date_written WHERE dateWritten < DATETIME('now', '-${range}');`
    )
  ).run();

  console.log("DELETE DATE WRITTEN", deleteDateWritten);

  // Write scored posts to cache
  const writePosts = await cacheDb.prepare(
    `
      WITH post_data AS (
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
        post_data
      WHERE
        raw_score > 10.0
      GROUP BY
        url
      ORDER BY
        score DESC;
      `
  );

  const lastRun = writePosts.run();

  (
    await cacheDb.prepare(
      `INSERT INTO date_written (dateWritten)
      SELECT dateWritten FROM post WHERE rowid = ?;
      `
    )
  ).run(lastRun.lastInsertRowid);

  console.log("WRITE POSTS", lastRun);
};

await writeCache();

// Generate a new feed every 10 minutes
CronJob.from({
  start: true,
  cronTime: "0/10 * * * *",
  onTick: writeCache,
});
