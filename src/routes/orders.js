const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const smsService = require('../services/sms');
const zarinpal = require('../services/zarinpal');

function generateTrackingCode() {
  const prefix = 'SHF';
  const random = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}${random}`;
}

// ثبت سفارش - با پرداخت و پیامک
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { 
      name, phone, 
      province, city, street, alley, plaque, unit, postal, address,
      lat, lng,
      items, total,
      paymentMethod // 'online' یا 'cod'
    } = req.body;

    if (!name || !phone || !address || !items || !total) {
      return res.status(400).json({ error: 'اطلاعات ناقص است' });
    }
    if (!province || !city || !street) {
      return res.status(400).json({ error: 'استان، شهر و خیابان الزامی است' });
    }

    for (const item of items) {
      const product = await db.get('SELECT stock FROM products WHERE id = ?', [item.id]);
      if (!product) continue;
      if (product.stock < item.qty) {
        return res.status(400).json({ error: `موجودی محصول ${item.id} کافی نیست` });
      }
    }

    let trackingCode;
    let attempts = 0;
    do {
      trackingCode = generateTrackingCode();
      const exists = await db.get('SELECT id FROM orders WHERE tracking_code = ?', [trackingCode]);
      if (!exists) break;
      attempts++;
    } while (attempts < 5);

    const isOnlinePayment = paymentMethod === 'online';

    const result = await db.run(
      `INSERT INTO orders 
      (user_id, tracking_code, name, phone, province, city, street, alley, plaque, unit, postal, address, lat, lng, items, total, status, payment_status, payment_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, trackingCode, name, phone,
        province || '', city || '', street || '', alley || '', plaque || '', unit || '', postal || '', address,
        lat || null, lng || null,
        JSON.stringify(items), total,
        isOnlinePayment ? 'در انتظار پرداخت 💳' : 'در حال پردازش 🌿',
        isOnlinePayment ? 'pending' : 'cod',
        total
      ]
    );

    const orderId = result.lastID;

    // کاهش موجودی فقط اگر پرداخت نقدی یا پرداخت آنلاین موفق باشد
    // برای آنلاین، بعد از تایید پرداخت موجودی کم می‌شود
    if (!isOnlinePayment) {
      for (const item of items) {
        await db.run('UPDATE products SET stock = stock - ?, sales = sales + ? WHERE id = ?', [item.qty, item.qty, item.id]);
      }
    }

    const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);

    // ارسال پیامک تایید سفارش
    let smsResult = null;
    try {
      smsResult = await smsService.sendOrderConfirmation(phone, trackingCode, total);
    } catch (e) {
      console.error('SMS Order Confirm Error:', e);
    }

    // اگر پرداخت آنلاین، درخواست درگاه
    let paymentResult = null;
    if (isOnlinePayment) {
      try {
        paymentResult = await zarinpal.requestPayment({
          amount: total,
          description: `سفارش ${trackingCode} - عطاری شفا`,
          mobile: phone,
          orderId: orderId
        });

        if (paymentResult.success) {
          await db.run('UPDATE orders SET payment_authority = ? WHERE id = ?', [paymentResult.authority, orderId]);
          await db.run(
            'INSERT INTO payments (order_id, tracking_code, authority, amount, status) VALUES (?, ?, ?, ?, ?)',
            [orderId, trackingCode, paymentResult.authority, total, 'pending']
          );
        }
      } catch (e) {
        console.error('Zarinpal Error:', e);
      }
    }

    res.status(201).json({
      ...order,
      items: JSON.parse(order.items),
      sms: smsResult,
      payment: paymentResult ? {
        authority: paymentResult.authority,
        url: paymentResult.url,
        isDemo: paymentResult.isDemo
      } : null,
      nextStep: isOnlinePayment ? 'payment' : 'tracking'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در ثبت سفارش' });
  }
});

// پیگیری سفارش
router.post('/track', async (req, res) => {
  try {
    const db = await getDB();
    const { tracking_code, phone } = req.body;
    if (!tracking_code) return res.status(400).json({ error: 'کد رهگیری الزامی است' });

    let order;
    if (phone) {
      order = await db.get('SELECT * FROM orders WHERE tracking_code = ? AND phone = ?', [tracking_code, phone]);
    } else {
      order = await db.get('SELECT * FROM orders WHERE tracking_code = ?', [tracking_code]);
    }
    if (!order) return res.status(404).json({ error: 'سفارش با این کد یافت نشد' });

    const history = [
      { status: 'در انتظار پرداخت 💳', date: order.created_at, done: true, desc: 'سفارش ثبت شد' },
      { status: 'پرداخت شد ✅', date: order.paid_at, done: !!order.paid_at || order.payment_status === 'paid' || order.payment_status === 'cod', desc: 'پرداخت تایید شد' },
      { status: 'در حال پردازش 🌿', date: null, done: order.status.includes('پردازش') || order.status.includes('تایید') || order.status.includes('بسته') || order.status.includes('ارسال') || order.status.includes('تحویل'), desc: 'در حال بررسی و آماده‌سازی' },
      { status: 'تایید شد ✅', date: null, done: order.status.includes('تایید') || order.status.includes('بسته') || order.status.includes('ارسال') || order.status.includes('تحویل'), desc: 'تایید و ارسال به بسته‌بندی' },
      { status: 'بسته‌بندی شد 📦', date: null, done: order.status.includes('بسته') || order.status.includes('ارسال') || order.status.includes('تحویل'), desc: 'با عشق بسته‌بندی شد' },
      { status: 'ارسال شد 🚚', date: null, done: order.status.includes('ارسال') || order.status.includes('تحویل'), desc: 'تحویل به پست' },
      { status: 'تحویل داده شد 🎉', date: null, done: order.status.includes('تحویل'), desc: 'نوش جان!' },
    ];

    const payment = await db.get('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [order.id]);

    res.json({ ...order, items: JSON.parse(order.items), history, payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در پیگیری' });
  }
});

router.get('/track/:code', async (req, res) => {
  try {
    const db = await getDB();
    const order = await db.get('SELECT * FROM orders WHERE tracking_code = ?', [req.params.code]);
    if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });
    res.json({ ...order, items: JSON.parse(order.items) });
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

router.get('/my', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const orders = await db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
    res.json(orders.map(o => ({ ...o, items: JSON.parse(o.items) })));
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const orders = await db.all('SELECT * FROM orders ORDER BY id DESC');
    res.json(orders.map(o => ({ ...o, items: JSON.parse(o.items) })));
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { status } = req.body;
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });

    await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);

    // ارسال پیامک تغییر وضعیت
    try {
      await smsService.sendOrderStatusUpdate(order.phone, order.tracking_code, status);
    } catch (e) {
      console.error('SMS Status Error:', e);
    }

    const updated = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ ...updated, items: JSON.parse(updated.items) });
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    await db.run('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

module.exports = router;
