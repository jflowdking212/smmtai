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
    const queryEmbedding = await generateEmbedding(query);
    const entries = await prisma.knowledgeBase.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });
    return entries
      .map((entry) => {
        const { embedding, ...rest } = entry;
        return { ...rest, similarity: cosineSimilarity(queryEmbedding, embedding) };
      })
      .filter((e) => e.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit) as any;
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
