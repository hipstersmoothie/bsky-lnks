import Database from "libsql/promise";

export const migration = async (_: Database, cacheDb: Database) => {
  const deletePosts = (
    await cacheDb.prepare(`DELETE FROM post WHERE score <= 10;`)
  ).run();

  console.log("DELETE POSTS", deletePosts);
};

export const rollback = async () => {};
