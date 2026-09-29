# 💳 درگاه زرین‌پال + 📱 پیامک کاوه‌نگار - راهنمای شخصی‌سازی

این راهنما برای توست که خودت تنظیمات را شخصی‌سازی کنی.

---

## 💳 زرین‌پال

### 1. دریافت مرچنت کد
- برو به https://www.zarinpal.com/panel/
- ثبت نام → احراز هویت → ایجاد درگاه
- مرچنت کد (36 کاراکتری) را کپی کن
- برای تست: https://sandbox.zarinpal.com/panel/ مرچنت کد سندباکس بگیر

### 2. تنظیم در `.env`

```env
ZARINPAL_MERCHANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ZARINPAL_SANDBOX=false
ZARINPAL_CALLBACK_URL=https://yourdomain.com/api/payment/verify
SITE_URL=https://yourdomain.com
```

- `SANDBOX=true` برای تست، `false` برای واقعی
- `CALLBACK_URL` باید دقیقا همان چیزی باشد که در پنل زرین‌پال به عنوان آدرس بازگشت ثبت می‌کنی
- برای لوکال: `http://localhost:3000/api/payment/verify`

### 3. نحوه کار

**فرانت‌اند:**
1. کاربر سبد را پر می‌کند → آدرس دقیق + نقشه → انتخاب **پرداخت آنلاین**
2. `POST /api/orders` → سفارش با `payment_status=pending` ساخته می‌شود
3. خودکار `POST /api/payment/request` → درخواست به زرین‌پال → `authority` + `url`
4. کاربر به `https://www.zarinpal.com/pg/StartPay/{authority}` ریدایرکت می‌شود
5. بعد از پرداخت، زرین‌پال به `GET /api/payment/verify?Authority=...&Status=OK` برمی‌گردد
6. سرور `verifyPayment` می‌کند → اگر موفق: `payment_status=paid`, `status=پرداخت شد ✅`
7. ریدایرکت به `/#payment-success?tracking=SHF...&ref=...`

**کدها:**
- سرویس: `src/services/zarinpal.js`
  - `requestPayment({amount, description, mobile, orderId})`
  - `verifyPayment({authority, amount})`
  - اگر مرچنت کد تنظیم نشده باشد، خودکار حالت دمو برمی‌گردد (بدون نیاز به درگاه واقعی)

**شخصی‌سازی:**
- در `zarinpal.js` می‌توانی `description` را عوض کنی
- مبلغ: زرین‌پال ریال می‌خواهد، ما خودکار `*10` می‌کنیم (تومان → ریال)
- اگر می‌خواهی مالیات اضافه کنی، در `orders.js` قبل از `requestPayment` محاسبه کن

### 4. تست

```bash
# حالت دمو (بدون مرچنت کد واقعی)
# فقط سفارش بده و ببین که url فیک می‌سازد و پیام دمو می‌دهد

# حالت سندباکس
ZARINPAL_MERCHANT_ID=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
ZARINPAL_SANDBOX=true
# از پنل سندباکس یک کارت تست بگیر
```

---

## 📱 کاوه‌نگار

### 1. دریافت API Key
- https://panel.kavenegar.com → ثبت نام → داشبورد → تنظیمات → API Key
- یک شماره اختصاصی (مثلا 10004346) بگیر

### 2. تنظیم در `.env`

```env
KAVENEGAR_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
KAVENEGAR_SENDER=10004346
SMS_ENABLED=true
KAVENEGAR_OTP_TEMPLATE=verify-otp
KAVENEGAR_ORDER_TEMPLATE=order-confirm
SITE_URL=https://yourdomain.com
```

- `SMS_ENABLED=false` → حالت دمو، فقط در کنسول لاگ می‌شود
- `true` → واقعا ارسال می‌شود

### 3. الگوها (Lookup) - پیشنهادی

برای OTP بهتر است از الگو استفاده کنی تا هزینه کمتر و تحویل سریع‌تر:

**در پنل کاوه‌نگار → الگوها → ایجاد الگوی جدید:**

الگوی OTP:
```
نام: verify-otp
متن: عطاری شفا 🌿 کد تایید شما %token
متغیر: token
```

الگوی سفارش:
```
نام: order-confirm
متن: عطاری شفا 🌿 سفارش %token ثبت شد. کد رهگیری: %token2 مبلغ: %token3
متغیرها: token, token2, token3
```

بعد نام الگوها را در `.env` بگذار.

**اگر الگو نساختی، سیستم خودکار از `sms/send.json` (پیام ساده) استفاده می‌کند.**

### 4. کجاها پیامک می‌رود؟

**سرویس:** `src/services/sms.js`

- `sendOTP(phone, code)` → در `routes/auth.js` هنگام `send-otp`
- `sendOrderConfirmation(phone, trackingCode, total)` → بعد از `POST /api/orders`
- `sendPaymentSuccess(phone, trackingCode, refId)` → بعد از `verify` موفق زرین‌پال
- `sendOrderStatusUpdate(phone, trackingCode, newStatus)` → وقتی ادمین وضعیت سفارش را عوض می‌کند
- `sendSupportReply(phone, chatId)` → وقتی ادمین در چت پاسخ می‌دهد

همه پیامک‌ها در جدول `sms_logs` ذخیره می‌شوند و در پنل ادمین → **پیامک‌ها** قابل مشاهده است.

### 5. شخصی‌سازی متن پیامک

در `src/services/sms.js` این توابع را ادیت کن:

```js
async sendOTP(phone, code) {
  const message = `عطاری شفا 🌿\nکد تایید شما: ${code}\n...`;
  // متن را اینجا عوض کن
  return this.send({ receptor: phone, message });
}
```

یا اگر از الگو استفاده می‌کنی:

```js
return this.sendWithTemplate({
  receptor: phone,
  template: 'verify-otp',
  tokens: { token: code, token2: '...', token3: '...' }
});
```

### 6. تست

```bash
# حالت دمو
SMS_ENABLED=false
# لاگ در کنسول: [SMS DEMO] به 0912...

# حالت واقعی
SMS_ENABLED=true
KAVENEGAR_API_KEY=واقعی
# یک OTP بفرست و ببین پیامک می‌آید
curl -X POST http://localhost:3000/api/auth/send-otp -H "Content-Type: application/json" -d '{"phone":"09120000000"}'
```

---

## 🔗 ترکیب پرداخت + پیامک

**سناریوی کامل:**

1. کاربر سفارش می‌دهد (پرداخت آنلاین)
2. `sms: order-confirm` → کد رهگیری
3. ریدایرکت به زرین‌پال
4. پرداخت موفق → `verify` → `sms: payment-success` → refId
5. ادمین وضعیت را به "ارسال شد" تغییر می‌دهد → `sms: status-update`

**همه در `sms_logs` و `payments` لاگ می‌شود.**

---

## 🛠️ فایل‌های کلیدی برای شخصی‌سازی

- `src/services/zarinpal.js` → منطق درگاه
- `src/services/sms.js` → متن‌ها و الگوها
- `src/routes/payment.js` → درخواست و تایید
- `src/routes/orders.js` → بعد از ثبت سفارش
- `src/routes/auth.js` → OTP
- `public/index.html` → `placeOrder()`, `handlePaymentCallback()`, `updatePaymentMethod()`

---

## ❓ سوالات رایج

**Q: می‌خواهم پرداخت در محل پیشفرض باشد؟**
A: در `public/index.html` → `updatePaymentMethod()` → `value="cod"` را checked کن.

**Q: می‌خواهم فقط پرداخت آنلاین باشد؟**
A: در `index.html` بخش `payCodLabel` را حذف کن و `paymentMethod` را همیشه `online` بفرست.

**Q: هزینه ارسال اضافه کنم؟**
A: در `orders.js` قبل از `total`، `shippingCost` اضافه کن و در فرانت در `checkoutTotal` نمایش بده.

**Q: کاوه‌نگار خطای 411 می‌دهد؟**
A: الگو وجود ندارد یا نامش اشتباه است. از `send` ساده استفاده کن یا الگو بساز.

**Q: زرین‌پال خطای 15- تراکنش قبلا تایید شده؟**
A: کد 101 هم موفق است - در `zarinpal.js` ما 100 و 101 را موفق حساب می‌کنیم.

موفق باشی! 🌿
