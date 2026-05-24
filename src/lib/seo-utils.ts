// ─── SEO Analysis Utilities (Pure Client-Side) ──────────────────────

/**
 * Common English stop words to exclude from keyword density analysis.
 */
const STOP_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for",
  "not", "on", "with", "he", "as", "you", "do", "at", "this", "but", "his",
  "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my",
  "one", "all", "would", "there", "their", "what", "so", "up", "out", "if",
  "about", "who", "get", "which", "go", "me", "when", "make", "can", "like",
  "time", "no", "just", "him", "know", "take", "people", "into", "year", "your",
  "good", "some", "could", "them", "see", "other", "than", "then", "now", "look",
  "only", "come", "its", "over", "think", "also", "back", "after", "use", "two",
  "how", "our", "work", "first", "well", "way", "even", "new", "want", "because",
  "any", "these", "give", "day", "most", "us", "is", "are", "was", "were", "been",
  "has", "had", "did", "does", "doing", "more", "very", "much", "such", "here",
  "each", "every", "both", "few", "those", "being", "between", "own", "same",
  "should", "while", "where", "why", "before", "must", "through", "during",
  "may", "might", "shall", "using", "used", "many", "still", "need", "let",
]);

/**
 * Count syllables in a word using a heuristic approach.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;

  let count = 0;
  const vowels = "aeiouy";
  let prevVowel = false;

  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) {
      count++;
    }
    prevVowel = isVowel;
  }

  // Adjust for silent e
  if (w.endsWith("e") && count > 1) count--;
  // Adjust for -le endings
  if (w.endsWith("le") && w.length > 2 && !vowels.includes(w[w.length - 3])) count++;

  return Math.max(1, count);
}

/**
 * Strip markdown formatting to get plain text.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`[^`]+`/g, "")        // inline code
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1") // links → text
    .replace(/#{1,6}\s+/g, "")       // headings
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2")    // italic
    .replace(/~~(.*?)~~/g, "$1")       // strikethrough
    .replace(/^[>\-*+]\s+/gm, "")     // blockquotes, lists
    .replace(/^\d+\.\s+/gm, "")       // ordered lists
    .replace(/---+/g, "")             // horizontal rules
    .replace(/\n{2,}/g, "\n")         // collapse newlines
    .trim();
}

/**
 * Calculate Flesch Reading Ease score.
 * 90-100: Very Easy | 80-89: Easy | 70-79: Fairly Easy
 * 60-69: Standard | 50-59: Fairly Difficult | 30-49: Difficult | 0-29: Very Difficult
 */
export function calculateFleschScore(text: string): number {
  const plainText = stripMarkdown(text);
  const sentences = plainText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = plainText.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0 || sentences.length === 0) return 0;

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const score =
    206.835 -
    1.015 * (words.length / sentences.length) -
    84.6 * (totalSyllables / words.length);

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get a human-readable label for the Flesch score.
 */
export function getFleschLabel(score: number): string {
  if (score >= 90) return "Very Easy";
  if (score >= 80) return "Easy";
  if (score >= 70) return "Fairly Easy";
  if (score >= 60) return "Standard";
  if (score >= 50) return "Fairly Difficult";
  if (score >= 30) return "Difficult";
  return "Very Difficult";
}

/**
 * Extract top N keywords by frequency (excluding stop words).
 */
export function extractKeywordDensity(
  text: string,
  topN = 5
): Array<{ word: string; count: number; percentage: number }> {
  const plainText = stripMarkdown(text);
  const words = plainText
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  const totalWords = words.length;
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([word, count]) => ({
      word,
      count,
      percentage: totalWords > 0 ? Math.round((count / totalWords) * 1000) / 10 : 0,
    }));
}

/**
 * Count various content metrics from markdown.
 */
export function getContentMetrics(markdown: string) {
  const plainText = stripMarkdown(markdown);
  const words = plainText.split(/\s+/).filter((w) => w.length > 0);
  const sentences = plainText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const paragraphs = markdown.split(/\n\n+/).filter((p) => p.trim().length > 0);

  const h1Count = (markdown.match(/^#\s+/gm) || []).length;
  const h2Count = (markdown.match(/^##\s+/gm) || []).length;
  const h3Count = (markdown.match(/^###\s+/gm) || []).length;

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    h1Count,
    h2Count,
    h3Count,
    headingCount: h1Count + h2Count + h3Count,
    avgSentenceLength: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
  };
}

export interface SeoCheckItem {
  label: string;
  passed: boolean;
  detail: string;
}

/**
 * Run an SEO checklist against the markdown and SEO metadata.
 */
export function analyzeSeoChecklist(
  markdown: string,
  seo: { title?: string; metaDescription?: string; tags?: string[]; readingTime?: string }
): SeoCheckItem[] {
  const metrics = getContentMetrics(markdown);
  const hasBold = /\*\*[^*]+\*\*/.test(markdown) || /__[^_]+__/.test(markdown);
  const hasConclusion =
    /conclusion|key takeaway|takeaway|summary|wrap.?up|in.?closing/i.test(markdown);

  return [
    {
      label: "Has H1 heading",
      passed: metrics.h1Count >= 1,
      detail: metrics.h1Count >= 1 ? `Found ${metrics.h1Count} H1` : "No H1 heading found",
    },
    {
      label: "Meta description length",
      passed:
        !!seo.metaDescription &&
        seo.metaDescription.length >= 120 &&
        seo.metaDescription.length <= 160,
      detail: seo.metaDescription
        ? `${seo.metaDescription.length} chars (ideal: 120-160)`
        : "No meta description",
    },
    {
      label: "Title length",
      passed: !!seo.title && seo.title.length >= 30 && seo.title.length <= 70,
      detail: seo.title ? `${seo.title.length} chars (ideal: 30-70)` : "No title",
    },
    {
      label: "Has at least 3 tags",
      passed: !!seo.tags && seo.tags.length >= 3,
      detail: `${seo.tags?.length || 0} tags found`,
    },
    {
      label: "Has conclusion / takeaways",
      passed: hasConclusion,
      detail: hasConclusion ? "Conclusion section found" : "No conclusion detected",
    },
    {
      label: "Uses bold emphasis",
      passed: hasBold,
      detail: hasBold ? "Bold text found" : "No bold emphasis detected",
    },
    {
      label: "Has subheadings (H2/H3)",
      passed: metrics.h2Count + metrics.h3Count >= 2,
      detail: `${metrics.h2Count} H2 + ${metrics.h3Count} H3 found`,
    },
    {
      label: "Reading time present",
      passed: !!seo.readingTime,
      detail: seo.readingTime || "Not set",
    },
  ];
}

/**
 * Calculate an overall SEO score (0-100) from all metrics.
 */
export function calculateOverallScore(
  markdown: string,
  seo: { title?: string; metaDescription?: string; tags?: string[]; readingTime?: string }
): number {
  const checklist = analyzeSeoChecklist(markdown, seo);
  const metrics = getContentMetrics(markdown);
  const flesch = calculateFleschScore(markdown);

  // Checklist score: 50% weight (each item is equal)
  const checklistScore = (checklist.filter((c) => c.passed).length / checklist.length) * 50;

  // Readability score: 25% weight
  const readabilityScore = Math.min(25, (flesch / 100) * 25);

  // Content depth score: 25% weight
  let depthScore = 0;
  // Word count bonus (target: 400-1500)
  if (metrics.wordCount >= 400) depthScore += 8;
  if (metrics.wordCount >= 800) depthScore += 4;
  // Structure bonus
  if (metrics.headingCount >= 3) depthScore += 5;
  if (metrics.paragraphCount >= 5) depthScore += 4;
  // Sentence variety
  if (metrics.avgSentenceLength >= 10 && metrics.avgSentenceLength <= 25) depthScore += 4;

  return Math.min(100, Math.round(checklistScore + readabilityScore + depthScore));
}
