import { prisma } from '../prisma';

export interface QueueJob {
  id: string;
  queue: string;
  payload: any;
  status: string;
}

/**
 * Enqueue a job for async processing.
 * Uses database-backed queue (works anywhere, no Redis required).
 * For high-throughput production, swap with BullMQ/Redis.
 */
export async function enqueueJob(queue: string, payload: any): Promise<QueueJob> {
  const job = await prisma.queueJob.create({
    data: {
      queue,
      payload: JSON.stringify(payload),
      status: 'pending',
    },
  });

  return {
    id: job.id,
    queue: job.queue,
    payload,
    status: job.status,
  };
}
