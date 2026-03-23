const prisma = require('../config/prismaClient');
const logger = require('../utils/logger');

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 20,
      include: {
        announcement: { select: { id: true, title: true, message: true, createdAt: true } },
      },
    });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ success: true, data: notifications, unreadCount });
  } catch (error) {
    logger.error('getNotifications error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil notifikasi' });
  }
};

// PATCH /api/notifications/read-all — mount BEFORE /:id/read in router
const markAllRead = async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, updated: result.count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal update notifikasi' });
  }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const notif = await prisma.notification.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!notif) return res.status(404).json({ success: false, message: 'Notifikasi tidak ditemukan' });

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal update notifikasi' });
  }
};

// POST /api/admin/announcements — fan-out to all active users
const createAnnouncement = async (req, res) => {
  const { title, message } = req.body;
  if (!title || title.trim().length === 0)
    return res.status(400).json({ success: false, message: 'Title wajib diisi' });
  if (title.length > 200)
    return res.status(400).json({ success: false, message: 'Title maksimal 200 karakter' });
  if (!message || message.trim().length === 0)
    return res.status(400).json({ success: false, message: 'Message wajib diisi' });
  if (message.length > 2000)
    return res.status(400).json({ success: false, message: 'Message maksimal 2000 karakter' });

  try {
    const announcement = await prisma.announcement.create({
      data: { title: title.trim(), message: message.trim() },
    });

    const activeUsers = await prisma.user.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    if (activeUsers.length > 0) {
      await prisma.notification.createMany({
        data: activeUsers.map(u => ({
          userId: u.id,
          announcementId: announcement.id,
        })),
        skipDuplicates: true,
      });
    }

    res.status(201).json({
      success: true,
      data: announcement,
      recipientCount: activeUsers.length,
    });
  } catch (error) {
    logger.error('createAnnouncement error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal membuat pengumuman' });
  }
};

// GET /api/admin/announcements
const getAnnouncements = async (req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { notifications: true } } },
    });
    res.json({ success: true, data: announcements });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengambil pengumuman' });
  }
};

module.exports = { getNotifications, markAllRead, markRead, createAnnouncement, getAnnouncements };
