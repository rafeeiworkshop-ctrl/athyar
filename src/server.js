require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { getDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// اطمینان از وجود پوشه ها
const uploadPath = process.env.UPLOAD_PATH || './public/uploads';
const dataPath = path.dirname(process.env.DB_PATH || './data/database.sqlite');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
if (!fs.existsSync('./public/uploads')) fs.mkdirSync('./public/uploads', { recursive: true });

// لاگ ساده
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/support', require('./routes/support'));
app.use('/api/payment', require('./routes/payment'));

// SMS Logs - admin only
app.get('/api/sms-logs', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'توکن لازم' });
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET || 'attari_secret');
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'ادمین' });
    const { getDB } = require('./db');
    const db = await getDB();
    const logs = await db.all('SELECT * FROM sms_logs ORDER BY id DESC LIMIT 100');
    res.json(logs);
  } catch (e) {
    res.status(401).json({ error: 'توکن نامعتبر' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const db = await getDB();
    const prodCount = await db.get('SELECT COUNT(*) as cnt FROM products');
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      database: 'connected',
      products: prodCount.cnt,
      version: '1.0.0',
      name: 'عطاری شفا API'
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// سرو فایل های استاتیک - فرانت اند و آپلودها
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// برای SPA - همه مسیرهای غیر API به index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'حجم فایل زیاد است (حداکثر ۵ مگ)' });
  }
  res.status(500).json({ error: 'خطای سرور', details: err.message });
});

// Start server
async function start() {
  try {
    // مقداردهی دیتابیس
    await getDB();
    console.log('✅ دیتابیس متصل شد');

    // اجرای seed اگر دیتابیس خالی بود
    const db = await getDB();
    const count = await db.get('SELECT COUNT(*) as cnt FROM products');
    if (count.cnt === 0) {
      console.log('🌱 دیتابیس خالی است، در حال seed...');
      require('./seed');
      // seed خودش process.exit میکند، پس اینجا صبر میکنیم
      // برای جلوگیری، seed را به صورت دستی اجرا میکنیم
      setTimeout(() => {}, 2000);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
🌿 ======================================
   عطاری شفا - سرور فعال شد
   🌐 آدرس: http://localhost:${PORT}
   📊 API: http://localhost:${PORT}/api/health
   🔐 پنل مدیر: http://localhost:${PORT} -> ورود مدیر (رمز 1234)
   📁 دیتابیس: ${process.env.DB_PATH}
   ======================================
      `);
    });
  } catch (err) {
    console.error('❌ خطا در راه اندازی سرور:', err);
    process.exit(1);
  }
}

start();
