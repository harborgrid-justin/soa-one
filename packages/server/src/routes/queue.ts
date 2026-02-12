import { Router } from 'express';
import { prisma } from '../prisma';
import { enqueueJob } from '../queue/producer';

export const queueRoutes = Router();

// Submit async rule execution via message queue
queueRoutes.post('/execute', async (req, res) => {
  const { ruleSetId, input, callbackUrl } = req.body;

  if (!ruleSetId || !input) {
    return res.status(400).json({ error: 'ruleSetId and input are required' });
  }

  try {
    const job = await enqueueJob('rule-execution', {
      ruleSetId,
      input,
      callbackUrl,
    });

    res.status(202).json({
      jobId: job.id,
      status: 'pending',
      message: 'Rule execution queued',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check job status
queueRoutes.get('/jobs/:id', async (req, res) => {
  const job = await prisma.queueJob.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({
    ...job,
    payload: JSON.parse(job.payload),
    result: job.result ? JSON.parse(job.result) : null,
  });
});

// List recent jobs
queueRoutes.get('/jobs', async (req, res) => {
  const { limit = '20', status } = req.query;
  const where = status ? { status: String(status) } : {};
  const jobs = await prisma.queueJob.findMany({
    where,
    take: Number(limit),
    orderBy: { createdAt: 'desc' },
  });
  const parsed = jobs.map((j) => ({
    ...j,
    payload: JSON.parse(j.payload),
    result: j.result ? JSON.parse(j.result) : null,
  }));
  res.json(parsed);
});
