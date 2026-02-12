import { Router } from 'express';
import { prisma } from '../prisma';
import {
  safeJsonParse,
  requireTenantId,
  requireUserId,
  validateRequired,
  asyncHandler,
} from '../utils/validation';

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
  // Validate required fields
  const missing = validateRequired(data, ['userId', 'type', 'title', 'message']);
  if (missing) {
    const err: any = new Error(missing);
    err.statusCode = 400;
    throw err;
  }

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
router.get(
  '/',
  asyncHandler(async (req: any, res) => {
    const userId = requireUserId(req);
    const where: any = { userId };

    if (req.query.unread === 'true') {
      where.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(notifications);
  }),
);

// ---------------------------------------------------------------------------
// GET /count — return { unread: <number> } for current user
// ---------------------------------------------------------------------------
router.get(
  '/count',
  asyncHandler(async (req: any, res) => {
    const userId = requireUserId(req);

    const unread = await prisma.notification.count({
      where: { userId, read: false },
    });

    res.json({ unread });
  }),
);

// ---------------------------------------------------------------------------
// PUT /read-all — mark all unread notifications as read for current user
//   (defined before /:id/read so Express doesn't match "read-all" as :id)
// ---------------------------------------------------------------------------
router.put(
  '/read-all',
  asyncHandler(async (req: any, res) => {
    const userId = requireUserId(req);

    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.json({ success: true, updated: result.count });
  }),
);

// ---------------------------------------------------------------------------
// PUT /:id/read — mark a single notification as read
// ---------------------------------------------------------------------------
router.put(
  '/:id/read',
  asyncHandler(async (req: any, res) => {
    const userId = requireUserId(req);

    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });

    res.json(updated);
  }),
);

// ---------------------------------------------------------------------------
// DELETE /:id — delete a notification
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  asyncHandler(async (req: any, res) => {
    const userId = requireUserId(req);

    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.notification.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  }),
);

export default router;
