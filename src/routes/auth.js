const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');
const smsService = require('../services/sms');

// ارسال کد تایید - با کاوه‌نگار + حالت دمو
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'شماره معتبر نیست' });
    }

    const db = await getDB();
    
    // کد 4 رقمی - در پروداکشن تصادفی، در دمو 1234
    const isDemoMode = !process.env.KAVENEGAR_API_KEY || process.env.KAVENEGAR_API_KEY.includes('YOUR_') || process.env.SMS_ENABLED !== 'true';
    const code = isDemoMode ? '1234' : Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await db.run(
      `INSERT OR REPLACE INTO otps (phone, code, expires_at) VALUES (?, ?, ?)`,
      [phone, code, expiresAt]
    );

    // ارسال پیامک
    let smsResult;
    try {
      smsResult = await smsService.sendOTP(phone, code);
      console.log(`📱 OTP for ${phone}: ${code} - SMS:`, smsResult.success ? 'ارسال شد' : smsResult.error);
    } catch (e) {
      console.error('SMS Error:', e);
      smsResult = { success: false, error: e.message };
    }

    res.json({
      success: true,
      message: 'کد تایید ارسال شد',
      sms: smsResult,
      // فقط در حالت dev یا دمو کد را برمیگردانیم
      ...(process.env.NODE_ENV !== 'production' && { dev_code: code }),
      ...(isDemoMode && { demo_mode: true, demo_note: 'SMS_ENABLED=false - حالت دمو، کد 1234 است. برای فعالسازی واقعی، .env را تنظیم کن' })
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// تایید کد
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    const db = await getDB();

    const otp = await db.get('SELECT * FROM otps WHERE phone = ?', [phone]);
    if (!otp) return res.status(400).json({ error: 'کد یافت نشد، دوباره درخواست دهید' });

    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ error: 'کد منقضی شده' });
    }

    if (otp.code !== code) {
      return res.status(400).json({ error: 'کد اشتباه است' });
    }

    await db.run('DELETE FROM otps WHERE phone = ?', [phone]);

    let user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!user) {
      const result = await db.run(
        'INSERT INTO users (phone, name, role) VALUES (?, ?, ?)',
        [phone, 'کاربر شفا', 'user']
      );
      user = await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    }

    const token = generateToken(user);
    res.json({ success: true, token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// لاگین مدیر
router.post('/admin-login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const adminPhone = process.env.ADMIN_PHONE || '09120000000';
    const adminPass = process.env.ADMIN_PASSWORD || '1234';

    if (phone !== adminPhone || password !== adminPass) {
      return res.status(401).json({ error: 'اطلاعات مدیر اشتباه است' });
    }

    const db = await getDB();
    let admin = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!admin) {
      const result = await db.run(
        'INSERT INTO users (phone, name, role) VALUES (?, ?, ?)',
        [phone, 'مدیر شفا', 'admin']
      );
      admin = await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    } else if (admin.role !== 'admin') {
      await db.run('UPDATE users SET role = ? WHERE id = ?', ['admin', admin.id]);
      admin.role = 'admin';
    }

    const token = generateToken(admin);
    res.json({ success: true, token, user: admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const user = await db.get('SELECT id, phone, name, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const db = await getDB();
    await db.run('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
    const user = await db.get('SELECT id, phone, name, role FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;
