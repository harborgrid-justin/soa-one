import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth, type AuthRequest } from '../auth/middleware';
import { createAuditLog } from './audit';

export const adapterRoutes = Router();

// List adapters (optionally by project)
adapterRoutes.get('/', async (req, res) => {
  const { projectId } = req.query;
  const where = projectId ? { projectId: String(projectId) } : {};
  const adapters = await prisma.adapter.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  });
  const parsed = adapters.map((a) => ({
    ...a,
    config: JSON.parse(a.config),
    authConfig: JSON.parse(a.authConfig),
    headers: JSON.parse(a.headers),
  }));
  res.json(parsed);
});

// Get single adapter
adapterRoutes.get('/:id', async (req, res) => {
  const adapter = await prisma.adapter.findUnique({ where: { id: req.params.id } });
  if (!adapter) return res.status(404).json({ error: 'Adapter not found' });
  res.json({
    ...adapter,
    config: JSON.parse(adapter.config),
    authConfig: JSON.parse(adapter.authConfig),
    headers: JSON.parse(adapter.headers),
  });
});

// Create adapter
adapterRoutes.post('/', async (req: AuthRequest, res) => {
  const { projectId, name, type, config, authConfig, headers } = req.body;
  if (!projectId || !name || !type) {
    return res.status(400).json({ error: 'projectId, name, and type are required' });
  }

  const adapter = await prisma.adapter.create({
    data: {
      projectId,
      name,
      type,
      config: JSON.stringify(config || {}),
      authConfig: JSON.stringify(authConfig || {}),
      headers: JSON.stringify(headers || {}),
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'create',
      entity: 'adapter',
      entityId: adapter.id,
      entityName: adapter.name,
    });
  }

  res.status(201).json({
    ...adapter,
    config: JSON.parse(adapter.config),
    authConfig: JSON.parse(adapter.authConfig),
    headers: JSON.parse(adapter.headers),
  });
});

// Update adapter
adapterRoutes.put('/:id', async (req, res) => {
  const { name, type, config, authConfig, headers, status } = req.body;
  const data: any = {};

  if (name !== undefined) data.name = name;
  if (type !== undefined) data.type = type;
  if (config !== undefined) data.config = JSON.stringify(config);
  if (authConfig !== undefined) data.authConfig = JSON.stringify(authConfig);
  if (headers !== undefined) data.headers = JSON.stringify(headers);
  if (status !== undefined) data.status = status;

  const adapter = await prisma.adapter.update({ where: { id: req.params.id }, data });
  res.json({
    ...adapter,
    config: JSON.parse(adapter.config),
    authConfig: JSON.parse(adapter.authConfig),
    headers: JSON.parse(adapter.headers),
  });
});

// Delete adapter
adapterRoutes.delete('/:id', async (req, res) => {
  await prisma.adapter.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Test adapter connectivity
adapterRoutes.post('/:id/test', async (req, res) => {
  const adapter = await prisma.adapter.findUnique({ where: { id: req.params.id } });
  if (!adapter) return res.status(404).json({ error: 'Adapter not found' });

  const config = JSON.parse(adapter.config);
  const authConfig = JSON.parse(adapter.authConfig);
  const headers = JSON.parse(adapter.headers);

  const startTime = Date.now();

  try {
    switch (adapter.type) {
      case 'rest': {
        const url = config.baseUrl || config.url;
        if (!url) throw new Error('No URL configured');

        const fetchHeaders: Record<string, string> = { ...headers };
        if (authConfig.type === 'bearer' && authConfig.token) {
          fetchHeaders['Authorization'] = `Bearer ${authConfig.token}`;
        } else if (authConfig.type === 'apiKey' && authConfig.headerName && authConfig.apiKey) {
          fetchHeaders[authConfig.headerName] = authConfig.apiKey;
        } else if (authConfig.type === 'basic' && authConfig.username && authConfig.password) {
          fetchHeaders['Authorization'] = `Basic ${Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64')}`;
        }

        const response = await fetch(url + (config.testEndpoint || ''), {
          method: 'GET',
          headers: fetchHeaders,
          signal: AbortSignal.timeout(10000),
        });

        const elapsed = Date.now() - startTime;

        await prisma.adapter.update({
          where: { id: adapter.id },
          data: {
            status: response.ok ? 'active' : 'error',
            lastTestedAt: new Date(),
            lastError: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
          },
        });

        res.json({
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          responseTimeMs: elapsed,
        });
        break;
      }

      case 'webhook': {
        // Webhook adapters are passive — just validate config
        if (!config.url) throw new Error('No webhook URL configured');
        await prisma.adapter.update({
          where: { id: adapter.id },
          data: { status: 'active', lastTestedAt: new Date(), lastError: null },
        });
        res.json({ success: true, message: 'Webhook URL validated' });
        break;
      }

      case 'database': {
        // For DB adapters, we can't actually connect without drivers
        // Just validate the config structure
        if (!config.connectionString && !config.host) {
          throw new Error('No connection string or host configured');
        }
        await prisma.adapter.update({
          where: { id: adapter.id },
          data: { status: 'active', lastTestedAt: new Date(), lastError: null },
        });
        res.json({ success: true, message: 'Configuration validated' });
        break;
      }

      default:
        res.json({ success: true, message: 'Configuration saved' });
    }
  } catch (err: any) {
    await prisma.adapter.update({
      where: { id: adapter.id },
      data: {
        status: 'error',
        lastTestedAt: new Date(),
        lastError: err.message,
      },
    });
    res.json({ success: false, error: err.message });
  }
});

// Execute adapter (fetch data from external source)
adapterRoutes.post('/:id/fetch', async (req, res) => {
  const adapter = await prisma.adapter.findUnique({ where: { id: req.params.id } });
  if (!adapter) return res.status(404).json({ error: 'Adapter not found' });

  const config = JSON.parse(adapter.config);
  const authConfig = JSON.parse(adapter.authConfig);
  const adapterHeaders = JSON.parse(adapter.headers);
  const { path, method, body } = req.body;

  try {
    if (adapter.type !== 'rest') {
      return res.status(400).json({ error: 'Only REST adapters support fetch' });
    }

    const url = (config.baseUrl || config.url) + (path || '');
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...adapterHeaders,
    };

    if (authConfig.type === 'bearer' && authConfig.token) {
      fetchHeaders['Authorization'] = `Bearer ${authConfig.token}`;
    } else if (authConfig.type === 'apiKey' && authConfig.headerName && authConfig.apiKey) {
      fetchHeaders[authConfig.headerName] = authConfig.apiKey;
    }

    const response = await fetch(url, {
      method: method || 'GET',
      headers: fetchHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });

    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    res.json({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
