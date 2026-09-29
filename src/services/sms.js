/**
 * سرویس پیامک کاوه‌نگار
 * مستندات: https://kavenegar.com/rest.html
 * 
 * برای شخصی‌سازی:
 * 1. از https://panel.kavenegar.com ثبت نام کن
 * 2. API Key بگیر
 * 3. در .env بگذار: KAVENEGAR_API_KEY
 * 4. برای تست: SMS_ENABLED=false تا فقط لاگ شود
 */

const https = require('https');
const querystring = require('querystring');

class SmsService {
  constructor() {
    this.apiKey = process.env.KAVENEGAR_API_KEY || '';
    this.sender = process.env.KAVENEGAR_SENDER || '10004346';
    this.enabled = process.env.SMS_ENABLED === 'true';
    this.otpTemplate = process.env.KAVENEGAR_OTP_TEMPLATE || 'verify-otp';
    this.orderTemplate = process.env.KAVENEGAR_ORDER_TEMPLATE || 'order-confirm';
  }

  /**
   * ارسال پیامک ساده
   */
  async send({ receptor, message }) {
    const { getDB } = require('../db');
    
    // لاگ در دیتابیس
    try {
      const db = await getDB();
      await db.run(
        'INSERT INTO sms_logs (phone, type, message, status) VALUES (?, ?, ?, ?)',
        [receptor, 'simple', message, this.enabled ? 'pending' : 'demo']
      );
    } catch (e) {}

    if (!this.enabled || !this.apiKey || this.apiKey.includes('YOUR_') || this.apiKey.length < 10) {
      console.log(`📱 [SMS DEMO] به ${receptor}: ${message}`);
      return {
        success: true,
        isDemo: true,
        message: 'حالت دمو - پیامک ارسال نشد، فقط لاگ شد',
        receptor,
        text: message
      };
    }

    return new Promise((resolve) => {
      const postData = querystring.stringify({
        receptor: receptor,
        sender: this.sender,
        message: message
      });

      const options = {
        hostname: 'api.kavenegar.com',
        port: 443,
        path: `/v1/${this.apiKey}/sms/send.json`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', async () => {
          try {
            const response = JSON.parse(body);
            console.log('Kavenegar Response:', response);

            if (response.return && response.return.status === 200) {
              // آپدیت لاگ
              try {
                const db = await getDB();
                await db.run(
                  'UPDATE sms_logs SET status=?, kavenegar_id=?, cost=? WHERE phone=? ORDER BY id DESC LIMIT 1',
                  ['sent', response.entries?.[0]?.messageid?.toString() || '', response.entries?.[0]?.cost || 0, receptor]
                );
              } catch (e) {}

              resolve({
                success: true,
                isDemo: false,
                messageId: response.entries?.[0]?.messageid,
                cost: response.entries?.[0]?.cost,
                raw: response
              });
            } else {
              resolve({
                success: false,
                error: response.return?.message || 'خطا در ارسال پیامک',
                raw: response
              });
            }
          } catch (e) {
            console.error('Kavenegar Parse Error:', e, body);
            resolve({ success: false, error: 'خطا در پردازش پاسخ کاوه‌نگار' });
          }
        });
      });

      req.on('error', (e) => {
        console.error('Kavenegar Request Error:', e);
        resolve({ success: false, error: 'خطا در اتصال به کاوه‌نگار: ' + e.message });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * ارسال با الگو (Lookup) - برای OTP و ...
   * باید از قبل در پنل کاوه‌نگار الگو بسازی
   */
  async sendWithTemplate({ receptor, template, tokens }) {
    const { getDB } = require('../db');

    try {
      const db = await getDB();
      await db.run(
        'INSERT INTO sms_logs (phone, type, message, template, status) VALUES (?, ?, ?, ?, ?)',
        [receptor, 'template', JSON.stringify(tokens), template, this.enabled ? 'pending' : 'demo']
      );
    } catch (e) {}

    if (!this.enabled || !this.apiKey || this.apiKey.includes('YOUR_')) {
      console.log(`📱 [SMS TEMPLATE DEMO] به ${receptor} - الگو ${template}:`, tokens);
      return {
        success: true,
        isDemo: true,
        message: 'حالت دمو - الگو ارسال نشد',
        tokens
      };
    }

    return new Promise((resolve) => {
      // tokens به صورت token, token2, token3
      const params = {
        receptor: receptor,
        template: template,
        ...tokens
      };

      const postData = querystring.stringify(params);

      const options = {
        hostname: 'api.kavenegar.com',
        port: 443,
        path: `/v1/${this.apiKey}/verify/lookup.json`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', async () => {
          try {
            const response = JSON.parse(body);
            console.log('Kavenegar Lookup Response:', response);

            if (response.return && response.return.status === 200) {
              try {
                const db = await getDB();
                await db.run(
                  'UPDATE sms_logs SET status=?, kavenegar_id=?, cost=? WHERE phone=? ORDER BY id DESC LIMIT 1',
                  ['sent', response.entries?.[0]?.messageid?.toString() || '', response.entries?.[0]?.cost || 0, receptor]
                );
              } catch (e) {}

              resolve({ success: true, isDemo: false, raw: response });
            } else {
              resolve({ success: false, error: response.return?.message || 'خطا در ارسال الگو', raw: response });
            }
          } catch (e) {
            resolve({ success: false, error: 'خطا در پردازش پاسخ' });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ success: false, error: e.message });
      });

      req.write(postData);
      req.end();
    });
  }

  // ===== متدهای آماده برای عطاری =====

  async sendOTP(phone, code) {
    // اگر الگو داری از template استفاده کن، وگرنه ساده
    if (this.otpTemplate && this.otpTemplate !== 'verify-otp') {
      return this.sendWithTemplate({
        receptor: phone,
        template: this.otpTemplate,
        tokens: { token: code }
      });
    }

    const message = `عطاری شفا 🌿\nکد تایید شما: ${code}\nاین کد تا ۵ دقیقه معتبر است.`;
    return this.send({ receptor: phone, message });
  }

  async sendOrderConfirmation(phone, trackingCode, total) {
    const message = `عطاری شفا 🌿\nسفارش شما با کد ${trackingCode} ثبت شد.\nمبلغ: ${Number(total).toLocaleString('fa-IR')} تومان\nپیگیری: ${process.env.SITE_URL || ''}/#tracking\nسپاس از خرید شما!`;
    return this.send({ receptor: phone, message });
  }

  async sendPaymentSuccess(phone, trackingCode, refId) {
    const message = `عطاری شفا ✅\nپرداخت موفق!\nکد رهگیری: ${trackingCode}\nشماره تراکنش: ${refId}\nسفارش شما در حال آماده‌سازی است.`;
    return this.send({ receptor: phone, message });
  }

  async sendOrderStatusUpdate(phone, trackingCode, newStatus) {
    const message = `عطاری شفا 📦\nسفارش ${trackingCode}\nوضعیت جدید: ${newStatus}\nپیگیری: ${process.env.SITE_URL || ''}`;
    return this.send({ receptor: phone, message });
  }

  async sendSupportReply(phone, chatId) {
    const message = `عطاری شفا 💬\nپاسخ جدید از حکیم در چت مشاوره شما ثبت شد.\nمشاهده: ${process.env.SITE_URL || ''}\nکد چت: ${chatId}`;
    return this.send({ receptor: phone, message });
  }
}

module.exports = new SmsService();
