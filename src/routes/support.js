const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const smsService = require('../services/sms');

// شروع چت جدید - کاربر
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { subject, message } = req.body;

    // اگر چت باز دارد، همان را برگردان
    const existing = await db.get(
      'SELECT * FROM support_chats WHERE user_id = ? AND status IN ("waiting", "active") ORDER BY id DESC LIMIT 1',
      [req.user.id]
    );
    if (existing) {
      const messages = await db.all('SELECT * FROM support_messages WHERE chat_id = ? ORDER BY id ASC', [existing.id]);
      return res.json({ ...existing, messages });
    }

    const result = await db.run(
      'INSERT INTO support_chats (user_id, phone, name, subject, status) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, req.user.phone, req.user.name, subject || 'مشاوره گیاهان دارویی', 'waiting']
    );

    const chatId = result.lastID;

    // پیام سیستمی اولیه
    await db.run(
      'INSERT INTO support_messages (chat_id, sender, sender_name, message) VALUES (?, ?, ?, ?)',
      [chatId, 'system', 'سیستم', '🌿 به بخش مشاوره آنلاین عطاری شفا خوش آمدید. لطفا منتظر بمانید، حکیم ما به زودی پاسخگو خواهد بود.']
    );

    if (message) {
      await db.run(
        'INSERT INTO support_messages (chat_id, sender, sender_name, message) VALUES (?, ?, ?, ?)',
        [chatId, 'user', req.user.name, message]
      );
    }

    const chat = await db.get('SELECT * FROM support_chats WHERE id = ?', [chatId]);
    const messages = await db.all('SELECT * FROM support_messages WHERE chat_id = ? ORDER BY id ASC', [chatId]);

    res.status(201).json({ ...chat, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در شروع چت' });
  }
});

// ارسال پیام - کاربر + ادمین با پیامک
router.post('/:chatId/message', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { message } = req.body;
    const chatId = req.params.chatId;

    let chat = await db.get('SELECT * FROM support_chats WHERE id = ? AND user_id = ?', [chatId, req.user.id]);
    if (!chat) {
      const isAdmin = req.user.role === 'admin';
      if (!isAdmin) return res.status(404).json({ error: 'چت یافت نشد' });
      chat = await db.get('SELECT * FROM support_chats WHERE id = ?', [chatId]);
      if (!chat) return res.status(404).json({ error: 'چت یافت نشد' });
    }

    if (chat.status === 'closed') {
      return res.status(400).json({ error: 'این چت بسته شده است' });
    }

    const sender = req.user.role === 'admin' ? 'admin' : 'user';
    const senderName = req.user.role === 'admin' ? 'حکیم شفا 👨‍⚕️' : req.user.name;

    await db.run(
      'INSERT INTO support_messages (chat_id, sender, sender_name, message) VALUES (?, ?, ?, ?)',
      [chatId, sender, senderName, message]
    );

    if (sender === 'user' && chat.status === 'waiting') {
      await db.run('UPDATE support_chats SET status = ? WHERE id = ?', ['active', chatId]);
    }

    // اگر ادمین پاسخ داد، به کاربر پیامک اطلاع بده
    if (sender === 'admin') {
      try {
        await smsService.sendSupportReply(chat.phone, chatId);
      } catch (e) {
        console.error('SMS Support Error:', e);
      }
    }

    const messages = await db.all('SELECT * FROM support_messages WHERE chat_id = ? ORDER BY id ASC', [chatId]);
    res.json({ success: true, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در ارسال پیام' });
  }
});

// لیست چت‌های من - کاربر
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const chats = await db.all('SELECT * FROM support_chats WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
    for (let chat of chats) {
      chat.messages = await db.all('SELECT * FROM support_messages WHERE chat_id = ? ORDER BY id ASC', [chat.id]);
    }
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

// دریافت یک چت خاص
router.get('/:chatId', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    let chat;
    if (req.user.role === 'admin') {
      chat = await db.get('SELECT * FROM support_chats WHERE id = ?', [req.params.chatId]);
    } else {
      chat = await db.get('SELECT * FROM support_chats WHERE id = ? AND user_id = ?', [req.params.chatId, req.user.id]);
    }
    if (!chat) return res.status(404).json({ error: 'چت یافت نشد' });
    const messages = await db.all('SELECT * FROM support_messages WHERE chat_id = ? ORDER BY id ASC', [chat.id]);
    res.json({ ...chat, messages });
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

// بستن چت و ثبت رضایت - کاربر
router.post('/:chatId/close', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { rating, feedback } = req.body;
    const chatId = req.params.chatId;

    const chat = await db.get('SELECT * FROM support_chats WHERE id = ? AND user_id = ?', [chatId, req.user.id]);
    if (!chat) return res.status(404).json({ error: 'چت یافت نشد' });

    await db.run(
      'UPDATE support_chats SET status = ?, rating = ?, feedback = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['closed', rating || null, feedback || '', chatId]
    );

    await db.run(
      'INSERT INTO support_messages (chat_id, sender, sender_name, message) VALUES (?, ?, ?, ?)',
      [chatId, 'system', 'سیستم', `✅ چت بسته شد. امتیاز شما: ${rating || 5} ستاره. سپاس از اعتمادتان 🌸`]
    );

    const updated = await db.get('SELECT * FROM support_chats WHERE id = ?', [chatId]);
    const messages = await db.all('SELECT * FROM support_messages WHERE chat_id = ? ORDER BY id ASC', [chatId]);
    res.json({ ...updated, messages });
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

// --- ادمین ---

// لیست همه چت‌ها - ادمین
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const chats = await db.all('SELECT * FROM support_chats ORDER BY CASE WHEN status="waiting" THEN 0 WHEN status="active" THEN 1 ELSE 2 END, id DESC');
    for (let chat of chats) {
      chat.messages = await db.all('SELECT * FROM support_messages WHERE chat_id = ? ORDER BY id ASC', [chat.id]);
      chat.unread = chat.messages.filter(m => m.sender === 'user').length;
    }
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

// تغییر وضعیت چت - ادمین
router.put('/:chatId/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { status } = req.body;
    await db.run('UPDATE support_chats SET status = ? WHERE id = ?', [status, req.params.chatId]);
    const chat = await db.get('SELECT * FROM support_chats WHERE id = ?', [req.params.chatId]);
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

module.exports = router;
