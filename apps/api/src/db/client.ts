import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise'
import { config } from '../config.js'
import { schemaSql } from './schema.js'

let pool: Pool | null = null

function databaseUrl(): URL {
  return new URL(config.databaseUrl)
}

function connectionConfig(includeDatabase = true) {
  const url = databaseUrl()
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: includeDatabase ? url.pathname.replace(/^\//, '') : undefined,
    charset: 'utf8mb4',
    timezone: '+00:00',
    supportBigNumbers: true,
    namedPlaceholders: true
  }
}

export async function ensureDatabase(): Promise<void> {
  const url = databaseUrl()
  const database = url.pathname.replace(/^\//, '')
  if (!database) {
    throw new Error('DATABASE_URL must include a database name, for example mysql://root:password@localhost:3306/fakemart')
  }

  const connection = await mysql.createConnection(connectionConfig(false))
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  } finally {
    await connection.end()
  }
}

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      ...connectionConfig(true),
      waitForConnections: true,
      connectionLimit: 12,
      queueLimit: 0,
      multipleStatements: false
    })
  }
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

export async function migrate(): Promise<void> {
  await ensureDatabase()
  const db = getPool()
  for (const statement of schemaSql) {
    await db.execute(statement)
  }
  await ensureSchemaPatches()
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  return (await columnInfo(table, column)) != null
}

async function columnInfo(table: string, column: string): Promise<RowDataPacket | null> {
  const result = await rows(
    `SELECT COLUMN_NAME Field, COLUMN_TYPE Type
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )
  return result[0] ?? null
}

async function ensureSchemaPatches(): Promise<void> {
  if (!(await hasColumn('users', 'default_address_label'))) {
    await exec('ALTER TABLE users ADD COLUMN default_address_label TEXT NULL AFTER avatar_url')
  }
  await exec('UPDATE users SET default_address_label = ? WHERE default_address_label IS NULL OR default_address_label = ""', [
    '奥特曼 星期八 138****7788 光之国银河路 7 号 宇宙便利店楼上 302'
  ])
  const orderAddressColumn = await columnInfo('orders', 'virtual_address_label')
  if (orderAddressColumn && !String(orderAddressColumn.Type ?? '').toLowerCase().startsWith('text')) {
    await exec('ALTER TABLE orders MODIFY COLUMN virtual_address_label TEXT NOT NULL')
  }
  await ensureColumn('orders', 'original_amount', 'ALTER TABLE orders ADD COLUMN original_amount INT NOT NULL DEFAULT 0 AFTER status')
  await ensureColumn('orders', 'coupon_id', 'ALTER TABLE orders ADD COLUMN coupon_id VARCHAR(36) NULL AFTER saved_amount')
  await ensureColumn('orders', 'coupon_template_id', 'ALTER TABLE orders ADD COLUMN coupon_template_id VARCHAR(36) NULL AFTER coupon_id')
  await ensureColumn('orders', 'coupon_name', 'ALTER TABLE orders ADD COLUMN coupon_name VARCHAR(120) NULL AFTER coupon_template_id')
  await ensureColumn('orders', 'coupon_discount_amount', 'ALTER TABLE orders ADD COLUMN coupon_discount_amount INT NOT NULL DEFAULT 0 AFTER coupon_name')
  await exec('UPDATE orders SET original_amount = total_virtual_amount + coupon_discount_amount WHERE original_amount = 0')
  await ensureColumn('coupon_templates', 'title', "ALTER TABLE coupon_templates ADD COLUMN title VARCHAR(120) NOT NULL DEFAULT '' AFTER id")
  await ensureColumn('coupon_templates', 'description', "ALTER TABLE coupon_templates ADD COLUMN description VARCHAR(255) NOT NULL DEFAULT '' AFTER title")
  await ensureColumn('coupon_templates', 'scope', "ALTER TABLE coupon_templates ADD COLUMN scope VARCHAR(30) NOT NULL DEFAULT 'all' AFTER description")
  await ensureColumn('coupon_templates', 'threshold_amount', 'ALTER TABLE coupon_templates ADD COLUMN threshold_amount INT NOT NULL DEFAULT 0 AFTER scope')
  await ensureColumn('coupon_templates', 'discount_amount', 'ALTER TABLE coupon_templates ADD COLUMN discount_amount INT NOT NULL DEFAULT 1 AFTER threshold_amount')
  await ensureColumn('coupon_templates', 'total_quantity', 'ALTER TABLE coupon_templates ADD COLUMN total_quantity INT NULL AFTER discount_amount')
  await ensureColumn('coupon_templates', 'claimed_count', 'ALTER TABLE coupon_templates ADD COLUMN claimed_count INT NOT NULL DEFAULT 0 AFTER total_quantity')
  await ensureColumn('coupon_templates', 'per_user_limit', 'ALTER TABLE coupon_templates ADD COLUMN per_user_limit INT NOT NULL DEFAULT 1 AFTER claimed_count')
  await ensureColumn('coupon_templates', 'starts_at', 'ALTER TABLE coupon_templates ADD COLUMN starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER per_user_limit')
  await ensureColumn('coupon_templates', 'ends_at', 'ALTER TABLE coupon_templates ADD COLUMN ends_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER starts_at')
  await ensureColumn('coupon_templates', 'status', "ALTER TABLE coupon_templates ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER ends_at")
  await ensureColumn('coupon_templates', 'sort_order', 'ALTER TABLE coupon_templates ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER status')
  await ensureColumn('coupon_templates', 'created_at', 'ALTER TABLE coupon_templates ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER sort_order')
  await ensureColumn('coupon_templates', 'updated_at', 'ALTER TABLE coupon_templates ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at')
  await ensureColumn('user_coupons', 'status', "ALTER TABLE user_coupons ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'available' AFTER template_id")
  await ensureColumn('user_coupons', 'claimed_at', 'ALTER TABLE user_coupons ADD COLUMN claimed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status')
  await ensureColumn('user_coupons', 'used_at', 'ALTER TABLE user_coupons ADD COLUMN used_at DATETIME NULL AFTER claimed_at')
  await ensureColumn('user_coupons', 'expires_at', 'ALTER TABLE user_coupons ADD COLUMN expires_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER used_at')
  await ensureColumn('user_coupons', 'order_id', 'ALTER TABLE user_coupons ADD COLUMN order_id VARCHAR(36) NULL AFTER expires_at')
  await exec(
    `UPDATE coupon_templates ct
     LEFT JOIN (
       SELECT template_id, COUNT(*) claimed_total FROM user_coupons GROUP BY template_id
     ) uc ON uc.template_id = ct.id
     SET ct.claimed_count = COALESCE(uc.claimed_total, ct.claimed_count, 0)`
  )
}

async function ensureColumn(table: string, column: string, alterSql: string): Promise<void> {
  if (!(await hasColumn(table, column))) {
    await exec(alterSql)
  }
}

export async function rows<T extends RowDataPacket = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [result] = await getPool().execute<T[]>(sql, params as any[])
  return result
}

export async function row<T extends RowDataPacket = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T | null> {
  const result = await rows<T>(sql, params)
  return result[0] ?? null
}

export async function exec(sql: string, params: unknown[] = []): Promise<void> {
  await getPool().execute(sql, params as any[])
}

export async function withTransaction<T>(handler: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection()
  try {
    await connection.beginTransaction()
    const result = await handler(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
