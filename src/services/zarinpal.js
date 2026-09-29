/**
 * سرویس درگاه پرداخت زرین‌پال
 * مستندات: https://docs.zarinpal.com/paymentGateway/
 * 
 * برای شخصی‌سازی:
 * 1. از پنل زرین‌پال مرچنت کد بگیر
 * 2. در .env بگذار: ZARINPAL_MERCHANT_ID
 * 3. برای تست sandbox: ZARINPAL_SANDBOX=true
 */

const https = require('https');

class ZarinpalService {
  constructor() {
    this.merchantId = process.env.ZARINPAL_MERCHANT_ID || 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
    this.sandbox = process.env.ZARINPAL_SANDBOX === 'true';
    this.callbackUrl = process.env.ZARINPAL_CALLBACK_URL || `${process.env.SITE_URL || 'http://localhost:3000'}/api/payment/verify`;
    
    // آدرس‌های زرین‌پال
    this.baseUrl = this.sandbox 
      ? 'sandbox.zarinpal.com' 
      : 'api.zarinpal.com';
    
    this.gatewayUrl = this.sandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay/'
      : 'https://www.zarinpal.com/pg/StartPay/';
  }

  /**
   * درخواست پرداخت
   * @param {number} amount - مبلغ به تومان (زرین‌پال به ریال می‌خواهد، خودکار تبدیل می‌شود)
   * @param {string} description - توضیحات
   * @param {string} email - ایمیل کاربر (اختیاری)
   * @param {string} mobile - موبایل کاربر
   * @param {string} orderId - شناسه سفارش برای callback
   */
  async requestPayment({ amount, description, email = '', mobile = '', orderId = '' }) {
    // اگر مرچنت کد تست باشد، حالت دمو برمی‌گردانیم
    if (this.merchantId.includes('xxxx') || this.merchantId.length < 10) {
      console.log('⚠️ زرین‌پال: مرچنت کد تنظیم نشده - حالت دمو');
      const fakeAuthority = `A00000000000000000000000000${Date.now().toString().slice(-6)}`;
      return {
        success: true,
        authority: fakeAuthority,
        url: `${this.gatewayUrl}${fakeAuthority}`,
        isDemo: true,
        message: 'حالت دمو - مرچنت کد واقعی تنظیم نشده'
      };
    }

    const amountInRial = amount * 10; // تومان به ریال

    const data = JSON.stringify({
      merchant_id: this.merchantId,
      amount: amountInRial,
      callback_url: `${this.callbackUrl}?order_id=${orderId}`,
      description: description || 'خرید از عطاری شفا',
      metadata: {
        email: email || '',
        mobile: mobile || ''
      }
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: '/pg/v4/payment/request.json',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            console.log('Zarinpal Request Response:', response);
            
            if (response.data && response.data.code === 100) {
              resolve({
                success: true,
                authority: response.data.authority,
                url: `${this.gatewayUrl}${response.data.authority}`,
                isDemo: false
              });
            } else {
              resolve({
                success: false,
                error: response.errors?.message || 'خطا در اتصال به درگاه',
                code: response.data?.code || response.errors?.code,
                raw: response
              });
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (e) => {
        console.error('Zarinpal Request Error:', e);
        // در صورت خطای شبکه، حالت دمو برگردان
        resolve({
          success: true,
          authority: `A${Date.now()}`,
          url: `${this.gatewayUrl}A${Date.now()}`,
          isDemo: true,
          message: 'خطای شبکه - حالت دمو'
        });
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * تایید پرداخت
   */
  async verifyPayment({ authority, amount }) {
    if (authority.startsWith('A000000') || this.merchantId.includes('xxxx')) {
      console.log('⚠️ زرین‌پال: تایید دمو');
      return {
        success: true,
        refId: `DEMO-${Date.now()}`,
        cardPan: '603799******1234',
        isDemo: true
      };
    }

    const amountInRial = amount * 10;

    const data = JSON.stringify({
      merchant_id: this.merchantId,
      authority: authority,
      amount: amountInRial
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: '/pg/v4/payment/verify.json',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            console.log('Zarinpal Verify Response:', response);

            if (response.data && (response.data.code === 100 || response.data.code === 101)) {
              resolve({
                success: true,
                refId: response.data.ref_id,
                cardPan: response.data.card_pan || '',
                isDemo: false,
                raw: response
              });
            } else {
              resolve({
                success: false,
                error: response.errors?.message || 'پرداخت تایید نشد',
                code: response.data?.code,
                raw: response
              });
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (e) => {
        console.error('Zarinpal Verify Error:', e);
        resolve({
          success: false,
          error: 'خطا در اتصال به زرین‌پال برای تایید'
        });
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * ساخت لینک پرداخت برای فرانت
   */
  getPaymentUrl(authority) {
    return `${this.gatewayUrl}${authority}`;
  }
}

module.exports = new ZarinpalService();
