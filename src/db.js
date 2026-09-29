const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/database.sqlite';

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

async function getDB() {
  if (dbInstance) return dbInstance;
  dbInstance = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  await dbInstance.exec('PRAGMA foreign_keys = ON;');
  await initTables(dbInstance);
  await runMigrations(dbInstance);
  return dbInstance;
}

async function initTables(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT 'کاربر شفا',
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      old_price INTEGER DEFAULT 0,
      stock INTEGER DEFAULT 0,
      discount INTEGER DEFAULT 0,
      is_festival INTEGER DEFAULT 0,
      is_new INTEGER DEFAULT 0,
      is_organic INTEGER DEFAULT 1,
      sales INTEGER DEFAULT 0,
      description TEXT,
      benefits TEXT,
      usage_text TEXT,
      images TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      color TEXT DEFAULT 'green',
      cta TEXT DEFAULT 'خرید کنید',
      image TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      tracking_code TEXT UNIQUE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      province TEXT,
      city TEXT,
      street TEXT,
      alley TEXT,
      plaque TEXT,
      unit TEXT,
      postal TEXT,
      address TEXT NOT NULL,
      lat REAL,
      lng REAL,
      items TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT DEFAULT 'در انتظار پرداخت 💳',
      payment_authority TEXT,
      payment_ref_id TEXT,
      payment_status TEXT DEFAULT 'pending',
      payment_amount INTEGER,
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      tracking_code TEXT,
      authority TEXT UNIQUE,
      ref_id TEXT,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      gateway TEXT DEFAULT 'zarinpal',
      card_pan TEXT,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT,
      template TEXT,
      status TEXT DEFAULT 'pending',
      kavenegar_id TEXT,
      cost INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS otps (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      count INTEGER DEFAULT 0,
      description TEXT,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS support_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      phone TEXT,
      name TEXT,
      subject TEXT DEFAULT 'مشاوره گیاهان دارویی',
      status TEXT DEFAULT 'waiting',
      rating INTEGER,
      feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      sender_name TEXT,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES support_chats(id) ON DELETE CASCADE
    );
  `);

  console.log('✅ جداول دیتابیس آماده شد');
}

async function runMigrations(db) {
  // مایگریشن برای اضافه کردن ستون‌های جدید اگر وجود نداشت
  const migrations = [
    { table: 'banners', column: 'image', sql: 'ALTER TABLE banners ADD COLUMN image TEXT' },
    { table: 'orders', column: 'tracking_code', sql: 'ALTER TABLE orders ADD COLUMN tracking_code TEXT' },
    { table: 'orders', column: 'province', sql: 'ALTER TABLE orders ADD COLUMN province TEXT' },
    { table: 'orders', column: 'street', sql: 'ALTER TABLE orders ADD COLUMN street TEXT' },
    { table: 'orders', column: 'alley', sql: 'ALTER TABLE orders ADD COLUMN alley TEXT' },
    { table: 'orders', column: 'plaque', sql: 'ALTER TABLE orders ADD COLUMN plaque TEXT' },
    { table: 'orders', column: 'unit', sql: 'ALTER TABLE orders ADD COLUMN unit TEXT' },
    { table: 'orders', column: 'lat', sql: 'ALTER TABLE orders ADD COLUMN lat REAL' },
    { table: 'orders', column: 'lng', sql: 'ALTER TABLE orders ADD COLUMN lng REAL' },
    { table: 'orders', column: 'payment_authority', sql: 'ALTER TABLE orders ADD COLUMN payment_authority TEXT' },
    { table: 'orders', column: 'payment_ref_id', sql: 'ALTER TABLE orders ADD COLUMN payment_ref_id TEXT' },
    { table: 'orders', column: 'payment_status', sql: 'ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT "pending"' },
    { table: 'orders', column: 'payment_amount', sql: 'ALTER TABLE orders ADD COLUMN payment_amount INTEGER' },
    { table: 'orders', column: 'paid_at', sql: 'ALTER TABLE orders ADD COLUMN paid_at DATETIME' },
    { table: 'categories', column: 'description', sql: 'ALTER TABLE categories ADD COLUMN description TEXT' },
    { table: 'categories', column: 'image', sql: 'ALTER TABLE categories ADD COLUMN image TEXT' },
    { table: 'categories', column: 'created_at', sql: 'ALTER TABLE categories ADD COLUMN created_at DATETIME' },
  ];

  for (const m of migrations) {
    try {
      const cols = await db.all(`PRAGMA table_info(${m.table})`);
      const exists = cols.some(c => c.name === m.column);
      if (!exists) {
        await db.exec(m.sql);
        console.log(`🔧 مایگریشن: ستون ${m.column} به ${m.table} اضافه شد`);
      }
    } catch (e) {
      // نادیده بگیر
    }
  }

  // ایندکس برای tracking_code
  try {
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_code)');
  } catch (e) {}
}

module.exports = { getDB };
