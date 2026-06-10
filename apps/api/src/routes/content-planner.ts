import { Router, Response } from 'express';
import multer from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { checkContentPlannerAccess } from '../modules/content-planner/planGuard.js';
import { parseContentPlanIntent } from '../modules/content-planner/plan-parser.service.js';
import { generateAllContent } from '../modules/content-planner/content-generator.service.js';
import { composeSchedule } from '../modules/content-planner/schedule-composer.service.js';
import { authorizeContentPlan } from '../modules/content-planner/authorization.service.js';
import { uploadPublicFile } from '../services/storage.service.js';

export const contentPlannerRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024 }, // 250MB limit
});

function inferFileExtension(mimeType: string, originalName: string): string {
  const fromName = extname(originalName || '').toLowerCase();
  if (fromName) return fromName;
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'video/mp4') return '.mp4';
  if (mimeType === 'video/quicktime') return '.mov';
  if (mimeType === 'video/webm') return '.webm';
  return '';
}

// 1. Generate Plan
contentPlannerRouter.post('/generate', authenticate, checkContentPlannerAccess(1), async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, platforms, tone, durationDays } = req.body;
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;

    // A. Parse Intent — pass wizard values so fallback can use them
    const parseResult = await parseContentPlanIntent(
      prompt,
      platforms || [],
      tone || 'professional',
      platforms || [],
      durationDays || 7
    );
    if (!parseResult.success || !parseResult.data) {
      return res.status(400).json({ error: 'Could not parse intent', clarification: parseResult.clarification });
    }

    const intent = parseResult.data;

    // User-supplied wizard values always override AI-inferred ones
    if (tone) intent.tone = tone;
    if (durationDays && durationDays > 0) intent.durationDays = durationDays;
    if (platforms?.length > 0) intent.platforms = platforms;

    // Step 1 users get restricted defaults
    if (req.contentPlanner!.maxStep < 2) {
      intent.tone = 'professional';
      intent.durationDays = 7;
    }

    // Save Draft Plan
    const plan = await prisma.contentPlan.create({
      data: {
        workspaceId,
        userId,
        theme: intent.theme,
        tone: intent.tone,
        dateRangeStart: new Date(),
        dateRangeEnd: new Date(Date.now() + intent.durationDays * 86400000),
        parsedIntent: intent as any,
        status: 'generating'
      }
    });

    // B. Generate Content
    const generatedPosts = await generateAllContent(intent);

    // C. Schedule
    const scheduledPosts = composeSchedule(generatedPosts, intent);

    // Save Posts
    for (const post of scheduledPosts) {
      await prisma.contentPlanPost.create({
        data: {
          planId: plan.id,
          platform: post.platform,
          contentBody: post.contentBody,
          hashtags: post.hashtags,
          mediaSuggestion: post.mediaSuggestion,
          characterCount: post.characterCount,
          scheduledAt: post.scheduledAt,
          aiModelUsed: 'gpt-4o-mini',
          status: 'pending_review'
        }
      });
    }

    await prisma.contentPlan.update({
      where: { id: plan.id },
      data: { status: 'ready' }
    });

    res.json({ success: true, planId: plan.id });
  } catch (error: any) {
    console.error('[ContentPlanner] Generate error:', error);
    res.status(500).json({ error: 'Generation failed', details: error.message });
  }
});

// 2. Get Plan by ID
contentPlannerRouter.get('/plan/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const plan = await prisma.contentPlan.findUnique({
      where: { id: req.params.id as string, workspaceId: req.workspaceId! },
      include: { posts: { orderBy: { scheduledAt: 'asc' } } }
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

// 2.5 Get All Plans
contentPlannerRouter.get('/plans', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const plans = await prisma.contentPlan.findMany({
      where: { workspaceId: req.workspaceId! },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { posts: true } } }
    });
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// 3. Edit Post
contentPlannerRouter.put('/post/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { contentBody, scheduledAt, hashtags } = req.body;
    const post = await prisma.contentPlanPost.findUnique({
      where: { id: req.params.id as string },
      include: { plan: true }
    });

    if (!post || post.plan.workspaceId !== req.workspaceId!) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const updated = await prisma.contentPlanPost.update({
      where: { id: req.params.id as string },
      data: {
        contentBody,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        hashtags,
        editedByUser: true,
        characterCount: contentBody ? contentBody.length : undefined
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// 3.5 Regenerate Post
contentPlannerRouter.post('/post/:id/regenerate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.contentPlanPost.findUnique({
      where: { id: req.params.id as string },
      include: { plan: true }
    });

    if (!post || post.plan.workspaceId !== req.workspaceId!) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const intent = post.plan.parsedIntent as any;
    
    const prompt = `You are an expert social media manager regenerating a post for ${post.platform}.
Campaign Theme: ${intent.theme || ''}
Tone: ${intent.tone || ''}
Special Instructions: ${intent.specialInstructions || 'None'}

Please generate a NEW variation of the post content that is different from previous attempts.
Include relevant hashtags (at least 2, max 5).
Provide a brief media suggestion for an image or video that would pair well with this post.

Your response MUST be valid JSON matching this exact schema:
{
  "contentBody": "the post text",
  "hashtags": ["tag1", "tag2"],
  "mediaSuggestion": "description of image/video, or null"
}`;

    // Need to import chatCompletion to use it here. I'll add the import as well.
    const { chatCompletion } = await import('../services/openai.service.js');
    const resultJsonStr = await chatCompletion([{ role: 'user', content: prompt }]);
    const cleaned = resultJsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleaned);

    const updated = await prisma.contentPlanPost.update({
      where: { id: req.params.id as string },
      data: {
        contentBody: result.contentBody,
        hashtags: Array.isArray(result.hashtags) ? result.hashtags.map((t: string) => t.replace('#', '')) : [],
        mediaSuggestion: result.mediaSuggestion || null,
        characterCount: result.contentBody.length,
        regenerated: true
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to regenerate post' });
  }
});

// 4. Delete Post
contentPlannerRouter.delete('/post/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.contentPlanPost.findUnique({
      where: { id: req.params.id as string },
      include: { plan: true }
    });

    if (!post || post.plan.workspaceId !== req.workspaceId!) {
      return res.status(404).json({ error: 'Post not found' });
    }

    await prisma.contentPlanPost.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// 5. Cancel Plan
contentPlannerRouter.post('/plan/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const plan = await prisma.contentPlan.updateMany({
      where: { id: req.params.id as string, workspaceId: req.workspaceId!, status: { in: ['draft', 'ready', 'generating'] } },
      data: { status: 'cancelled' }
    });
    if (plan.count === 0) return res.status(404).json({ error: 'Plan not found or cannot be cancelled' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel plan' });
  }
});

// 6. Authorize Plan
contentPlannerRouter.post('/plan/:id/authorize', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await authorizeContentPlan(req.params.id as string, req.workspaceId!, req.userId!);
    if (result.errors.length > 0) {
      return res.status(207).json({
        success: result.authorizedCount > 0,
        authorizedCount: result.authorizedCount,
        errors: result.errors,
        message: result.authorizedCount > 0
          ? `${result.authorizedCount} posts scheduled. ${result.errors.length} failed (missing platform connections).`
          : 'All posts failed to authorize. Please check your connected platforms.'
      });
    }
    res.json({ success: true, authorizedCount: result.authorizedCount });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 7. Upload Media
contentPlannerRouter.post('/post/:id/upload-media', authenticate, upload.array('media', 10), async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.contentPlanPost.findUnique({
      where: { id: req.params.id as string },
      include: { plan: true }
    });

    if (!post || post.plan.workspaceId !== req.workspaceId!) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploadedUrls: string[] = [];
    for (const file of files) {
      const ext = inferFileExtension(file.mimetype, file.originalname);
      const randomName = `${randomUUID()}${ext}`;
      const objectKey = `workspaces/${req.workspaceId!}/planner/${randomName}`;
      
      const result = await uploadPublicFile({
        buffer: file.buffer,
        key: objectKey,
        contentType: file.mimetype,
        baseUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
        localUploadDir: process.env.UPLOAD_DIR || './uploads'
      });
      const url = result.url;
      uploadedUrls.push(url);
    }

    const updatedPost = await prisma.contentPlanPost.update({
      where: { id: req.params.id as string },
      data: {
        mediaUrls: { push: uploadedUrls },
        mediaSource: 'upload'
      }
    });

    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

// 8. Save Editor Design
contentPlannerRouter.post('/post/:id/save-design', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { mediaUrl, designData } = req.body;
    
    const post = await prisma.contentPlanPost.findUnique({
      where: { id: req.params.id as string },
      include: { plan: true }
    });

    if (!post || post.plan.workspaceId !== req.workspaceId!) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const updatedPost = await prisma.contentPlanPost.update({
      where: { id: req.params.id as string },
      data: {
        mediaUrls: [mediaUrl], // Replace existing media with the new design
        editorDesignData: designData,
        mediaSource: 'editor'
      }
    });

    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save design' });
  }
});
