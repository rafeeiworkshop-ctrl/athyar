require('dotenv').config();
const { getDB } = require('./db');

const defaultCategories = [
  { id: 'herbal-tea', name: 'دمنوش‌های گیاهی', icon: '🍵', color: '#E0F2E9', count: 0, description: 'دمنوش‌های آرامش‌بخش و درمانی از ترکیب بهترین گیاهان', image: '' },
  { id: 'spices', name: 'ادویه جات', icon: '🌶️', color: '#FFEDD5', count: 0, description: 'ادویه‌های دست‌چین و تازه از بهترین مزارع', image: '' },
  { id: 'oils', name: 'روغن‌های گیاهی', icon: '🫒', color: '#FEF3C7', count: 0, description: 'روغن‌های پرس سرد و خالص برای سلامتی و زیبایی', image: '' },
  { id: 'honey', name: 'عسل طبیعی', icon: '🍯', color: '#FEF9C3', count: 0, description: 'عسل‌های طبیعی و خام از زنبورستان‌های کوهستانی', image: '' },
  { id: 'dried-fruits', name: 'میوه خشک', icon: '🍎', color: '#FFEDD5', count: 0, description: 'میوه‌های خشک شده طبیعی بدون شکر افزوده', image: '' },
  { id: 'handicrafts', name: 'صنایع دستی', icon: '🏺', color: '#F5E6D3', count: 0, description: 'ظروف و ابزار دست‌ساز برای زندگی سالم و اصیل', image: '' },
  { id: 'distillates', name: 'عرقیات', icon: '💧', color: '#DBEAFE', count: 0, description: 'عرقیات دوآتشه و سنتی با عطر اصیل', image: '' },
  { id: 'dried', name: 'خشکبار دارویی', icon: '🍇', color: '#FCE7F3', count: 0, description: 'خشکبار دارویی و گیاهان خشک', image: '' },
];

const defaultProducts = [
  // محصولات قبلی
  { name: 'زعفران سوپر نگین قائنات', category: 'spices', price: 485000, old_price: 620000, stock: 42, discount: 22, is_festival: 1, is_new: 0, sales: 187, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1506368249639-73a05d4f6488?w=600']), description: 'زعفران دست‌چین مزارع قائنات، عطر و رنگ بی‌نظیر.', benefits: JSON.stringify(['آرامش اعصاب', 'تقویت قلب', 'شادی آور']), usage_text: 'نصف قاشق چای‌خوری در چای یا برنج دم کنید.' },
  { name: 'دمنوش آرامش ۷ گیاه', category: 'herbal-tea', price: 185000, old_price: 0, stock: 68, discount: 0, is_festival: 0, is_new: 1, sales: 92, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=600']), description: 'ترکیب اسطوخودوس، بابونه، بادرنجبویه، سنبل‌الطیب، گل گاوزبان، بهارنارنج و زعفران.', benefits: JSON.stringify(['خواب عمیق', 'کاهش استرس', 'تعادل روح']), usage_text: 'یک قاشق در آب ۸۰ درجه، ۱۰ دقیقه دم.' },
  { name: 'روغن آرگان خالص', category: 'oils', price: 395000, old_price: 495000, stock: 15, discount: 20, is_festival: 1, is_new: 0, sales: 143, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1608571423902-eed4a94d8108?w=600']), description: 'روغن آرگان پرس سرد، برای پوست و مو.', benefits: JSON.stringify(['جوانسازی پوست', 'تقویت مو']), usage_text: 'چند قطره شب‌ها با ماساژ.' },
  { name: 'چای ترش ارگانیک', category: 'herbal-tea', price: 98000, old_price: 0, stock: 120, discount: 0, is_festival: 0, is_new: 0, sales: 210, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600']), description: 'چای ترش مزارع سیستان، سرشار از آنتی‌اکسیدان.', benefits: JSON.stringify(['کاهش فشار', 'لاغری']), usage_text: 'یک قاشق در آب جوش، ۵ دقیقه دم.' },
  
  // ===== عسل طبیعی - جدید =====
  { name: 'عسل آویشن کوهستان - طبیعی', category: 'honey', price: 320000, old_price: 380000, stock: 35, discount: 15, is_festival: 1, is_new: 1, sales: 124, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1558642084-5d07fae4d90c?w=600', 'https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=600']), description: 'عسل آویشن خالص از ارتفاعات زاگرس، عطر و طعم بی‌نظیر، سرشار از خاصیت.', benefits: JSON.stringify(['تقویت ایمنی', 'ضد سرفه', 'انرژی طبیعی']), usage_text: 'یک قاشق صبح ناشتا با آب ولرم.' },
  { name: 'عسل کنار سدر جنوب', category: 'honey', price: 450000, old_price: 0, stock: 22, discount: 0, is_festival: 0, is_new: 1, sales: 89, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=600']), description: 'عسل کنار اصل از درختان سدر جنوب، طبع گرم، بسیار مقوی.', benefits: JSON.stringify(['تقویت قوای جسمانی', 'خونساز', 'مقوی معده']), usage_text: 'روزانه یک قاشق.' },
  { name: 'عسل چهل گیاه ارگانیک', category: 'honey', price: 280000, old_price: 320000, stock: 48, discount: 12, is_festival: 1, is_new: 0, sales: 156, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1558642084-5d07fae4d90c?w=600']), description: 'عسل چهل گیاه از دشت‌های پرگل، ترکیب بی‌نظیر از شهد گل‌های مختلف.', benefits: JSON.stringify(['تقویت عمومی', 'آرامش', 'ضد التهاب']), usage_text: 'همراه با شیر یا دمنوش.' },
  { name: 'عسل با موم طبیعی', category: 'honey', price: 380000, old_price: 0, stock: 18, discount: 0, is_festival: 0, is_new: 1, sales: 67, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=600']), description: 'عسل با موم طبیعی، کاملا خام و تصفیه نشده، جویدنی و مقوی.', benefits: JSON.stringify(['سلامت دهان', 'تقویت لثه', 'انرژی']), usage_text: 'موم را بجوید و عسلش را میل کنید.' },

  // ===== میوه خشک - جدید =====
  { name: 'برگه زردآلو ارگانیک', category: 'dried-fruits', price: 165000, old_price: 195000, stock: 75, discount: 15, is_festival: 1, is_new: 0, sales: 134, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1615484477778-ca3b7795891b?w=600', 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600']), description: 'برگه زردآلو خشک شده طبیعی، بدون شکر، ترش و شیرین و مقوی.', benefits: JSON.stringify(['فیبر بالا', 'ویتامین A', 'انرژی']), usage_text: 'میان‌وعده سالم، ۴-۵ عدد در روز.' },
  { name: 'توت سفید خشک اعلا', category: 'dried-fruits', price: 135000, old_price: 0, stock: 92, discount: 0, is_festival: 0, is_new: 1, sales: 178, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1615484477778-ca3b7795891b?w=600']), description: 'توت سفید خشک شده، شیرین طبیعی، جایگزین قند.', benefits: JSON.stringify(['انرژی سریع', 'آهن', 'شیرین طبیعی']), usage_text: 'همراه با چای یا به تنهایی.' },
  { name: 'سیب خشک چیپسی', category: 'dried-fruits', price: 125000, old_price: 145000, stock: 64, discount: 14, is_festival: 1, is_new: 0, sales: 98, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1615484477778-ca3b7795891b?w=600']), description: 'چیپس سیب خشک، ترد و خوشمزه، بدون روغن.', benefits: JSON.stringify(['فیبر', 'کم کالری', 'ویتامین']), usage_text: 'میان‌وعده رژیمی.' },
  { name: 'انجیر خشک استهبان', category: 'dried-fruits', price: 185000, old_price: 0, stock: 56, discount: 0, is_festival: 0, is_new: 0, sales: 112, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600']), description: 'انجیر خشک درشت استهبان، شیرین و مقوی، سرشار از کلسیم.', benefits: JSON.stringify(['کلسیم', 'فیبر', 'انرژی']), usage_text: '۳ عدد روزانه.' },
  { name: 'مخلوط میوه خشک ویژه', category: 'dried-fruits', price: 245000, old_price: 290000, stock: 38, discount: 15, is_festival: 1, is_new: 1, sales: 76, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1615484477778-ca3b7795891b?w=600']), description: 'میکس میوه خشک: سیب، زردآلو، توت، انجیر، کیوی - بسته پذیرایی.', benefits: JSON.stringify(['ویتامین‌های متنوع', 'پذیرایی سالم']), usage_text: 'برای مهمانی و میان‌وعده.' },

  // ===== صنایع دستی - جدید =====
  { name: 'هاون سنگی دست‌ساز', category: 'handicrafts', price: 385000, old_price: 450000, stock: 12, discount: 14, is_festival: 1, is_new: 1, sales: 45, is_organic: 0, images: JSON.stringify(['https://images.unsplash.com/photo-1608111113073-0b61a7953e26?w=600', 'https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?w=600']), description: 'هاون سنگی دست‌ساز از سنگ مرمر، برای کوبیدن ادویه و گیاهان، ماندگار و زیبا.', benefits: JSON.stringify(['حفظ عطر ادویه', 'بادوام', 'زیبایی آشپزخانه']), usage_text: 'برای کوبیدن زعفران، هل و ادویه‌ها.' },
  { name: 'ظرف سفالی لعاب‌دار', category: 'handicrafts', price: 245000, old_price: 0, stock: 20, discount: 0, is_festival: 0, is_new: 1, sales: 34, is_organic: 0, images: JSON.stringify(['https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?w=600']), description: 'ظرف سفالی دست‌ساز لعاب‌دار، برای نگهداری ادویه و عسل، هنر دست هنرمندان.', benefits: JSON.stringify(['نگهداری طبیعی', 'هنر اصیل', 'سالم']), usage_text: 'برای نگهداری زعفران، ادویه و خشکبار.' },
  { name: 'قاشق چوبی زیتون دست‌ساز', category: 'handicrafts', price: 85000, old_price: 110000, stock: 45, discount: 22, is_festival: 1, is_new: 0, sales: 89, is_organic: 0, images: JSON.stringify(['https://images.unsplash.com/photo-1608111113073-0b61a7953e26?w=600']), description: 'ست ۳ عددی قاشق چوبی از چوب زیتون، برای عسل و ادویه، ضد باکتری.', benefits: JSON.stringify(['طبیعی', 'ضد باکتری', 'مناسب عسل']), usage_text: 'برای برداشتن عسل و ادویه - قاشق فلزی برای عسل مناسب نیست.' },
  { name: 'سینی چوبی گردو', category: 'handicrafts', price: 320000, old_price: 0, stock: 15, discount: 0, is_festival: 0, is_new: 1, sales: 28, is_organic: 0, images: JSON.stringify(['https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?w=600']), description: 'سینی چوب گردو دست‌ساز، برای پذیرایی میوه خشک و دمنوش.', benefits: JSON.stringify(['زیبایی', 'مقاوم', 'هنر دست']), usage_text: 'برای سرو میوه خشک و دمنوش.' },

  // محصولات قبلی بیشتر
  { name: 'عرق نعنا دوآتشه کاشان', category: 'distillates', price: 75000, old_price: 0, stock: 85, discount: 0, is_festival: 0, is_new: 0, sales: 165, is_organic: 0, images: JSON.stringify(['https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=600']), description: 'عرق نعنا با عطر تند و خنک.', benefits: JSON.stringify(['هضم', 'خنک کننده']), usage_text: 'یک استکان بعد غذا.' },
  { name: 'گل محمدی کاشان', category: 'dried', price: 165000, old_price: 0, stock: 44, discount: 0, is_festival: 0, is_new: 1, sales: 112, is_organic: 1, images: JSON.stringify(['https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600']), description: 'غنچه گل محمدی ارگانیک.', benefits: JSON.stringify(['آرامش', 'عطر درمانی']), usage_text: '۵ غنچه در قوری چای.' },
];

const defaultBanners = [
  { title: 'طعم اصیل طبیعت در اثیار', subtitle: 'عسل، میوه خشک و گیاهان دارویی', description: 'از زنبورستان‌های زاگرس تا باغ‌های ارگانیک - با عشق به دست شما می‌رسد', cta: 'مشاهده محصولات', color: 'green', image: '', active: 1 },
  { title: 'صنایع دستی برای زندگی سالم', subtitle: 'هاون سنگی، ظروف سفالی، قاشق چوبی', description: 'ابزارهای طبیعی برای حفظ عطر و خاصیت گیاهان و عسل', cta: 'دیدن صنایع دستی', color: 'orange', image: '', active: 1 },
];

async function seed() {
  const db = await getDB();
  console.log('🌱 اثیار - در حال مقداردهی اولیه...');

  for (const cat of defaultCategories) {
    await db.run(
      'INSERT OR IGNORE INTO categories (id, name, icon, color, count, description, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [cat.id, cat.name, cat.icon, cat.color, cat.count, cat.description, cat.image]
    );
    await db.run('UPDATE categories SET name=?, icon=?, color=?, description=? WHERE id=?', [cat.name, cat.icon, cat.color, cat.description, cat.id]);
  }

  const productCount = await db.get('SELECT COUNT(*) as cnt FROM products');
  if (productCount.cnt === 0) {
    for (const p of defaultProducts) {
      await db.run(
        `INSERT INTO products (name, category, price, old_price, stock, discount, is_festival, is_new, is_organic, sales, description, benefits, usage_text, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.name, p.category, p.price, p.old_price, p.stock, p.discount, p.is_festival, p.is_new, p.is_organic, p.sales, p.description, p.benefits, p.usage_text, p.images]
      );
    }
    console.log(`✅ ${defaultProducts.length} محصول اثیار اضافه شد`);
  } else {
    // اگر محصولات قدیمی بود، محصولات جدید را اضافه کن
    const existingNames = await db.all('SELECT name FROM products');
    const existingSet = new Set(existingNames.map(r => r.name));
    let added = 0;
    for (const p of defaultProducts) {
      if (!existingSet.has(p.name)) {
        await db.run(
          `INSERT INTO products (name, category, price, old_price, stock, discount, is_festival, is_new, is_organic, sales, description, benefits, usage_text, images)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.name, p.category, p.price, p.old_price, p.stock, p.discount, p.is_festival, p.is_new, p.is_organic, p.sales, p.description, p.benefits, p.usage_text, p.images]
        );
        added++;
      }
    }
    if (added > 0) console.log(`✅ ${added} محصول جدید اثیار اضافه شد`);
    else console.log(`ℹ️ ${productCount.cnt} محصول از قبل وجود دارد`);
  }

  const bannerCount = await db.get('SELECT COUNT(*) as cnt FROM banners');
  if (bannerCount.cnt === 0) {
    for (const b of defaultBanners) {
      await db.run(
        'INSERT INTO banners (title, subtitle, description, color, cta, image, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [b.title, b.subtitle, b.description, b.color, b.cta, b.image, b.active]
      );
    }
    console.log(`✅ ${defaultBanners.length} بنر اثیار اضافه شد`);
  } else {
    // آپدیت بنرهای قدیمی
    await db.run('DELETE FROM banners');
    for (const b of defaultBanners) {
      await db.run(
        'INSERT INTO banners (title, subtitle, description, color, cta, image, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [b.title, b.subtitle, b.description, b.color, b.cta, b.image, b.active]
      );
    }
    console.log(`✅ بنرهای اثیار به‌روزرسانی شد`);
  }

  console.log('✅ Seed اثیار کامل شد');
  if (require.main === module) process.exit(0);
}

if (require.main === module) {
  seed().catch(err => { console.error(err); process.exit(1); });
} else {
  module.exports = seed;
}
