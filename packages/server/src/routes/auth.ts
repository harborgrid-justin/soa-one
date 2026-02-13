import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { signToken, verifyToken, requireAuth, type AuthRequest } from '../auth/middleware';
import { createAuditLog } from './audit';

export const authRoutes = Router();

// Register (creates a new tenant + admin user)
authRoutes.post('/register', async (req, res) => {
  const { email, password, name, tenantName } = req.body;

  if (!email || !password || !name || !tenantName) {
    return res.status(400).json({ error: 'email, password, name, and tenantName are required' });
  }

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Create tenant + user in transaction
  const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: tenantName, slug },
      });

      const user = await tx.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role: 'admin',
          tenantId: tenant.id,
        },
      });

      return { tenant, user };
    });

    const token = signToken({
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      tenantId: result.tenant.id,
    });

    await createAuditLog({
      tenantId: result.tenant.id,
      userId: result.user.id,
      userName: result.user.name,
      action: 'create',
      entity: 'tenant',
      entityId: result.tenant.id,
      entityName: result.tenant.name,
    });

    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        tenantId: result.tenant.id,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Organization slug already taken' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Login
authRoutes.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const token = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
  });

  await createAuditLog({
    tenantId: user.tenantId,
    userId: user.id,
    userName: user.name,
    action: 'login',
    entity: 'user',
    entityId: user.id,
    entityName: user.name,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      avatar: user.avatar,
    },
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      plan: user.tenant.plan,
    },
  });
});

// Get current user
authRoutes.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { tenant: true },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      avatar: user.avatar,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    },
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      plan: user.tenant.plan,
      ssoEnabled: user.tenant.ssoEnabled,
      ldapEnabled: user.tenant.ldapEnabled,
    },
  });
});

// Update profile
authRoutes.put('/me', requireAuth, async (req: AuthRequest, res) => {
  const { name, avatar } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (avatar !== undefined) data.avatar = avatar;

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data,
  });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
  });
});

// Change password
authRoutes.put('/me/password', requireAuth, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { password: hashedPassword },
  });

  res.json({ success: true });
});

// List users in tenant (admin only)
authRoutes.get('/users', requireAuth, async (req: AuthRequest, res) => {
  const users = await prisma.user.findMany({
    where: { tenantId: req.user!.tenantId },
    select: {
      id: true, email: true, name: true, role: true, avatar: true,
      isActive: true, lastLogin: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

// Update user role (admin only)
authRoutes.put('/users/:id/role', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { role } = req.body;
  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });

  await createAuditLog({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userName: req.user!.name,
    action: 'update',
    entity: 'user',
    entityId: user.id,
    entityName: user.name,
    after: JSON.stringify({ role }),
  });

  res.json(user);
});

// Deactivate user (admin only)
authRoutes.put('/users/:id/deactivate', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: 'Cannot deactivate yourself' });
  }

  await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });

  res.json({ success: true });
});

// Invite user to tenant
authRoutes.post('/invite', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { email, role } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const token = require('crypto').randomBytes(32).toString('hex');
  const invitation = await prisma.invitation.create({
    data: {
      email,
      role: role || 'editor',
      tenantId: req.user!.tenantId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  await createAuditLog({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userName: req.user!.name,
    action: 'invite',
    entity: 'user',
    entityName: email,
  });

  res.status(201).json({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
  });
});

// Accept invitation
authRoutes.post('/accept-invite', async (req, res) => {
  const { token, name, password } = req.body;

  if (!token || !name || !password) {
    return res.status(400).json({ error: 'token, name, and password are required' });
  }

  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (!invitation || invitation.accepted || invitation.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired invitation' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: invitation.email,
      name,
      password: hashedPassword,
      role: invitation.role,
      tenantId: invitation.tenantId,
    },
  });

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { accepted: true },
  });

  const jwtToken = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
  });

  res.json({
    token: jwtToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// List pending invitations (admin only)
authRoutes.get('/invitations', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const invitations = await prisma.invitation.findMany({
    where: { tenantId: req.user!.tenantId, accepted: false },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invitations);
});

// SSO/LDAP configuration (admin only)
authRoutes.get('/sso-config', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  res.json({
    ssoEnabled: tenant.ssoEnabled,
    ssoConfig: tenant.ssoConfig ? JSON.parse(tenant.ssoConfig) : null,
    ldapEnabled: tenant.ldapEnabled,
    ldapConfig: tenant.ldapConfig ? JSON.parse(tenant.ldapConfig) : null,
  });
});

authRoutes.put('/sso-config', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { ssoEnabled, ssoConfig, ldapEnabled, ldapConfig } = req.body;
  const data: any = {};

  if (ssoEnabled !== undefined) data.ssoEnabled = ssoEnabled;
  if (ssoConfig !== undefined) data.ssoConfig = JSON.stringify(ssoConfig);
  if (ldapEnabled !== undefined) data.ldapEnabled = ldapEnabled;
  if (ldapConfig !== undefined) data.ldapConfig = JSON.stringify(ldapConfig);

  const tenant = await prisma.tenant.update({
    where: { id: req.user!.tenantId },
    data,
  });

  await createAuditLog({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userName: req.user!.name,
    action: 'update',
    entity: 'tenant',
    entityId: tenant.id,
    entityName: tenant.name,
    after: JSON.stringify({ ssoEnabled, ldapEnabled }),
  });

  res.json({
    ssoEnabled: tenant.ssoEnabled,
    ssoConfig: tenant.ssoConfig ? JSON.parse(tenant.ssoConfig) : null,
    ldapEnabled: tenant.ldapEnabled,
    ldapConfig: tenant.ldapConfig ? JSON.parse(tenant.ldapConfig) : null,
  });
});
