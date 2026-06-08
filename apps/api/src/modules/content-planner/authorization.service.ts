import { prisma } from '@ee-postmind/db';
import { createPost } from '../../services/post.service';

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

    try {
      // Use existing postService.createPost which handles media and scheduling
      const newPost = await createPost({
        workspaceId,
        authorId,
        content: planPost.contentBody,
        platforms: [planPost.platform],
        status: 'scheduled',
        scheduledAt: planPost.scheduledAt,
        mediaUrls: planPost.mediaUrls,
        designData: planPost.editorDesignData ? JSON.stringify(planPost.editorDesignData) : undefined
      });

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
