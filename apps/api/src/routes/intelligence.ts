import { Router, Request, Response } from 'express';
import * as profileBuilder from '../services/profile-builder.service.js';
import * as editAnalyzer from '../services/edit-analyzer.service.js';
import * as recommendations from '../services/recommendations.service.js';
import * as patternAnalyzer from '../services/pattern-analyzer.service.js';
import { prisma } from '../config/database.js';

const router = Router();

// ============================================================
// Intelligence Profile Routes
// ============================================================

/** GET /api/v1/intelligence/profile — Get the current user's intelligence profile */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const profile = await profileBuilder.getOrCreateProfile(userId);
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error('[Intelligence] Error getting profile:', err);
    res.status(500).json({ error: 'Failed to get intelligence profile' });
  }
});

/** PUT /api/v1/intelligence/profile — Update the user's intelligence profile */
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const profile = await profileBuilder.updateProfile(userId, req.body);
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error('[Intelligence] Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update intelligence profile' });
  }
});

/** POST /api/v1/intelligence/profile/onboarding — Build profile from onboarding answers */
router.post('/profile/onboarding', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const profile = await profileBuilder.buildFromOnboarding(userId, req.body);
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error('[Intelligence] Error in onboarding:', err);
    res.status(500).json({ error: 'Failed to build profile from onboarding' });
  }
});

/** POST /api/v1/intelligence/profile/enrich — Trigger progressive enrichment */
router.post('/profile/enrich', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const profile = await profileBuilder.enrichFromPostingHistory(userId);
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error('[Intelligence] Error enriching profile:', err);
    res.status(500).json({ error: 'Failed to enrich profile' });
  }
});

// ============================================================
// Voice Model Routes
// ============================================================

/** GET /api/v1/intelligence/voice — Get the current user's voice model */
router.get('/voice', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const voice = await editAnalyzer.getVoiceModel(userId);
    res.json({ success: true, data: voice });
  } catch (err) {
    console.error('[Intelligence] Error getting voice model:', err);
    res.status(500).json({ error: 'Failed to get voice model' });
  }
});

/** POST /api/v1/intelligence/voice/analyze — Analyze an edit for voice learning */
router.post('/voice/analyze', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { postId, originalContent, editedContent } = req.body;
    if (!originalContent || !editedContent) {
      return res.status(400).json({ error: 'originalContent and editedContent are required' });
    }

    const result = await editAnalyzer.analyzeEdit(userId, postId || null, originalContent, editedContent);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Intelligence] Error analyzing edit:', err);
    res.status(500).json({ error: 'Failed to analyze edit' });
  }
});

/** POST /api/v1/intelligence/voice/preview — Enhancement 7: Voice model preview */
router.post('/voice/preview', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const voice = await editAnalyzer.getVoiceModel(userId);
    const profile = await profileBuilder.getProfile(userId);

    // Return voice and profile data for the frontend to generate before/after preview
    res.json({
      success: true,
      data: {
        hasVoiceModel: !!voice && voice.confidenceScore > 0.2,
        voice,
        profile,
      },
    });
  } catch (err) {
    console.error('[Intelligence] Error generating voice preview:', err);
    res.status(500).json({ error: 'Failed to generate voice preview' });
  }
});

// ============================================================
// Engagement & Pattern Analysis Routes
// ============================================================

/** GET /api/v1/intelligence/engagement — Get engagement history */
router.get('/engagement', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const limit = parseInt(req.query.limit as string) || 50;
    const platform = req.query.platform as string;

    const where: Record<string, unknown> = { userId };
    if (platform) where.platform = platform;

    const records = await prisma.userEngagementHistory.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({ success: true, data: records });
  } catch (err) {
    console.error('[Intelligence] Error getting engagement:', err);
    res.status(500).json({ error: 'Failed to get engagement data' });
  }
});

/** GET /api/v1/intelligence/snapshots — Get weekly engagement snapshots */
router.get('/snapshots', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const snapshots = await prisma.userEngagementSnapshot.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      take: 12, // last 12 weeks
    });

    res.json({ success: true, data: snapshots });
  } catch (err) {
    console.error('[Intelligence] Error getting snapshots:', err);
    res.status(500).json({ error: 'Failed to get engagement snapshots' });
  }
});

/** GET /api/v1/intelligence/patterns — Get pattern analysis for the user */
router.get('/patterns', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const analysis = await patternAnalyzer.getUserPatternAnalysis(userId);
    res.json({ success: true, data: analysis });
  } catch (err) {
    console.error('[Intelligence] Error getting patterns:', err);
    res.status(500).json({ error: 'Failed to get pattern analysis' });
  }
});

// ============================================================
// Recommendations Routes
// ============================================================

/** GET /api/v1/intelligence/recommendations — Get pending recommendations */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const recs = await recommendations.getPendingRecommendations(userId);
    res.json({ success: true, data: recs });
  } catch (err) {
    console.error('[Intelligence] Error getting recommendations:', err);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

/** PATCH /api/v1/intelligence/recommendations/:id — Update recommendation status */
router.patch('/recommendations/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { status } = req.body;
    if (!['acted', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "acted" or "dismissed"' });
    }

    await recommendations.updateRecommendationStatus(req.params.id as string, userId, status);
    res.json({ success: true });
  } catch (err) {
    console.error('[Intelligence] Error updating recommendation:', err);
    res.status(500).json({ error: 'Failed to update recommendation' });
  }
});

// ============================================================
// Competitor Benchmarking Routes (Enhancement 1)
// ============================================================

/** GET /api/v1/intelligence/competitors — Get user's tracked competitors */
router.get('/competitors', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const competitors = await prisma.competitorAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: competitors });
  } catch (err) {
    console.error('[Intelligence] Error getting competitors:', err);
    res.status(500).json({ error: 'Failed to get competitors' });
  }
});

/** POST /api/v1/intelligence/competitors — Add a competitor account */
router.post('/competitors', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { platform, handle, displayName } = req.body;
    if (!platform || !handle) {
      return res.status(400).json({ error: 'platform and handle are required' });
    }

    // Limit to 10 competitors per user
    const count = await prisma.competitorAccount.count({ where: { userId } });
    if (count >= 10) {
      return res.status(400).json({ error: 'Maximum 10 competitor accounts allowed' });
    }

    const competitor = await prisma.competitorAccount.create({
      data: {
        userId,
        platform,
        handle: handle.startsWith('@') ? handle : `@${handle}`,
        displayName: displayName || null,
      },
    });

    res.json({ success: true, data: competitor });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(400).json({ error: 'This competitor is already being tracked' });
    }
    console.error('[Intelligence] Error adding competitor:', err);
    res.status(500).json({ error: 'Failed to add competitor' });
  }
});

/** DELETE /api/v1/intelligence/competitors/:id — Remove a competitor account */
router.delete('/competitors/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await prisma.competitorAccount.deleteMany({
      where: { id: req.params.id as string, userId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Intelligence] Error deleting competitor:', err);
    res.status(500).json({ error: 'Failed to delete competitor' });
  }
});

export default router;
