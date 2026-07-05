const fs = require("fs");
const path = require("path");
const { query, closePool } = require("../db");

async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  console.log(`Running ${filePath}`);
  await query(sql);
}

async function initDb() {
  try {
    const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
    const seedPath = path.join(__dirname, "..", "sql", "seed.sql");

    await runSqlFile(schemaPath);
    await runSqlFile(seedPath);

    console.log("Database initialized successfully.");
  } catch (error) {
    console.error("Database initialization failed.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

initDb();
