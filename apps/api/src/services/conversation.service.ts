import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export async function startConversation(sessionId: string) {
  return prisma.chatConversation.create({
    data: { sessionId, messages: [], tags: [] },
  });
}

export async function addMessage(sessionId: string, message: ChatMessage) {
  const conversation = await prisma.chatConversation.findUnique({ where: { sessionId } });

  if (!conversation) {
    return prisma.chatConversation.create({
      data: { sessionId, messages: [message] as unknown as Prisma.InputJsonValue, tags: [] },
    });
  }

  const messages = (conversation.messages as unknown as ChatMessage[]) || [];
  messages.push(message);

  return prisma.chatConversation.update({
    where: { sessionId },
    data: { messages: messages as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
  });
}

export async function updateCustomerInfo(
  sessionId: string,
  info: { name?: string; email?: string; phone?: string },
) {
  try {
    return await prisma.chatConversation.update({
      where: { sessionId },
      data: {
        ...(info.name && { customerName: info.name }),
        ...(info.email && { customerEmail: info.email }),
        ...(info.phone && { customerPhone: info.phone }),
      },
    });
  } catch {
    return null;
  }
}

export async function endConversation(sessionId: string, summary?: string) {
  return prisma.chatConversation.update({
    where: { sessionId },
    data: { status: 'ENDED', endedAt: new Date(), summary },
  });
}

export async function transferToAgent(sessionId: string, agentId: string, reason?: string) {
  return prisma.chatConversation.update({
    where: { sessionId },
    data: { status: 'TRANSFERRED', transferredTo: agentId, transferReason: reason },
  });
}

export async function getConversation(sessionId: string) {
  return prisma.chatConversation.findUnique({ where: { sessionId } });
}

export async function deleteConversation(sessionId: string) {
  try {
    await prisma.chatConversation.delete({ where: { sessionId } });
    return { success: true, message: 'Conversation deleted successfully' };
  } catch {
    return { success: false, message: 'Failed to delete conversation' };
  }
}

export async function getAllConversations(filters?: { status?: string; email?: string }) {
  return prisma.chatConversation.findMany({
    where: {
      ...(filters?.status && { status: filters.status as any }),
      ...(filters?.email && { customerEmail: filters.email }),
    },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });
}

export async function getConversationStats() {
  const [total, active, transferred, ended] = await Promise.all([
    prisma.chatConversation.count(),
    prisma.chatConversation.count({ where: { status: 'ACTIVE' } }),
    prisma.chatConversation.count({ where: { status: 'TRANSFERRED' } }),
    prisma.chatConversation.count({ where: { status: 'ENDED' } }),
  ]);
  return { total, active, transferred, ended };
}

export async function addTags(sessionId: string, tags: string[]) {
  const conversation = await prisma.chatConversation.findUnique({ where: { sessionId } });
  if (!conversation) return null;
  const newTags = [...new Set([...(conversation.tags || []), ...tags])];
  return prisma.chatConversation.update({ where: { sessionId }, data: { tags: newTags } });
}

export async function updateSentiment(sessionId: string, sentiment: string) {
  return prisma.chatConversation.update({ where: { sessionId }, data: { sentiment } });
}
