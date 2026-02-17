import { Queue, Worker, Job } from 'bullmq';
import { postService } from '../services/post.service.js';
import { prisma } from '../config/database.js';

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Queue for scheduled posts
export const postQueue = new Queue('post-publishing', {
  connection: REDIS_CONNECTION,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

// Worker processes scheduled posts
export const postWorker = new Worker(
  'post-publishing',
  async (job: Job) => {
    const { postId } = job.data;
    console.log(`[Scheduler] Publishing post ${postId}`);

    await prisma.post.update({
      where: { id: postId },
      data: { status: 'publishing' },
    });

    const results = await postService.publishPost(postId);
    return results;
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 5,
  },
);

postWorker.on('completed', (job) => {
  console.log(`[Scheduler] Post ${job.data.postId} published successfully`);
});

postWorker.on('failed', (job, err) => {
  console.error(`[Scheduler] Post ${job?.data?.postId} failed:`, err.message);
});

// Schedule a post for future publishing
export async function schedulePost(postId: string, scheduledAt: Date): Promise<string> {
  const delay = scheduledAt.getTime() - Date.now();

  if (delay <= 0) {
    const job = await postQueue.add('publish', { postId });
    return job.id || '';
  }

  const job = await postQueue.add('publish', { postId }, { delay });

  await prisma.post.update({
    where: { id: postId },
    data: { status: 'scheduled' },
  });

  return job.id || '';
}

// Cancel a scheduled post
export async function cancelScheduledPost(postId: string) {
  const jobs = await postQueue.getDelayed();
  for (const job of jobs) {
    if (job.data.postId === postId) {
      await job.remove();
      break;
    }
  }

  await prisma.post.update({
    where: { id: postId },
    data: { status: 'draft', scheduledAt: null },
  });
}

// Get queue stats
export async function getQueueStats() {
  const [waiting, active, delayed, completed, failed] = await Promise.all([
    postQueue.getWaitingCount(),
    postQueue.getActiveCount(),
    postQueue.getDelayedCount(),
    postQueue.getCompletedCount(),
    postQueue.getFailedCount(),
  ]);

  return { waiting, active, delayed, completed, failed };
}
