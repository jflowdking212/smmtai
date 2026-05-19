import { prisma } from '../config/database.js';
import { generateEmbedding } from './openai.service.js';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function upsertKnowledge(data: {
  id?: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  priority?: number;
}) {
  const embeddingPromise = generateEmbedding(`${data.title} ${data.content}`).catch((err) => {
    console.error('Failed to generate embedding:', err);
    return new Array(1536).fill(0).map(() => Math.random());
  });

  if (data.id) {
    const result = await prisma.knowledgeBase.update({
      where: { id: data.id },
      data: { title: data.title, content: data.content, category: data.category, tags: data.tags || [], priority: data.priority || 0 },
    });
    embeddingPromise.then((embedding) => {
      prisma.knowledgeBase.update({ where: { id: data.id }, data: { embedding } }).catch(console.error);
    });
    const { embedding, ...rest } = result as any;
    return rest;
  }

  const result = await prisma.knowledgeBase.create({
    data: {
      title: data.title,
      content: data.content,
      category: data.category,
      tags: data.tags || [],
      embedding: new Array(1536).fill(0),
      priority: data.priority || 0,
    },
  });
  embeddingPromise.then((embedding) => {
    prisma.knowledgeBase.update({ where: { id: result.id }, data: { embedding } }).catch(console.error);
  });
  const { embedding, ...rest } = result as any;
  return rest;
}

export async function searchKnowledge(query: string, limit = 5) {
  try {
    const entries = await prisma.knowledgeBase.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    if (entries.length === 0) return [];

    // Try semantic search via embeddings
    let results: Array<any> = [];
    try {
      const queryEmbedding = await generateEmbedding(query);
      // Real embeddings always have negative values; random fallback (Math.random()) is all positive
      const hasRealEmbeddings = entries.some((e) => e.embedding.length > 0 && e.embedding.some((v) => v < -0.001));
      if (hasRealEmbeddings) {
        results = entries
          .map((entry) => {
            const { embedding, ...rest } = entry;
            return { ...rest, similarity: cosineSimilarity(queryEmbedding, embedding) };
          })
          .filter((e) => e.similarity > 0.25)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
      }
    } catch {}

    // Fallback: keyword matching when embeddings unavailable or returned no results
    if (results.length === 0) {
      const STOP_WORDS = new Set([
        'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'he', 'she',
        'the', 'a', 'an', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
        'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may',
        'have', 'has', 'had', 'having', 'to', 'of', 'in', 'for', 'on', 'at', 'by',
        'with', 'from', 'up', 'out', 'not', 'no', 'so', 'if', 'or', 'and', 'but',
        'that', 'this', 'what', 'how', 'who', 'which', 'when', 'where', 'why',
        'all', 'each', 'some', 'any', 'just', 'about', 'need', 'want', 'get',
        'also', 'into', 'than', 'then', 'them', 'these', 'there', 'their',
      ]);

      // Synonyms to expand query for better matching
      const SYNONYMS: Record<string, string[]> = {
        'link': ['connect', 'connecting', 'connection', 'add', 'integrate', 'setup', 'set up'],
        'connect': ['link', 'linking', 'add', 'integrate', 'setup', 'set up', 'connection'],
        'cost': ['price', 'pricing', 'plan', 'plans', 'subscription', 'billing', 'pay', 'payment', 'fee'],
        'price': ['cost', 'pricing', 'plan', 'plans', 'subscription', 'billing', 'pay', 'payment', 'fee'],
        'schedule': ['scheduling', 'plan', 'queue', 'timer', 'later', 'automate', 'calendar'],
        'post': ['publish', 'share', 'compose', 'create', 'content', 'posting'],
        'help': ['support', 'assist', 'guide', 'tutorial', 'faq', 'troubleshoot'],
        'fix': ['troubleshoot', 'solve', 'resolve', 'repair', 'error', 'problem', 'issue'],
        'error': ['problem', 'issue', 'bug', 'fail', 'failure', 'trouble', 'troubleshoot'],
        'account': ['profile', 'login', 'settings', 'connection'],
        'delete': ['remove', 'disconnect', 'unlink'],
        'change': ['update', 'edit', 'modify', 'settings'],
        'analytics': ['stats', 'statistics', 'metrics', 'performance', 'insights', 'data', 'report'],
        'design': ['editor', 'graphic', 'template', 'canvas', 'image', 'visual'],
        'ai': ['artificial intelligence', 'generate', 'assistant', 'chatbot', 'smart'],
        'team': ['collaborate', 'collaboration', 'member', 'invite', 'role', 'permission'],
        'facebook': ['fb', 'meta'],
        'twitter': ['x', 'tweet'],
        'instagram': ['ig', 'insta'],
        'tiktok': ['tik tok'],
        'youtube': ['yt', 'video'],
        'linkedin': ['linked in'],
        'app': ['platform', 'tool', 'service', 'smmtai', 'ee smmtai', 'features', 'overview'],
        'use': ['using', 'usage', 'guide', 'tutorial', 'steps', 'instructions'],
        'create': ['compose', 'make', 'build', 'write', 'new'],
        'image': ['photo', 'picture', 'graphic', 'media', 'visual'],
        'upload': ['attach', 'add', 'import', 'media'],
        'billing': ['payment', 'invoice', 'charge', 'subscription', 'plan', 'pricing'],
        'password': ['security', 'login', 'credential', 'authentication'],
      };

      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

      // Expand with synonyms
      const expandedWords = new Set(queryWords);
      for (const word of queryWords) {
        const syns = SYNONYMS[word];
        if (syns) syns.forEach((s) => expandedWords.add(s));
      }

      results = entries
        .map((entry) => {
          const { embedding, ...rest } = entry;
          const titleLower = entry.title.toLowerCase();
          const tagsStr = (entry.tags || []).join(' ').toLowerCase();
          const contentLower = entry.content.toLowerCase();
          const fullText = `${titleLower} ${tagsStr} ${contentLower}`;

          let score = 0;

          // Exact full-phrase match in title (huge boost)
          if (titleLower.includes(queryLower)) score += 10;
          // Exact full-phrase match in tags
          if (tagsStr.includes(queryLower)) score += 7;
          // Exact full-phrase match in content
          if (contentLower.includes(queryLower)) score += 3;

          // Per-word scoring with field weighting
          for (const word of queryWords) {
            if (titleLower.includes(word)) score += 4;
            if (tagsStr.includes(word)) score += 3;
            if (contentLower.includes(word)) score += 1;
          }

          // Synonym matches (lower weight)
          for (const syn of expandedWords) {
            if (!queryWords.includes(syn)) {
              if (titleLower.includes(syn)) score += 2;
              if (tagsStr.includes(syn)) score += 2;
              if (contentLower.includes(syn)) score += 0.5;
            }
          }

          // Priority boost
          score += (entry.priority || 0) * 0.1;

          // Normalize: use meaningful keywords count for normalization
          const maxPossible = queryWords.length * 8 + 10; // title+tag+content per word + phrase bonus
          const similarity = Math.min(score / Math.max(maxPossible, 1), 1);
          return { ...rest, similarity };
        })
        .filter((e) => e.similarity > 0.05)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    }

    return results;
  } catch (error) {
    console.error('Knowledge search error:', error);
    return [];
  }
}

export async function getAllKnowledge(filters?: { category?: string; isActive?: boolean }) {
  const entries = await prisma.knowledgeBase.findMany({
    where: {
      ...(filters?.category && { category: filters.category }),
      ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  return entries.map(({ embedding, ...entry }) => entry);
}

export async function deleteKnowledge(id: string) {
  return prisma.knowledgeBase.delete({ where: { id } });
}

export async function bulkImport(
  entries: Array<{ title: string; content: string; category?: string; tags?: string[] }>,
) {
  if (!Array.isArray(entries)) throw new Error('Entries must be an array');

  const created: any[] = [];
  const errors: any[] = [];

  for (const entry of entries) {
    try {
      if (!entry.title || !entry.content) {
        errors.push({ title: entry.title || 'Unknown', error: 'Missing required fields: title and content' });
        continue;
      }
      const result = await upsertKnowledge(entry);
      created.push(result);
    } catch (error) {
      errors.push({ title: entry.title || 'Unknown', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return { success: created.length > 0, imported: created.length, total: entries.length, errors: errors.length > 0 ? errors : undefined };
}
