import { prisma } from '../../config/database.js';
import { postService } from '../../services/post.service.js';


export async function authorizeContentPlan(
  planId: string, 
  workspaceId: string, 
  authorId: string
) {
  const plan = await prisma.contentPlan.findUnique({
    where: { id: planId, workspaceId },
    include: { posts: true }
  });

  if (!plan) {
    throw new Error('Plan not found');
  }
  if (plan.status === 'authorized') {
    throw new Error('Plan is already authorized');
  }

  let authorizedCount = 0;
  const errors: string[] = [];

  for (const planPost of plan.posts) {
    if (planPost.status !== 'pending_review' && planPost.status !== 'approved') {
      continue;
    }

    // Skip posts whose scheduled time has already passed
    if (planPost.scheduledAt && new Date(planPost.scheduledAt) < new Date()) {
      errors.push(`Post for ${planPost.platform} skipped — scheduled time (${new Date(planPost.scheduledAt).toLocaleString()}) has already passed`);
      await prisma.contentPlanPost.update({
        where: { id: planPost.id },
        data: { status: 'failed' }
      });
      continue;
    }

    try {
      // Use existing postService.createPost which handles media and scheduling
      const connection = await prisma.socialConnection.findFirst({
        where: { workspaceId, platform: planPost.platform, isActive: true }
      });
      if (!connection) throw new Error(`No active connection found for ${planPost.platform}`);

      const newPost = await postService.createPost({
        workspaceId,
        userId: authorId,
        content: planPost.contentBody,
        platforms: [{ connectionId: connection.id, platform: planPost.platform as any }],
        scheduledAt: planPost.scheduledAt ? new Date(planPost.scheduledAt) : undefined,
        mediaUrls: planPost.mediaUrls
      } as any);

      await prisma.contentPlanPost.update({
        where: { id: planPost.id },
        data: {
          status: 'scheduled',
          postId: newPost.id
        }
      });
      
      authorizedCount++;
    } catch (e: any) {
      errors.push(`Failed to authorize post for ${planPost.platform}: ${e.message}`);
      await prisma.contentPlanPost.update({
        where: { id: planPost.id },
        data: { status: 'failed' }
      });
    }
  }

  await prisma.contentPlan.update({
    where: { id: planId },
    data: {
      status: errors.length === 0 && authorizedCount > 0 ? 'authorized' : 'partial',
      authorizedAt: new Date()
    }
  });

  return {
    authorizedCount,
    errors
  };
}
