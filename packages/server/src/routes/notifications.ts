import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ---------------------------------------------------------------------------
// Helper: create a notification (exported for use by other modules)
// ---------------------------------------------------------------------------
export async function createNotification(data: {
  userId: string;
  tenantId?: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  link?: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      tenantId: data.tenantId,
      type: data.type,
      title: data.title,
      message: data.message,
      entityType: data.entityType,
      entityId: data.entityId,
      link: data.link,
    },
  });
  return notification;
}

// ---------------------------------------------------------------------------
// GET / — list notifications for the current user
//   ?unread=true to filter only unread notifications
// ---------------------------------------------------------------------------
router.get('/', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const where: any = { userId };

    if (req.query.unread === 'true') {
      where.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /count — return { unread: <number> } for current user
// ---------------------------------------------------------------------------
router.get('/count', async (req: any, res) => {
  try {
    const userId = req.user.id;

    const unread = await prisma.notification.count({
      where: { userId, read: false },
    });

    res.json({ unread });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /read-all — mark all unread notifications as read for current user
//   (defined before /:id/read so Express doesn't match "read-all" as :id)
// ---------------------------------------------------------------------------
router.put('/read-all', async (req: any, res) => {
  try {
    const userId = req.user.id;

    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.json({ success: true, updated: result.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /:id/read — mark a single notification as read
// ---------------------------------------------------------------------------
router.put('/:id/read', async (req: any, res) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — delete a notification
// ---------------------------------------------------------------------------
router.delete('/:id', async (req: any, res) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.notification.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
