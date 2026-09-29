const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const db = await getDB();
    const banners = await db.all('SELECT * FROM banners ORDER BY id DESC');
    res.json(banners.map(b => ({ ...b, active: !!b.active })));
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { title, subtitle, description, color, cta, image, active } = req.body;
    if (!title) return res.status(400).json({ error: 'عنوان الزامی است' });
    const result = await db.run(
      'INSERT INTO banners (title, subtitle, description, color, cta, image, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, subtitle || '', description || '', color || 'green', cta || 'خرید کنید', image || '', active ? 1 : 0]
    );
    const banner = await db.get('SELECT * FROM banners WHERE id = ?', [result.lastID]);
    res.status(201).json(banner);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در افزودن بنر' });
  }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { title, subtitle, description, color, cta, image, active } = req.body;
    await db.run(
      'UPDATE banners SET title=?, subtitle=?, description=?, color=?, cta=?, image=?, active=? WHERE id=?',
      [title, subtitle, description, color, cta, image || '', active ? 1 : 0, req.params.id]
    );
    const banner = await db.get('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    res.json(banner);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا' });
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    await db.run('DELETE FROM banners WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

module.exports = router;
