const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// لیست محصولات با فیلتر و جستجو
router.get('/', async (req, res) => {
  try {
    const db = await getDB();
    const { search, category, filter, sort } = req.query;

    let query = 'SELECT * FROM products WHERE 1=1';
    let params = [];

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (filter === 'new') query += ' AND is_new = 1';
    if (filter === 'discount') query += ' AND discount > 0';
    if (filter === 'bestseller') query += ' AND sales > 100';
    if (filter === 'organic') query += ' AND is_organic = 1';
    if (filter === 'festival') query += ' AND is_festival = 1';

    // سورت
    if (sort === 'cheapest') query += ' ORDER BY (price * (100 - discount) / 100) ASC';
    else if (sort === 'expensive') query += ' ORDER BY (price * (100 - discount) / 100) DESC';
    else if (sort === 'popular') query += ' ORDER BY sales DESC';
    else query += ' ORDER BY id DESC'; // newest

    const products = await db.all(query, params);

    // تبدیل فیلدهای JSON
    const parsed = products.map(p => ({
      ...p,
      benefits: p.benefits ? JSON.parse(p.benefits) : [],
      images: p.images ? JSON.parse(p.images) : [],
      is_festival: !!p.is_festival,
      is_new: !!p.is_new,
      is_organic: !!p.is_organic
    }));

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطای دریافت محصولات' });
  }
});

// محصول تکی
router.get('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const p = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'محصول یافت نشد' });

    res.json({
      ...p,
      benefits: p.benefits ? JSON.parse(p.benefits) : [],
      images: p.images ? JSON.parse(p.images) : [],
      is_festival: !!p.is_festival,
      is_new: !!p.is_new,
      is_organic: !!p.is_organic
    });
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

// افزودن محصول - فقط ادمین
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { name, category, price, old_price, stock, discount, is_festival, is_new, is_organic, description, benefits, usage_text, images } = req.body;

    if (!name || !category || !price) {
      return res.status(400).json({ error: 'نام، دسته و قیمت الزامی است' });
    }

    const result = await db.run(
      `INSERT INTO products 
      (name, category, price, old_price, stock, discount, is_festival, is_new, is_organic, description, benefits, usage_text, images, sales)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        name, category, price, old_price || 0, stock || 0, discount || 0,
        is_festival ? 1 : 0, is_new ? 1 : 0, is_organic ? 1 : 0,
        description || '',
        JSON.stringify(benefits || []),
        usage_text || '',
        JSON.stringify(images || [])
      ]
    );

    const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);
    res.status(201).json(newProduct);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در افزودن محصول' });
  }
});

// ویرایش
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { name, category, price, old_price, stock, discount, is_festival, is_new, is_organic, description, benefits, usage_text, images } = req.body;

    await db.run(
      `UPDATE products SET
        name=?, category=?, price=?, old_price=?, stock=?, discount=?,
        is_festival=?, is_new=?, is_organic=?, description=?, benefits=?, usage_text=?, images=?
      WHERE id=?`,
      [
        name, category, price, old_price || 0, stock || 0, discount || 0,
        is_festival ? 1 : 0, is_new ? 1 : 0, is_organic ? 1 : 0,
        description || '',
        JSON.stringify(benefits || []),
        usage_text || '',
        JSON.stringify(images || []),
        req.params.id
      ]
    );

    const updated = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در ویرایش' });
  }
});

// حذف
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطا در حذف' });
  }
});

module.exports = router;
