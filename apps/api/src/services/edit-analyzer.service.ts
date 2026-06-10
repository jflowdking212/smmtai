import { prisma } from '../config/database.js';

// ============================================================
// Edit Analyzer Service
// ============================================================
// Compares AI-generated content with user's final edits to learn their
// brand voice. Updates the UserVoiceModel with formality, energy, emoji
// usage, CTA style, hashtag patterns, and vocabulary preferences.

/**
 * Analyze a single edit and store the diff.
 */
export async function analyzeEdit(
  userId: string,
  postId: string | null,
  originalContent: string,
  editedContent: string,
) {
  // Skip if content is identical (no learning signal)
  if (originalContent.trim() === editedContent.trim()) return null;

  // Calculate diff summary
  const diffSummary = computeDiffSummary(originalContent, editedContent);

  // Store the edit history
  const editRecord = await prisma.userEditHistory.create({
    data: {
      userId,
      postId,
      originalContent,
      editedContent,
      diffSummary: diffSummary as any,
    },
  });

  // Check if we should recalculate voice model (every 5 edits)
  const editCount = await prisma.userEditHistory.count({ where: { userId } });
  if (editCount % 5 === 0 || editCount === 1) {
    await recalculateVoiceModel(userId);
  }

  return editRecord;
}

/**
 * Compute a structured diff summary between original and edited content.
 */
function computeDiffSummary(original: string, edited: string) {
  const originalWords = original.toLowerCase().split(/\s+/).filter(Boolean);
  const editedWords = edited.toLowerCase().split(/\s+/).filter(Boolean);

  const originalSet = new Set(originalWords);
  const editedSet = new Set(editedWords);

  const additions = editedWords.filter((w) => !originalSet.has(w));
  const removals = originalWords.filter((w) => !editedSet.has(w));

  // Detect tone shift
  const casualIndicators = ['lol', 'haha', 'omg', 'btw', 'gonna', 'wanna', 'gotta', 'hey', 'yo', '😂', '🤣', '💀'];
  const formalIndicators = ['therefore', 'however', 'furthermore', 'consequently', 'regarding', 'subsequently'];

  const editedCasualCount = editedWords.filter((w) => casualIndicators.includes(w)).length;
  const editedFormalCount = editedWords.filter((w) => formalIndicators.includes(w)).length;
  const originalCasualCount = originalWords.filter((w) => casualIndicators.includes(w)).length;
  const originalFormalCount = originalWords.filter((w) => formalIndicators.includes(w)).length;

  let toneShift = 'neutral';
  if (editedCasualCount > originalCasualCount) toneShift = 'more casual';
  if (editedFormalCount > originalFormalCount) toneShift = 'more formal';

  return {
    additions: additions.slice(0, 20),
    removals: removals.slice(0, 20),
    toneShift,
    addedCount: additions.length,
    removedCount: removals.length,
    lengthChange: edited.length - original.length,
  };
}

/**
 * Recalculate the voice model from all edit history.
 */
export async function recalculateVoiceModel(userId: string) {
  const edits = await prisma.userEditHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100, // last 100 edits for analysis
    select: { editedContent: true, diffSummary: true },
  });

  if (edits.length === 0) return null;

  // Analyze all edited content for voice characteristics
  let totalFormality = 0;
  let totalEnergy = 0;
  let totalSentenceLength = 0;
  let totalEmojiRate = 0;
  let sentenceCount = 0;
  const wordFrequency: Record<string, number> = {};
  const hashtagFrequency: Record<string, number> = {};
  let totalHashtags = 0;
  let ctaDirectCount = 0;
  let ctaSoftCount = 0;
  let ctaQuestionCount = 0;
  let totalPosts = 0;

  for (const edit of edits) {
    const content = edit.editedContent;
    const words = content.split(/\s+/).filter(Boolean);
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    totalPosts++;

    // Formality score
    const formalWords = ['however', 'therefore', 'furthermore', 'consequently', 'regarding', 'professional', 'ensure', 'implement'];
    const casualWords = ['hey', 'lol', 'btw', 'gonna', 'wanna', 'awesome', 'cool', 'yo', 'haha'];
    const formalCount = words.filter((w) => formalWords.includes(w.toLowerCase())).length;
    const casualCount = words.filter((w) => casualWords.includes(w.toLowerCase())).length;
    totalFormality += formalCount > casualCount ? 0.7 : casualCount > formalCount ? 0.3 : 0.5;

    // Energy score (exclamation marks, caps words, power words)
    const exclamations = (content.match(/!/g) || []).length;
    const capsWords = words.filter((w) => w === w.toUpperCase() && w.length > 2).length;
    const powerWords = ['incredible', 'amazing', 'revolutionary', 'powerful', 'unstoppable', 'explosive', 'game-changing'];
    const powerCount = words.filter((w) => powerWords.includes(w.toLowerCase())).length;
    const energySignals = exclamations + capsWords + powerCount;
    totalEnergy += Math.min(1, energySignals / Math.max(1, words.length) * 10);

    // Sentence length
    if (sentences.length > 0) {
      for (const s of sentences) {
        totalSentenceLength += s.trim().split(/\s+/).length;
        sentenceCount++;
      }
    }

    // Emoji usage
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojiCount = (content.match(emojiRegex) || []).length;
    totalEmojiRate += words.length > 0 ? (emojiCount / words.length) * 100 : 0;

    // Word frequency (for vocabulary samples)
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'to', 'for', 'in', 'on', 'at', 'of', 'and', 'or', 'but', 'it', 'i', 'you', 'your', 'my', 'we', 'our', 'this', 'that', 'with']);
    for (const word of words) {
      const w = word.toLowerCase().replace(/[^a-z]/g, '');
      if (w.length > 2 && !stopWords.has(w)) {
        wordFrequency[w] = (wordFrequency[w] || 0) + 1;
      }
    }

    // Hashtag patterns
    const hashtags = content.match(/#[\w]+/g) || [];
    totalHashtags += hashtags.length;
    for (const tag of hashtags) {
      hashtagFrequency[tag.toLowerCase()] = (hashtagFrequency[tag.toLowerCase()] || 0) + 1;
    }

    // CTA style detection
    const lastSentence = sentences[sentences.length - 1]?.trim() || '';
    if (lastSentence.endsWith('?')) ctaQuestionCount++;
    else if (/\b(click|buy|grab|get|start|join|sign up|subscribe|download|book|try)\b/i.test(lastSentence)) ctaDirectCount++;
    else if (/\b(consider|explore|discover|learn|check out|feel free|might|could)\b/i.test(lastSentence)) ctaSoftCount++;
  }

  // Compute averages
  const avgFormality = totalFormality / totalPosts;
  const avgEnergy = totalEnergy / totalPosts;
  const avgSentenceLength = sentenceCount > 0 ? totalSentenceLength / sentenceCount : null;
  const avgEmojiRate = totalEmojiRate / totalPosts;
  const avgHashtagCount = totalHashtags / totalPosts;

  // Top vocabulary words
  const sortedWords = Object.entries(wordFrequency).sort((a, b) => b[1] - a[1]);
  const preferredWords = sortedWords.slice(0, 15).map(([word]) => word);

  // Top hashtags
  const sortedHashtags = Object.entries(hashtagFrequency).sort((a, b) => b[1] - a[1]);
  const preferredHashtags = sortedHashtags.slice(0, 10).map(([tag]) => tag);

  // CTA style
  let ctaStyle = 'soft';
  if (ctaDirectCount >= ctaSoftCount && ctaDirectCount >= ctaQuestionCount) ctaStyle = 'direct';
  else if (ctaQuestionCount >= ctaSoftCount && ctaQuestionCount >= ctaDirectCount) ctaStyle = 'question-based';

  // Confidence score: higher with more samples, caps at 1.0
  const confidenceScore = Math.min(1, edits.length / 30);

  // Upsert voice model
  return prisma.userVoiceModel.upsert({
    where: { userId },
    create: {
      userId,
      formalityScore: avgFormality,
      energyScore: avgEnergy,
      avgSentenceLength,
      vocabularySamples: { preferredWords, avoidedWords: [] },
      emojiUsageRate: avgEmojiRate,
      ctaStyle,
      hashtagPatterns: {
        avgCount: Math.round(avgHashtagCount),
        preferred: preferredHashtags,
      },
      confidenceScore,
      samplesAnalyzed: edits.length,
    },
    update: {
      formalityScore: avgFormality,
      energyScore: avgEnergy,
      avgSentenceLength,
      vocabularySamples: { preferredWords, avoidedWords: [] },
      emojiUsageRate: avgEmojiRate,
      ctaStyle,
      hashtagPatterns: {
        avgCount: Math.round(avgHashtagCount),
        preferred: preferredHashtags,
      },
      confidenceScore,
      samplesAnalyzed: edits.length,
    },
  });
}

/**
 * Get the current voice model for a user.
 */
export async function getVoiceModel(userId: string) {
  return prisma.userVoiceModel.findUnique({ where: { userId } });
}
