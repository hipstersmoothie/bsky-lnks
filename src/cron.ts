import { CronJob } from "cron";
import { db, getCurrentTime } from "./lib/db.js";

// Delete old data
CronJob.from({
  start: true,
  cronTime: "0 * * * *",
  onTick: () => {
    // Delete posts older than 1 day
    const deletePosts = db.prepare(
      `
        DELETE FROM post
        WHERE createdAt < STRFTIME('%Y-%m-%d %H:%M:%S', 'now', '-2 day');
      `
    );

    console.log("DELETE POSTS", deletePosts.run());

    // Delete posts older than 1 day
    const deleteReactions = db.prepare(
      `
            DELETE FROM reaction
            WHERE createdAt < STRFTIME('%Y-%m-%d %H:%M:%S', 'now', '-2 day');
          `
    );

    console.log("DELETE REACTIONS", deleteReactions.run());
  },
});

// Delete caches older than 6 hours
CronJob.from({
  start: true,
  cronTime: "0/10 * * * *",
  onTick: () => {
    const keys = (
      db.prepare(`SELECT key FROM cache`).all() as { key: string }[]
    ).map(({ key }) => key);
    const deleteCutoff = new Date(
      new Date(getCurrentTime()).getTime() - 1 * 60 * 60 * 1000
    );

    console.log("DELETE CUTOFF", { deleteCutoff });

    const keysToDelete = keys.filter((key) => {
      const [startTimeStr] = key.split("/");

      if (!startTimeStr) {
        return false;
      }

      const startTime = new Date(startTimeStr);

      return startTime.getTime() <= deleteCutoff.getTime();
    });

    const statement = db.prepare(
      `DELETE FROM cache WHERE key in ${keysToDelete.join(", ")}`
    );

    console.log("DELETE CACHE", statement.run());
  },
});
