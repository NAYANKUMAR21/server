import mysql from "mysql2/promise";
import { logger } from "../utils/logger";

// Production-grade pool with concurrency limits
const poolConfig: mysql.PoolOptions = {
  host: "34.227.223.135",
  port: 3306,
  user: "nayan",
  password: "nayankumar",
  database: "auth_db",

  // Concurrency & performance tuning
  connectionLimit: 20, // Max parallel connections
  queueLimit: 50, // Max queued requests before error
  waitForConnections: true, // Queue requests instead of failing
  connectTimeout: 10000, // 10s connection timeout
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  // Security
  multipleStatements: false, // Prevent SQL injection via stacking
  charset: "utf8mb4",
};

let pool: mysql.Pool;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(poolConfig);
    logger.info(
      `MySQL pool created (max ${poolConfig.connectionLimit} connections)`,
    );
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info("MySQL pool closed");
  }
}

// Execute a query with automatic connection release
export async function query<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows as T;
  } finally {
    connection.release(); // Always release back to pool
  }
}

// Execute multiple queries in parallel (concurrency)
export async function queryParallel<T = unknown>(
  queries: { sql: string; params?: unknown[] }[],
): Promise<T[]> {
  const results = await Promise.all(
    queries.map(({ sql, params }) => query<T>(sql, params)),
  );
  return results;
}

// Transaction support
export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await getPool().getConnection();
  await connection.beginTransaction();
  try {
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
