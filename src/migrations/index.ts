import { db, cacheDb } from "../lib/db.js";
import { migration as migration001, rollback as rollback001 } from "./001.js";

export const migrations = [
  migration001,
  // more migrations here
];
const runMigrations = async () => {
  for (const migration of migrations) {
    await migration(db, cacheDb);
  }
};

const rollbacks = [
  rollback001,
  // more rollbacks here
];
const rollbackMigrations = async () => {
  for (const migration of rollbacks.reverse()) {
    await migration(db, cacheDb);
  }
};

if (process.argv.includes("--rollback")) {
  await rollbackMigrations();
} else {
  await runMigrations();
}
