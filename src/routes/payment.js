const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const zarinpal = require('../services/zarinpal');
const smsService = require('../services/sms');

/**
 * درخواست پرداخت برای یک سفارش
 * POST /api/payment/request
 * body: { orderId }
 */
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { orderId } = req.body;

    if (!orderId) return res.status(400).json({ error: 'شناسه سفارش الزامی است' });

    const order = await db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, req.user.id]);
    if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });

    if (order.payment_status === 'paid') {
      return res.status(400).json({ error: 'این سفارش قبلا پرداخت شده' });
    }

    const amount = order.total;

    // درخواست از زرین‌پال
    const result = await zarinpal.requestPayment({
      amount: amount,
      description: `سفارش ${order.tracking_code} - عطاری شفا`,
      mobile: order.phone,
      orderId: order.id
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'خطا در اتصال به درگاه', details: result });
    }

    // ذخیره authority
    await db.run(
      'UPDATE orders SET payment_authority = ?, payment_amount = ?, payment_status = ? WHERE id = ?',
      [result.authority, amount, 'pending', order.id]
    );

    await db.run(
      'INSERT INTO payments (order_id, tracking_code, authority, amount, status) VALUES (?, ?, ?, ?, ?)',
      [order.id, order.tracking_code, result.authority, amount, 'pending']
    );

    res.json({
      success: true,
      authority: result.authority,
      url: result.url,
      isDemo: result.isDemo || false,
      message: result.message || 'در حال انتقال به درگاه...'
    });
  } catch (err) {
    console.error('Payment Request Error:', err);
    res.status(500).json({ error: 'خطا در درخواست پرداخت' });
  }
});

/**
 * تایید پرداخت - کال‌بک از زرین‌پال
 * GET /api/payment/verify?Authority=...&Status=OK&order_id=...
 */
router.get('/verify', async (req, res) => {
  try {
    const db = await getDB();
    const { Authority, Status, order_id } = req.query;

    console.log('Payment Verify Callback:', { Authority, Status, order_id });

    if (!Authority) {
      return res.redirect(`${process.env.SITE_URL || 'http://localhost:3000'}/#payment-failed?error=no_authority`);
    }

    // پیدا کردن سفارش
    let order;
    if (order_id) {
      order = await db.get('SELECT * FROM orders WHERE id = ?', [order_id]);
    } else {
      order = await db.get('SELECT * FROM orders WHERE payment_authority = ?', [Authority]);
    }

    if (!order) {
      return res.redirect(`${process.env.SITE_URL || 'http://localhost:3000'}/#payment-failed?error=order_not_found`);
    }

    if (Status !== 'OK') {
      // پرداخت لغو شد
      await db.run('UPDATE orders SET payment_status = ?, status = ? WHERE id = ?', ['failed', 'لغو پرداخت ❌', order.id]);
      await db.run('UPDATE payments SET status = ? WHERE authority = ?', ['failed', Authority]);

      return res.redirect(`${process.env.SITE_URL || 'http://localhost:3000'}/#payment-failed?tracking=${order.tracking_code}`);
    }

    // تایید از زرین‌پال
    const verifyResult = await zarinpal.verifyPayment({
      authority: Authority,
      amount: order.total
    });

    if (verifyResult.success) {
      // پرداخت موفق
      await db.run(
        'UPDATE orders SET payment_status = ?, payment_ref_id = ?, status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['paid', verifyResult.refId, 'پرداخت شد ✅ - در حال پردازش 🌿', order.id]
      );

      await db.run(
        'UPDATE payments SET status = ?, ref_id = ?, card_pan = ?, verified_at = CURRENT_TIMESTAMP WHERE authority = ?',
        ['paid', verifyResult.refId, verifyResult.cardPan || '', Authority]
      );

      // ارسال پیامک تایید پرداخت
      try {
        await smsService.sendPaymentSuccess(order.phone, order.tracking_code, verifyResult.refId);
      } catch (e) {
        console.error('SMS Error:', e);
      }

      return res.redirect(`${process.env.SITE_URL || 'http://localhost:3000'}/#payment-success?tracking=${order.tracking_code}&ref=${verifyResult.refId}`);
    } else {
      // تایید ناموفق
      await db.run('UPDATE orders SET payment_status = ?, status = ? WHERE id = ?', ['failed', 'خطا در تایید پرداخت ❌', order.id]);
      await db.run('UPDATE payments SET status = ? WHERE authority = ?', ['failed', Authority]);

      return res.redirect(`${process.env.SITE_URL || 'http://localhost:3000'}/#payment-failed?tracking=${order.tracking_code}&error=${encodeURIComponent(verifyResult.error || 'verification_failed')}`);
    }
  } catch (err) {
    console.error('Payment Verify Error:', err);
    return res.redirect(`${process.env.SITE_URL || 'http://localhost:3000'}/#payment-failed?error=server_error`);
  }
});

/**
 * بررسی وضعیت پرداخت یک سفارش
 * GET /api/payment/status/:orderId
 */
router.get('/status/:orderId', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const order = await db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.orderId, req.user.id]);
    if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });

    const payment = await db.get('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [order.id]);

    res.json({
      order_id: order.id,
      tracking_code: order.tracking_code,
      payment_status: order.payment_status,
      payment_authority: order.payment_authority,
      payment_ref_id: order.payment_ref_id,
      total: order.total,
      status: order.status,
      payment: payment || null
    });
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

/**
 * لیست پرداخت‌ها - ادمین
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'دسترسی ادمین' });
    const db = await getDB();
    const payments = await db.all('SELECT * FROM payments ORDER BY id DESC LIMIT 100');
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

module.exports = router;
