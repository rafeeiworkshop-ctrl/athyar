const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const defaultCats = [
  { id: 'herbal-tea', name: 'دمنوش‌های گیاهی', icon: '🍵', color: '#E0F2E9', count: 0, description: 'دمنوش‌های آرامش‌بخش و درمانی', image: '' },
  { id: 'spices', name: 'ادویه جات', icon: '🌶️', color: '#FFEDD5', count: 0, description: 'ادویه‌های دست‌چین و تازه', image: '' },
  { id: 'oils', name: 'روغن‌های گیاهی', icon: '🫒', color: '#FEF3C7', count: 0, description: 'روغن‌های پرس سرد و خالص', image: '' },
  { id: 'honey', name: 'عسل طبیعی', icon: '🍯', color: '#FEF9C3', count: 0, description: 'عسل‌های طبیعی و خام از زنبورستان‌های کوهستانی', image: '' },
  { id: 'dried-fruits', name: 'میوه خشک', icon: '🍎', color: '#FFEDD5', count: 0, description: 'میوه‌های خشک شده طبیعی بدون شکر افزوده', image: '' },
  { id: 'handicrafts', name: 'صنایع دستی', icon: '🏺', color: '#F5E6D3', count: 0, description: 'ظروف و ابزار دست‌ساز برای زندگی سالم', image: '' },
  { id: 'distillates', name: 'عرقیات', icon: '💧', color: '#DBEAFE', count: 0, description: 'عرقیات دوآتشه و سنتی', image: '' },
  { id: 'dried', name: 'خشکبار دارویی', icon: '🍇', color: '#FCE7F3', count: 0, description: 'خشکبار دارویی و گیاهان خشک', image: '' },
];

router.get('/', async (req, res) => {
  try {
    const db = await getDB();
    let cats = await db.all('SELECT * FROM categories ORDER BY id ASC');
    if (cats.length === 0) {
      return res.json(defaultCats);
    }
    for (let cat of cats) {
      const count = await db.get('SELECT COUNT(*) as cnt FROM products WHERE category = ?', [cat.id]);
      cat.count = count.cnt;
    }
    res.json(cats);
  } catch (err) {
    console.error(err);
    res.json(defaultCats);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = await getDB();
    let cat = await db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!cat) {
      cat = defaultCats.find(c => c.id === req.params.id);
      if (!cat) return res.status(404).json({ error: 'دسته یافت نشد' });
    }
    const count = await db.get('SELECT COUNT(*) as cnt FROM products WHERE category = ?', [cat.id]);
    const products = await db.all('SELECT * FROM products WHERE category = ? ORDER BY id DESC LIMIT 20', [cat.id]);
    cat.count = count.cnt;
    cat.products = products.map(p => ({
      ...p,
      benefits: p.benefits ? JSON.parse(p.benefits) : [],
      images: p.images ? JSON.parse(p.images) : [],
      is_festival: !!p.is_festival,
      is_new: !!p.is_new,
      is_organic: !!p.is_organic
    }));
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { id, name, icon, color, description, image } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'شناسه و نام الزامی است' });
    await db.run(
      'INSERT OR REPLACE INTO categories (id, name, icon, color, description, image) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, icon || '🌿', color || '#E0F2E9', description || '', image || '']
    );
    const cat = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json(cat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در افزودن دسته' });
  }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { name, icon, color, description, image } = req.body;
    await db.run(
      'UPDATE categories SET name=?, icon=?, color=?, description=?, image=? WHERE id=?',
      [name, icon, color, description, image, req.params.id]
    );
    const cat = await db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const prodCount = await db.get('SELECT COUNT(*) as cnt FROM products WHERE category = ?', [req.params.id]);
    if (prodCount.cnt > 0) {
      return res.status(400).json({ error: `این دسته ${prodCount.cnt} محصول دارد، ابتدا محصولات را منتقل کنید` });
    }
    await db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطا در حذف' });
  }
});

module.exports = router;
