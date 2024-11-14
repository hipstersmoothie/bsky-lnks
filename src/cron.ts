import { CronJob } from "cron";
import { db } from "./lib/db.js";

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
