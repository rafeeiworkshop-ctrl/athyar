# 🌿 عطاری شفا - فروشگاه فول‌استک آماده سرور

فروشگاه اینترنتی عطاری با طراحی عرفانی (سبز و نارنجی)، دو پنل کاربری و مدیریت، بک‌اند Node.js + دیتابیس SQLite آماده آپلود روی سرور.

---

## ✨ ویژگی‌ها

### فرانت‌اند (همان طراحی قبلی + اتصال به API)
- رنگ‌های سبز عرفانی و نارنجی با کنتراست بالا
- المان‌های برگ و گلبرگ، حالت شیشه‌ای، انیمیشن‌های عرفانی
- دسته‌بندی، جستجوی زنده، فیلتر (جدیدترین، گران‌ترین، ارزان‌ترین، پرفروش، تخفیف‌دار، ارگانیک)
- سبد خرید، علاقه‌مندی، صفحه محصول با گالری
- حساب کاربری با شماره موبایل (OTP)
- ثبت آدرس و سفارش

### بک‌اند (Node.js + Express + SQLite)
- **احراز هویت JWT**: کاربران با OTP (دمو 1234)، مدیر با رمز
- **محصولات**: CRUD کامل، موجودی، تخفیف، جشنواره، ارگانیک
- **بنرها**: مدیریت اسلایدر اصلی
- **سفارشات**: ثبت، لیست، تغییر وضعیت، ذخیره در دیتابیس
- **آپلود تصویر**: Multer - ذخیره در `public/uploads`
- **دیتابیس**: SQLite - فایل `data/database.sqlite` - بدون نیاز به نصب MySQL
- **امنیت**: CORS، JWT، اعتبارسنجی

---

## 🚀 تست روی لپ‌تاپ (ویندوز / مک / لینوکس)

### پیش‌نیاز
- Node.js 18+ نصب باشد (از nodejs.org)

### مراحل

```bash
# 1. پوشه را باز کن
cd attari-shop

# 2. نصب پکیج‌ها
npm install

# 3. مقداردهی دیتابیس با 12 محصول و 2 بنر پیشفرض
npm run seed

# 4. اجرای سرور
npm start
# یا برای حالت توسعه با auto-reload:
npm run dev
```

حالا برو به:
- 🌐 سایت: http://localhost:3000
- 📊 سلامت API: http://localhost:3000/api/health
- 🔐 ورود مدیر: در سایت روی "ورود مدیر" کلیک کن
  - شماره: `09120000000`
  - رمز: `1234`
- 📱 ورود کاربر: هر شماره‌ای بزن، کد `1234`

---

## 📁 ساختار پروژه

```
attari-shop/
├── src/
│   ├── server.js          # سرور اصلی Express
│   ├── db.js              # اتصال SQLite و ساخت جداول
│   ├── seed.js            # داده اولیه (12 محصول عطاری)
│   ├── middleware/auth.js # JWT + Admin check
│   └── routes/
│       ├── auth.js        # OTP، لاگین مدیر، me
│       ├── products.js    # CRUD محصولات
│       ├── banners.js     # CRUD بنرها
│       ├── orders.js      # ثبت و مدیریت سفارشات
│       ├── categories.js  # دسته‌بندی‌ها
│       └── upload.js      # آپلود تصویر
├── public/
│   ├── index.html         # فرانت‌اند (SPA - متصل به API)
│   └── uploads/           # تصاویر آپلود شده
├── data/
│   └── database.sqlite    # فایل دیتابیس (auto create)
├── .env                   # تنظیمات محلی
├── .env.example           # نمونه برای سرور
├── package.json
├── ecosystem.config.js    # برای PM2
└── README.md
```

---

## 🌍 آپلود روی سرور (Ubuntu 22.04)

### 1. سرور را آماده کن

```bash
# روی سرور (با SSH)
sudo apt update
sudo apt install nodejs npm nginx -y
node -v # باید 18+ باشد، اگر نبود از nodesource نصب کن
sudo npm install -g pm2
```

اگر Node قدیمی است:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. پروژه را آپلود کن

```bash
# از لپ‌تاپ با SCP یا از گیت
scp -r attari-shop/ user@YOUR_SERVER_IP:/home/user/

# روی سرور
cd /home/user/attari-shop
npm install --production
```

### 3. تنظیم .env برای پروداکشن

```bash
nano .env
```
مقدارها را تغییر بده:
```
PORT=3000
NODE_ENV=production
JWT_SECRET=یک_رمز_خیلی_طولانی_و_تصادفی_اینجا_بگذار_مثلا_64_کاراکتر
ADMIN_PHONE=0912XXXXXXX
ADMIN_PASSWORD=رمز_قوی_مدیر
DB_PATH=./data/database.sqlite
```

### 4. Seed اولیه

```bash
npm run seed
```

### 5. اجرا با PM2 (اجرای دائمی)

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
# دستوری که می‌دهد را کپی و اجرا کن
pm2 logs # برای دیدن لاگ
```

### 6. تنظیم Nginx به عنوان Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/attari
```

محتوای زیر را بگذار (دامنه خودت را جایگزین کن):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # برای آپلودهای حجیم
    client_max_body_size 10M;
}
```

فعال‌سازی:

```bash
sudo ln -s /etc/nginx/sites-available/attari /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. SSL با Let's Encrypt (اختیاری ولی پیشنهادی)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🔧 مدیریت بعد از دیپلوی

```bash
# دیدن لاگ‌ها
pm2 logs attari-shafa

# ریستارت
pm2 restart attari-shafa

# بک‌آپ دیتابیس (فقط کپی فایل!)
cp data/database.sqlite data/backup-$(date +%F).sqlite

# آپدیت کد جدید
git pull # یا آپلود مجدد
npm install
pm2 restart attari-shafa
```

---

## 🔐 امنیت در پروداکشن

- حتما `JWT_SECRET` را عوض کن (یک رشته 64 کاراکتری تصادفی)
- `ADMIN_PASSWORD` قوی بگذار
- فایل `data/` را بک‌آپ منظم بگیر
- برای OTP واقعی، سرویس کاوه‌نگار یا ملی‌پیامک را به `routes/auth.js` اضافه کن (فعلا 1234 است)
- پوشه `public/uploads` را از اجرای اسکریپت محافظت کن (در Nginx)

---

## 📦 API Endpoints

| Method | Path | توضیح | دسترسی |
|--------|------|-------|--------|
| POST | /api/auth/send-otp | ارسال کد | public |
| POST | /api/auth/verify-otp | تایید کد و گرفتن توکن | public |
| POST | /api/auth/admin-login | لاگین مدیر | public |
| GET | /api/auth/me | اطلاعات من | user |
| GET | /api/products | لیست با فیلتر ?search=&category=&filter=&sort= | public |
| GET | /api/products/:id | جزئیات | public |
| POST | /api/products | افزودن | admin |
| PUT | /api/products/:id | ویرایش | admin |
| DELETE | /api/products/:id | حذف | admin |
| GET | /api/banners | لیست بنرها | public |
| POST | /api/banners | افزودن بنر | admin |
| PUT | /api/banners/:id | ویرایش بنر | admin |
| DELETE | /api/banners/:id | حذف بنر | admin |
| POST | /api/orders | ثبت سفارش | user |
| GET | /api/orders/my | سفارشات من | user |
| GET | /api/orders | همه سفارشات | admin |
| PUT | /api/orders/:id/status | تغییر وضعیت | admin |
| POST | /api/upload | آپلود تصویر | admin |
| GET | /api/health | سلامت سرور | public |

---

## 🛠️ توسعه بیشتر

- اتصال درگاه پرداخت زرین‌پال: در `placeOrder` فرانت‌اند، بعد از ثبت سفارش به درگاه بفرست
- ارسال پیامک واقعی: در `send-otp` از API کاوه‌نگار استفاده کن
- تبدیل SQLite به MySQL/Postgres: فقط `db.js` را عوض کن (از Prisma یا Sequelize)
- پنل SMS و ایمیل برای اطلاع سفارش جدید

---

## 📞 پشتیبانی

اگر روی سرور به مشکل خوردی:
1. `pm2 logs` را چک کن
2. `cat .env` مطمئن شو PORT آزاد است
3. `ls -lh data/` ببین دیتابیس ساخته شده
4. `curl http://localhost:3000/api/health` روی سرور تست کن

موفق باشی! 🌿✨

