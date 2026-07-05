const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not set. Database calls will fail until configured.");
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

async function query(text, params = []) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (process.env.LOG_SQL === "true") {
    console.log("Executed query", { text, duration, rows: result.rowCount });
  }

  return result;
}

async function closePool() {
  await pool.end();
}

module.exports = {
  query,
  closePool
};
