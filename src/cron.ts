import { CronJob } from "cron";
import { db } from "./lib/db.js";

CronJob.from({
  start: true,
  cronTime: "0 0 */2 * *",
  onTick: () => {
    // Delete posts older than 1 day
    const toTopOfHour = new Date().getMinutes();
    const statement = db.prepare(
      `
        DELETE FROM post
        WHERE createdAt < STRFTIME('%Y-%m-%d %H:%M:%S', 'now', '-${toTopOfHour} minutes' '-1 day');
      `
    );

    console.log("DELETE", statement.run());
  },
});
