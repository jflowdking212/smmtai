import { Router, Response, NextFunction } from 'express';
import { authenticate, optionalAuthenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import * as chatService from '../services/chat.service.js';
import * as conversationService from '../services/conversation.service.js';
import * as knowledgeBaseService from '../services/knowledge-base.service.js';

export const chatRouter = Router();

// Public endpoints (chatbot widget doesn't require auth)

chatRouter.post('/message', optionalAuthenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { message, context, sessionId, customerInfo, userId: bodyUserId, workspaceId: bodyWorkspaceId } = req.body;

    // Primary identity from JWT (set by optionalAuthenticate)
    let userId = (req as AuthRequest).userId;
    let workspaceId = (req as AuthRequest).workspaceId;

    // Fallback: accept userId/workspaceId from body when the in-memory accessToken
    // hasn't been refreshed yet (it is not persisted to localStorage by design).
    // We validate the pair against the DB to prevent spoofing.
    if (!userId && bodyUserId && bodyWorkspaceId) {
      const membership = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: bodyUserId, workspaceId: bodyWorkspaceId } }
      });
      if (membership) {
        userId = bodyUserId;
        workspaceId = bodyWorkspaceId;
      }
    }

    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    // Update customer info if provided
    if (sessionId && customerInfo) {
      await conversationService.updateCustomerInfo(sessionId, customerInfo);
    }

    // Check for agent transfer
    if (chatService.shouldTransferToAgent(message)) {
      return res.json({
        needsTransfer: true,
        message: 'I understand you need additional help. Let me connect you with a human agent.',
      });
    }

    const result = await chatService.chatWithCustomer(message, context, sessionId, userId, workspaceId);
    res.json(result);
  } catch (err) { next(err); }
});

// ---- Voice Transcription (Whisper) ----

import multer from 'multer';
import { transcribeAudio, generateSpeech } from '../services/openai.service.js';

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB — Whisper's max
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/x-m4a'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are accepted'));
    }
  },
});

chatRouter.post('/transcribe', optionalAuthenticate, audioUpload.single('audio'), async (req: any, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided' });
    }

    const ext = req.file.mimetype.includes('webm') ? 'webm'
      : req.file.mimetype.includes('ogg') ? 'ogg'
      : req.file.mimetype.includes('mp4') ? 'mp4'
      : req.file.mimetype.includes('mpeg') ? 'mp3'
      : req.file.mimetype.includes('wav') ? 'wav'
      : req.file.mimetype.includes('flac') ? 'flac'
      : 'webm';

    const filename = `voice_${Date.now()}.${ext}`;
    const transcript = await transcribeAudio(req.file.buffer, filename);

    if (!transcript) {
      return res.status(422).json({ success: false, error: 'Could not transcribe audio — please speak clearly and try again.' });
    }

    res.json({ success: true, transcript });
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('401') || msg.includes('invalid api')) {
      return res.status(503).json({ success: false, error: 'Transcription not available — invalid OpenAI API key.' });
    }
    next(err);
  }
});

chatRouter.post('/tts', optionalAuthenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const audioBuffer = await generateSpeech(text);
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.send(audioBuffer);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('401') || msg.includes('invalid api')) {
      return res.status(503).json({ success: false, error: 'TTS not available — invalid OpenAI API key.' });
    }
    next(err);
  }
});

chatRouter.get('/conversations/history/:sessionId', async (req: any, res: Response, next: NextFunction) => {
  try {
    const conversation = await conversationService.getConversation(req.params.sessionId);
    if (!conversation) {
      return res.json({ success: false, messages: [], error: 'Conversation not found' });
    }
    res.json({
      success: true,
      messages: conversation.messages || [],
      customerInfo: { name: conversation.customerName, email: conversation.customerEmail, phone: conversation.customerPhone },
    });
  } catch (err) { next(err); }
});

// Protected endpoints (admin)

chatRouter.post('/conversation/start', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await conversationService.startConversation(req.body.sessionId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

chatRouter.post('/conversation/end', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await conversationService.endConversation(req.body.sessionId, req.body.summary);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

chatRouter.post('/conversation/transfer', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await conversationService.transferToAgent(req.body.sessionId, req.body.agentId, req.body.reason);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

chatRouter.get('/conversation/:sessionId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await conversationService.getConversation(req.params.sessionId as string);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

chatRouter.delete('/conversation/:sessionId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await conversationService.deleteConversation(req.params.sessionId as string);
    res.json(result);
  } catch (err) { next(err); }
});

chatRouter.get('/conversations', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await conversationService.getAllConversations({
      status: req.query.status as string | undefined,
      email: req.query.email as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

chatRouter.get('/conversations/stats', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await conversationService.getConversationStats();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Support agent heartbeat — marks agent as online
chatRouter.post('/agent/heartbeat', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../config/database.js');
    const agentId = req.userId;
    const record = await prisma.systemConfig.findUnique({ where: { key: 'support_agents_online' } });
    let agents: Array<{ id: string; lastSeen: number }> = [];
    if (record?.value) {
      try { agents = JSON.parse(record.value); } catch {}
    }
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    agents = agents.filter((a) => a.lastSeen > fiveMinAgo && a.id !== agentId);
    agents.push({ id: agentId as string, lastSeen: Date.now() });
    await prisma.systemConfig.upsert({
      where: { key: 'support_agents_online' },
      update: { value: JSON.stringify(agents) },
      create: { key: 'support_agents_online', value: JSON.stringify(agents), encrypted: false },
    });
    res.json({ success: true, onlineAgents: agents.length });
  } catch (err) { next(err); }
});

// Knowledge Base endpoints (admin)

chatRouter.post('/knowledge', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await knowledgeBaseService.upsertKnowledge(req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

chatRouter.get('/knowledge', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await knowledgeBaseService.getAllKnowledge({
      category: req.query.category as string | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

chatRouter.post('/knowledge/search', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await knowledgeBaseService.searchKnowledge(req.body.query, req.body.limit);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

chatRouter.post('/knowledge/bulk-import', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await knowledgeBaseService.bulkImport(req.body.entries);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

chatRouter.put('/knowledge/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await knowledgeBaseService.upsertKnowledge({ id: req.params.id, ...req.body });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

chatRouter.delete('/knowledge/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await knowledgeBaseService.deleteKnowledge(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});
