import {
  type MediaAuthenticityEvidence,
  type MediaAuthenticityEvidenceKind,
  type MediaAuthenticityItem,
  type MediaAuthenticityModelResult,
  type MediaAuthenticityResult,
  type MediaAuthenticityStatus,
} from '@/lib/types';

export interface MediaAuthenticityInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer<ArrayBufferLike>;
}

export interface DetectorContext {
  file: MediaAuthenticityInput;
  mediaType: MediaAuthenticityItem['media_type'];
  sniffedMime: string;
  metadata: Record<string, unknown>;
  textSample: string;
  byteStrings: string[];
}

export interface AuthenticityDetector {
  id: string;
  name: string;
  modalities: MediaAuthenticityModelResult['modality'][];
  weight: number;
  analyze(context: DetectorContext): Promise<MediaAuthenticityModelResult | null>;
}

type EndpointDetectorConfig = {
  id: string;
  name?: string;
  url: string;
  apiKeyEnv?: string;
  modelName?: string;
  modalities?: MediaAuthenticityModelResult['modality'][];
  weight?: number;
};

const SUPPORTED_MEDIA_TYPES = new Set(['image', 'audio', 'video', 'document', 'text']);

const GENERATIVE_MARKERS = [
  'ai-generated',
  'ai generated',
  'stable diffusion',
  'midjourney',
  'dall-e',
  'dalle',
  'firefly',
  'runway',
  'sora',
  'pika',
  'synthesia',
  'elevenlabs',
  'descript',
  'chatgpt',
  'gpt-',
  'synthid',
];

const EDITING_MARKERS = [
  'photoshop',
  'lightroom',
  'after effects',
  'premiere',
  'final cut',
  'capcut',
  'canva',
  'snapseed',
  'facetune',
  'davinci',
  'audition',
  'audacity',
];

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  return clampPercent(values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getExtension(fileName: string): string {
  const cleanName = fileName.split('?')[0]?.toLowerCase() || '';
  const match = cleanName.match(/\.([a-z0-9]+)(?:\.enc)?$/);
  return match?.[1] || '';
}

function detectMediaType(mimeType: string, fileName: string): MediaAuthenticityItem['media_type'] {
  const lowerMime = mimeType.toLowerCase();
  const ext = getExtension(fileName);
  if (lowerMime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (lowerMime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio';
  if (lowerMime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) return 'video';
  if (lowerMime.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'log'].includes(ext)) return 'text';
  if (
    lowerMime === 'application/pdf' ||
    lowerMime.includes('wordprocessingml') ||
    lowerMime.includes('msword') ||
    ['pdf', 'doc', 'docx', 'rtf'].includes(ext)
  ) {
    return 'document';
  }
  return 'other';
}

function sniffMime(buffer: Buffer): string {
  if (buffer.length < 12) return '';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav';
  if (buffer.subarray(0, 4).toString('ascii') === '%PDF') return 'application/pdf';
  return '';
}

function extractByteStrings(buffer: Buffer): string[] {
  const ascii = buffer
    .subarray(0, Math.min(buffer.length, 2_000_000))
    .toString('latin1')
    .replace(/[^\x20-\x7e]+/g, '\n');

  return ascii
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length >= 4)
    .slice(0, 600);
}

function decodeTextSample(buffer: Buffer, mimeType: string, fileName: string): string {
  const mediaType = detectMediaType(mimeType, fileName);
  if (mediaType !== 'text') return '';
  return normalizeText(buffer.subarray(0, 150_000).toString('utf8')).slice(0, 12000);
}

function calculateEntropy(buffer: Buffer): number {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1_500_000));
  if (sample.length === 0) return 0;

  const counts = new Array<number>(256).fill(0);
  for (const byte of sample) counts[byte] += 1;

  let entropy = 0;
  for (const count of counts) {
    if (!count) continue;
    const probability = count / sample.length;
    entropy -= probability * Math.log2(probability);
  }
  return Number(entropy.toFixed(3));
}

function parseImageDimensions(buffer: Buffer, mimeType: string): Record<string, unknown> {
  if (mimeType === 'image/png' && buffer.length >= 24) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (mimeType === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }

  if (mimeType === 'image/gif' && buffer.length >= 10) {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
    };
  }

  return {};
}

function buildMetadata(context: Omit<DetectorContext, 'metadata'>): Record<string, unknown> {
  const normalizedStrings = context.byteStrings.map((item) => item.toLowerCase());
  const matchingStrings = (terms: string[]) =>
    Array.from(new Set(normalizedStrings.flatMap((item) => terms.filter((term) => item.includes(term))))).slice(0, 10);

  const containerMarkers = {
    has_xmp: normalizedStrings.some((item) => item.includes('xmp')),
    has_exif: normalizedStrings.some((item) => item.includes('exif')),
    has_iptc: normalizedStrings.some((item) => item.includes('iptc')),
    has_c2pa_or_content_credentials: normalizedStrings.some(
      (item) => item.includes('c2pa') || item.includes('content credentials') || item.includes('jumb')
    ),
  };

  return {
    file_name: context.file.fileName,
    declared_mime_type: context.file.mimeType || 'unknown',
    detected_mime_type: context.sniffedMime || 'unknown',
    media_type: context.mediaType,
    file_size_bytes: context.file.buffer.length,
    entropy_bits_per_byte: calculateEntropy(context.file.buffer),
    extension: getExtension(context.file.fileName) || 'unknown',
    ...parseImageDimensions(context.file.buffer, context.sniffedMime || context.file.mimeType),
    ...containerMarkers,
    detected_ai_markers: matchingStrings(GENERATIVE_MARKERS),
    detected_editing_markers: matchingStrings(EDITING_MARKERS),
  };
}

function statusLabel(status: MediaAuthenticityStatus): string {
  switch (status) {
    case 'authentic':
    case 'likely_human':
      return 'Likely Authentic';
    case 'ai_generated':
      return 'Likely AI-Generated';
    case 'ai_assisted':
      return 'Likely AI-Assisted';
    case 'manipulated':
      return 'Likely Manipulated';
    case 'unsupported':
      return 'Unsupported';
    case 'unavailable':
      return 'Unavailable';
    default:
      return 'Inconclusive';
  }
}

function classifyStatus(aiProbability: number, manipulationProbability: number, authenticityScore: number, confidence: number): MediaAuthenticityStatus {
  if (confidence < 10) return 'inconclusive';
  // Strong manipulation signal overrides everything
  if (manipulationProbability >= 50 && manipulationProbability > aiProbability) return 'manipulated';
  // High-confidence AI detection — avoid the dead zone by using the gap, not just the threshold
  if (aiProbability >= 60) return 'ai_generated';
  if (aiProbability >= 40 && aiProbability > authenticityScore + 5) return 'ai_generated';
  // AI-assisted: moderate AI signal but authenticity isn't dominant
  if (aiProbability >= 30 && aiProbability >= authenticityScore * 0.75 && confidence >= 30) return 'ai_assisted';
  // Authentic: authenticity clearly dominates
  if (authenticityScore >= 55 && authenticityScore > aiProbability + 10) return 'authentic';
  if (authenticityScore > aiProbability && confidence >= 25) return 'authentic';
  // Insufficient signal
  return 'inconclusive';
}

export function createResult(
  detector: AuthenticityDetector,
  context: DetectorContext,
  scores: Pick<MediaAuthenticityModelResult, 'authenticity_score' | 'ai_generation_probability' | 'manipulation_probability' | 'confidence_score'>,
  summary: string,
  technicalDetails: string[],
  evidence: MediaAuthenticityEvidence[],
  modelName?: string
): MediaAuthenticityModelResult {
  return {
    detector_id: detector.id,
    detector_name: detector.name,
    model_name: modelName,
    modality: context.mediaType === 'other' ? 'generic' : context.mediaType,
    authenticity_score: clampPercent(scores.authenticity_score),
    ai_generation_probability: clampPercent(scores.ai_generation_probability),
    manipulation_probability: clampPercent(scores.manipulation_probability),
    confidence_score: clampPercent(scores.confidence_score),
    summary,
    technical_details: technicalDetails,
    evidence,
  };
}

const metadataDetector: AuthenticityDetector = {
  id: 'metadata-signature-forensics',
  name: 'Metadata Signature Forensics',
  modalities: ['image', 'audio', 'video', 'document', 'text', 'generic'],
  weight: 0.3,
  async analyze(context) {
    const aiMarkers = context.metadata.detected_ai_markers as string[];
    const editingMarkers = context.metadata.detected_editing_markers as string[];
    const mimeMismatch =
      Boolean(context.sniffedMime) &&
      Boolean(context.file.mimeType) &&
      context.file.mimeType !== 'application/octet-stream' &&
      context.sniffedMime !== context.file.mimeType;
    const hasC2pa = Boolean(context.metadata.has_c2pa_or_content_credentials);
    const hasCreationMetadata = Boolean(context.metadata.has_exif || context.metadata.has_xmp || context.metadata.has_iptc);

    const aiProbability = aiMarkers.length ? 80 : hasC2pa ? 34 : 16;
    const manipulationProbability = clampPercent((editingMarkers.length ? 48 : 12) + (mimeMismatch ? 22 : 0));
    const confidence = clampPercent(42 + aiMarkers.length * 12 + editingMarkers.length * 8 + (hasCreationMetadata ? 8 : 0));
    const evidence: MediaAuthenticityEvidence[] = [];

    if (aiMarkers.length) {
      evidence.push({
        kind: 'metadata',
        label: 'AI metadata marker',
        description: 'Embedded strings associated with generative tools were found in the file bytes.',
        value: aiMarkers.join(', '),
      });
    }

    if (editingMarkers.length) {
      evidence.push({
        kind: 'metadata',
        label: 'Editing software marker',
        description: 'The file contains software markers commonly written by editing tools.',
        value: editingMarkers.join(', '),
      });
    }

    if (mimeMismatch) {
      evidence.push({
        kind: 'metadata',
        label: 'Container mismatch',
        description: 'The declared MIME type differs from the file signature detected from magic bytes.',
        value: `${context.file.mimeType} vs ${context.sniffedMime}`,
      });
    }

    return createResult(
      this,
      context,
      {
        authenticity_score: hasCreationMetadata && !aiMarkers.length && !editingMarkers.length ? 72 : 100 - Math.max(aiProbability, manipulationProbability),
        ai_generation_probability: aiProbability,
        manipulation_probability: manipulationProbability,
        confidence_score: confidence,
      },
      aiMarkers.length || editingMarkers.length
        ? 'Metadata contains tool signatures that may indicate synthetic generation or post-processing.'
        : 'No explicit AI-generator or editor markers were found in the sampled metadata.',
      [
        `Detected MIME: ${context.sniffedMime || 'unknown'}`,
        `Declared MIME: ${context.file.mimeType || 'unknown'}`,
        `Entropy: ${context.metadata.entropy_bits_per_byte} bits/byte`,
        `C2PA/content credentials marker present: ${hasC2pa ? 'yes' : 'no'}`,
      ],
      evidence
    );
  },
};

const imageForensicsDetector: AuthenticityDetector = {
  id: 'image-container-artifact-detector',
  name: 'Image Container Artifact Detector',
  modalities: ['image'],
  weight: 0.25,
  async analyze(context) {
    if (context.mediaType !== 'image') return null;

    const entropy = Number(context.metadata.entropy_bits_per_byte || 0);
    const hasDimensions = typeof context.metadata.width === 'number' && typeof context.metadata.height === 'number';
    const hasMetadata = Boolean(context.metadata.has_exif || context.metadata.has_xmp || context.metadata.has_c2pa_or_content_credentials);
    const jpegMissingEnd = context.sniffedMime === 'image/jpeg' && !context.file.buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9]));
    const unusualEntropy = entropy > 7.92 || entropy < 3.2;

    const evidence: MediaAuthenticityEvidence[] = [];
    if (unusualEntropy) {
      evidence.push({
        kind: 'heatmap',
        label: 'Compression/noise anomaly',
        description: 'Byte-level entropy is outside the expected range for many camera or screenshot files.',
        value: `${entropy} bits/byte`,
      });
    }
    if (jpegMissingEnd) {
      evidence.push({
        kind: 'metadata',
        label: 'JPEG structure warning',
        description: 'The JPEG end marker was not found where expected.',
      });
    }

    return createResult(
      this,
      context,
      {
        authenticity_score: hasDimensions && !unusualEntropy && !jpegMissingEnd ? 70 : 46,
        ai_generation_probability: unusualEntropy && !hasMetadata ? 42 : 24,
        manipulation_probability: clampPercent((unusualEntropy ? 28 : 12) + (jpegMissingEnd ? 38 : 0)),
        confidence_score: hasDimensions ? 46 : 30,
      },
      unusualEntropy || jpegMissingEnd
        ? 'Image container signals show possible artifact anomalies that deserve review.'
        : 'Image container structure looks internally consistent at the byte-signature level.',
      [
        hasDimensions ? `Parsed dimensions: ${context.metadata.width}x${context.metadata.height}` : 'Image dimensions could not be parsed from the header.',
        `Entropy: ${entropy} bits/byte`,
        `Creation metadata present: ${hasMetadata ? 'yes' : 'no'}`,
      ],
      evidence
    );
  },
};

const textStylometryDetector: AuthenticityDetector = {
  id: 'text-stylometry-advanced-detector',
  name: 'Advanced Text Stylometry & Perplexity Detector',
  modalities: ['text', 'document'],
  weight: 0.6,
  async analyze(context) {
    if (!context.textSample) return null;

    const text = context.textSample;
    const sentences = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
    const words = text.toLowerCase().match(/[a-z0-9']+/g) || [];
    const uniqueWords = new Set(words);
    const sentenceLengths = sentences.map((sentence) => (sentence.match(/[a-z0-9']+/gi) || []).length).filter(Boolean);
    const avgSentenceLength = sentenceLengths.reduce((sum, value) => sum + value, 0) / Math.max(sentenceLengths.length, 1);
    const variance =
      sentenceLengths.reduce((sum, value) => sum + Math.pow(value - avgSentenceLength, 2), 0) / Math.max(sentenceLengths.length, 1);
    const burstiness = Math.sqrt(variance) / Math.max(avgSentenceLength, 1);
    const typeTokenRatio = uniqueWords.size / Math.max(words.length, 1);
    const punctuationDensity = (text.match(/[,:;()\[\]{}]/g) || []).length / Math.max(words.length, 1);

    // ── Expanded LLM Phrase Markers (30+ phrases) ──
    const llmPhrases = [
      'as an ai', 'as a language model', 'it is important to note', 'it\'s important to note',
      'it\'s worth noting', 'it is worth noting', 'delve', 'foster', 'underscore',
      'in conclusion', 'furthermore', 'moreover', 'in today\'s world',
      'navigating the complexities', 'it is crucial', 'one must consider',
      'i\'d be happy to', 'i\'m happy to help', 'let me explain',
      'in the realm of', 'plays a crucial role', 'a testament to',
      'it\'s essential to', 'shed light on', 'leverage', 'harness',
      'a myriad of', 'paramount', 'pivotal', 'multifaceted',
      'holistic approach', 'nuanced', 'tapestry', 'landscape',
      'in summary', 'to summarize', 'embark on', 'game-changer',
    ];
    const llmPhrasePattern = new RegExp(`\\b(${llmPhrases.join('|')})\\b`, 'gi');
    const repeatedPhraseHits = (text.match(llmPhrasePattern) || []).length;
    const matchedPhrases = Array.from(new Set((text.match(llmPhrasePattern) || []).map(p => p.toLowerCase())));

    // ── Bigram Perplexity Estimation ──
    // Low perplexity (highly predictable text) is an AI signal
    let bigramPerplexity = 0;
    if (words.length > 20) {
      const bigramCounts = new Map<string, number>();
      const unigramCounts = new Map<string, number>();
      for (let i = 0; i < words.length; i++) {
        unigramCounts.set(words[i], (unigramCounts.get(words[i]) || 0) + 1);
        if (i > 0) {
          const bigram = `${words[i - 1]} ${words[i]}`;
          bigramCounts.set(bigram, (bigramCounts.get(bigram) || 0) + 1);
        }
      }
      let logProb = 0;
      let count = 0;
      for (let i = 1; i < words.length; i++) {
        const bigram = `${words[i - 1]} ${words[i]}`;
        const bigramCount = bigramCounts.get(bigram) || 0;
        const unigramCount = unigramCounts.get(words[i - 1]) || 1;
        // Add-one smoothing
        const prob = (bigramCount + 1) / (unigramCount + uniqueWords.size);
        logProb += Math.log2(prob);
        count++;
      }
      bigramPerplexity = count > 0 ? Math.pow(2, -logProb / count) : 0;
    }
    const lowPerplexity = bigramPerplexity > 0 && bigramPerplexity < 8 && words.length > 50;

    // ── Paragraph Structure Analysis ──
    // AI classic: intro paragraph → bullet list → conclusion paragraph
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const hasBulletList = /(?:^|\n)\s*[-•*]\s/m.test(text) || /(?:^|\n)\s*\d+[.)]\s/m.test(text);
    const hasIntroConclusion = paragraphs.length >= 3 &&
      !(/[-•*]\s/.test(paragraphs[0])) &&
      !(/[-•*]\s/.test(paragraphs[paragraphs.length - 1]));
    const aiStructurePattern = hasBulletList && hasIntroConclusion && paragraphs.length >= 3;

    // ── Hedging Language Density ──
    const hedgingWords = ['might', 'could', 'potentially', 'possibly', 'perhaps', 'may', 'arguably',
      'it is possible', 'it seems', 'it appears', 'tends to', 'generally', 'typically', 'often',
      'in some cases', 'on the other hand', 'however', 'nevertheless', 'that being said'];
    const hedgingPattern = new RegExp(`\\b(${hedgingWords.join('|')})\\b`, 'gi');
    const hedgingCount = (text.match(hedgingPattern) || []).length;
    const hedgingDensity = hedgingCount / Math.max(words.length, 1);
    const excessiveHedging = hedgingDensity > 0.025 && words.length > 60;

    // ── Score calculation ──
    const lowBurstiness = burstiness < 0.34 && sentenceLengths.length >= 4;
    const uniformLexicon = typeTokenRatio > 0.42 && typeTokenRatio < 0.72 && words.length > 80;

    const aiProbability = clampPercent(
      15 +
      (lowBurstiness ? 20 : 0) +
      (uniformLexicon ? 14 : 0) +
      (punctuationDensity > 0.14 ? 8 : 0) +
      Math.min(repeatedPhraseHits * 8, 32) +
      (lowPerplexity ? 16 : 0) +
      (aiStructurePattern ? 12 : 0) +
      (excessiveHedging ? 10 : 0)
    );

    // ── Evidence building with supports/strength ──
    const evidence: MediaAuthenticityEvidence[] = [];

    if (lowBurstiness) {
      evidence.push({
        kind: 'text_region',
        label: 'Uniform Sentence Rhythm',
        description: 'Sentence lengths are unusually uniform, a strong stylometric signal of generated prose. Human writing varies wildly.',
        value: `Burstiness: ${burstiness.toFixed(2)} (threshold: <0.34)`,
        evidence_supports: 'AI',
        evidence_strength: burstiness < 0.2 ? 'Strong' : 'Moderate',
      });
    }

    if (repeatedPhraseHits > 0) {
      evidence.push({
        kind: 'text_region',
        label: 'LLM Signature Phrases',
        description: `Text contains ${repeatedPhraseHits} phrases strongly associated with AI language models: "${matchedPhrases.slice(0, 5).join('", "')}"`,
        value: `${repeatedPhraseHits} marker${repeatedPhraseHits === 1 ? '' : 's'}`,
        evidence_supports: 'AI',
        evidence_strength: repeatedPhraseHits >= 3 ? 'Strong' : repeatedPhraseHits >= 2 ? 'Moderate' : 'Weak',
      });
    }

    if (lowPerplexity) {
      evidence.push({
        kind: 'text_region',
        label: 'Low Perplexity',
        description: 'Text is unusually predictable at the bigram level. AI-generated text tends to follow highly predictable patterns.',
        value: `Perplexity: ${bigramPerplexity.toFixed(1)} (threshold: <8)`,
        evidence_supports: 'AI',
        evidence_strength: bigramPerplexity < 5 ? 'Strong' : 'Moderate',
      });
    }

    if (aiStructurePattern) {
      evidence.push({
        kind: 'text_region',
        label: 'AI Structure Pattern',
        description: 'Text follows the classic AI template: introductory paragraph → bullet/numbered list → concluding paragraph.',
        value: `${paragraphs.length} paragraphs with list structure`,
        evidence_supports: 'AI',
        evidence_strength: 'Moderate',
      });
    }

    if (excessiveHedging) {
      evidence.push({
        kind: 'text_region',
        label: 'Excessive Hedging Language',
        description: 'Text uses an unusually high density of hedging words (might, could, potentially), which is a common AI writing characteristic.',
        value: `${hedgingCount} hedging terms (${(hedgingDensity * 100).toFixed(1)}% density)`,
        evidence_supports: 'AI',
        evidence_strength: hedgingDensity > 0.04 ? 'Strong' : 'Moderate',
      });
    }

    // Positive human signals
    const hasTypos = /[a-z]{2,}[A-Z][a-z]|[a-z]\s{2,}[a-z]|[.!?]{2,}|lol|haha|omg|idk|tbh|imo|ngl/i.test(text);
    const hasContractions = /\b(can't|won't|don't|isn't|aren't|wasn't|weren't|I'm|you're|they're|we're|it's|that's|let's|he's|she's)\b/g.test(text);
    const hasInformalLanguage = /\b(gonna|wanna|gotta|kinda|sorta|y'all|ain't|yeah|nah|ok|okay|hmm|umm|ugh|btw)\b/gi.test(text);

    if (hasTypos || hasInformalLanguage) {
      evidence.push({
        kind: 'text_region',
        label: 'Informal Human Markers',
        description: 'Text contains informal language, slang, or casual patterns rarely produced by AI models.',
        evidence_supports: 'Authentic',
        evidence_strength: 'Moderate',
      });
    }

    if (burstiness > 0.6 && sentenceLengths.length >= 4) {
      evidence.push({
        kind: 'text_region',
        label: 'High Sentence Variability',
        description: 'Sentence lengths vary significantly, which is characteristic of natural human writing.',
        value: `Burstiness: ${burstiness.toFixed(2)}`,
        evidence_supports: 'Authentic',
        evidence_strength: burstiness > 0.8 ? 'Strong' : 'Moderate',
      });
    }

    return createResult(
      this,
      context,
      {
        authenticity_score: clampPercent(100 - aiProbability),
        ai_generation_probability: aiProbability,
        manipulation_probability: 8,
        confidence_score: clampPercent(28 + Math.min(words.length / 6, 38) + evidence.length * 6),
      },
      aiProbability >= 50
        ? 'Text stylometry shows generated-writing signals including uniform rhythm, AI phrase markers, and/or low perplexity.'
        : aiProbability >= 30
          ? 'Text shows some AI-like patterns but also human characteristics. Mixed signals.'
          : 'Text stylometry does not show strong generated-writing signals.',
      [
        `Words sampled: ${words.length}`,
        `Sentence count: ${sentences.length}`,
        `Burstiness: ${burstiness.toFixed(3)} ${lowBurstiness ? '⚠ LOW' : '✓'}`,
        `Type-token ratio: ${typeTokenRatio.toFixed(3)}`,
        `Bigram perplexity: ${bigramPerplexity.toFixed(1)} ${lowPerplexity ? '⚠ LOW' : '✓'}`,
        `Hedging density: ${(hedgingDensity * 100).toFixed(1)}% ${excessiveHedging ? '⚠ HIGH' : '✓'}`,
        `LLM phrase markers: ${repeatedPhraseHits}`,
        `AI structure pattern: ${aiStructurePattern ? '⚠ DETECTED' : '✓ not detected'}`,
        `Contractions: ${hasContractions ? 'yes' : 'no'}`,
        `Informal markers: ${hasTypos || hasInformalLanguage ? 'yes' : 'no'}`,
      ],
      evidence
    );
  },
};

const audioVideoSignalDetector: AuthenticityDetector = {
  id: 'audio-video-container-consistency',
  name: 'Audio/Video Container Consistency Detector',
  modalities: ['audio', 'video'],
  weight: 0.2,
  async analyze(context) {
    if (context.mediaType !== 'audio' && context.mediaType !== 'video') return null;

    const entropy = Number(context.metadata.entropy_bits_per_byte || 0);
    const strings = context.byteStrings.join(' ').toLowerCase();
    const hasEditingMarker = EDITING_MARKERS.some((marker) => strings.includes(marker));
    const hasGenerativeMarker = GENERATIVE_MARKERS.some((marker) => strings.includes(marker));
    const aiProbability = clampPercent((hasGenerativeMarker ? 70 : 18) + (entropy > 7.95 ? 8 : 0));
    const manipulationProbability = clampPercent((hasEditingMarker ? 46 : 16) + (entropy < 2.5 ? 18 : 0));

    const evidence: MediaAuthenticityEvidence[] = [
      {
        kind: context.mediaType === 'audio' ? 'spectrogram' : 'timestamp',
        label: context.mediaType === 'audio' ? 'Spectrogram review required' : 'Frame consistency review required',
        description:
          context.mediaType === 'audio'
            ? 'A waveform/spectrogram model can attach segment-level evidence when configured as an external detector.'
            : 'A frame-level model can attach timestamped suspicious regions when configured as an external detector.',
      },
    ];

    return createResult(
      this,
      context,
      {
        authenticity_score: 100 - Math.max(aiProbability, manipulationProbability),
        ai_generation_probability: aiProbability,
        manipulation_probability: manipulationProbability,
        confidence_score: hasEditingMarker || hasGenerativeMarker ? 52 : 30,
      },
      hasEditingMarker || hasGenerativeMarker
        ? 'Container strings include production or generative-tool markers.'
        : 'No explicit audio/video deepfake or editing marker was found in the sampled container strings.',
      [
        `Container entropy: ${entropy} bits/byte`,
        `Generative marker found: ${hasGenerativeMarker ? 'yes' : 'no'}`,
        `Editing marker found: ${hasEditingMarker ? 'yes' : 'no'}`,
      ],
      evidence
    );
  },
};



function parseEndpointDetectors(): AuthenticityDetector[] {
  const rawConfig = process.env.MEDIA_AUTHENTICITY_MODEL_ENDPOINTS;
  if (!rawConfig) return [];

  try {
    const configs = JSON.parse(rawConfig) as EndpointDetectorConfig[];
    if (!Array.isArray(configs)) return [];

    return configs
      .filter((config) => config.id && config.url)
      .map((config): AuthenticityDetector => ({
        id: config.id,
        name: config.name || config.id,
        modalities: config.modalities?.length ? config.modalities : ['image', 'audio', 'video', 'document', 'text'],
        weight: config.weight ?? 1.25,
        async analyze(context) {
          if (!this.modalities.includes(context.mediaType === 'other' ? 'generic' : context.mediaType)) return null;

          const apiKey = config.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined;
          const response = await fetch(config.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
              model: config.modelName,
              file_name: context.file.fileName,
              mime_type: context.file.mimeType,
              media_type: context.mediaType,
              content_base64: context.file.buffer.toString('base64'),
              text_sample: context.textSample || undefined,
              metadata: context.metadata,
            }),
          });

          if (!response.ok) {
            throw new Error(`${config.id} detector failed with status ${response.status}`);
          }

          const payload = (await response.json()) as Partial<MediaAuthenticityModelResult> & {
            ai_probability?: number;
            confidence?: number;
          };
          return createResult(
            this,
            context,
            {
              authenticity_score: Number(payload.authenticity_score ?? 0),
              ai_generation_probability: Number(payload.ai_generation_probability ?? payload.ai_probability ?? 0),
              manipulation_probability: Number(payload.manipulation_probability ?? 0),
              confidence_score: Number(payload.confidence_score ?? payload.confidence ?? 0),
            },
            payload.summary || `${this.name} completed analysis.`,
            Array.isArray(payload.technical_details) ? payload.technical_details : [],
            Array.isArray(payload.evidence) ? payload.evidence : [],
            payload.model_name || config.modelName
          );
        },
      }));
  } catch (error) {
    console.error('[MediaAuthenticity] Invalid MEDIA_AUTHENTICITY_MODEL_ENDPOINTS config:', error);
    return [];
  }
}

function getDetectors(): AuthenticityDetector[] {
  return [
    metadataDetector,
    imageForensicsDetector,
    textStylometryDetector,
    audioVideoSignalDetector,
    ...parseEndpointDetectors(),
  ];
}

async function runDetectorSafely(detector: AuthenticityDetector, context: DetectorContext) {
  try {
    if (!detector.modalities.includes(context.mediaType === 'other' ? 'generic' : context.mediaType)) return null;
    return await detector.analyze(context);
  } catch (error) {
    console.error(`[MediaAuthenticity] ${detector.id} failed:`, error);
    return createResult(
      detector,
      context,
      {
        authenticity_score: 0,
        ai_generation_probability: 0,
        manipulation_probability: 0,
        confidence_score: 0,
      },
      `${detector.name} was unavailable for this file.`,
      [error instanceof Error ? error.message : 'Unknown detector error'],
      []
    );
  }
}

/**
 * Calibrate ensemble scores to avoid the 40-60% dead zone.
 * When the gap between authenticity and AI probability is small,
 * amplify the winning side so the result is decisive.
 */
function calibrateEnsembleScores(
  authenticityScore: number,
  aiProbability: number,
  manipulationProbability: number,
  confidenceScore: number
): { authenticityScore: number; aiProbability: number; manipulationProbability: number; confidenceScore: number } {
  const gap = Math.abs(authenticityScore - aiProbability);

  // If scores are within 25 points of each other and confidence is decent,
  // amplify the winning side by pushing scores apart to avoid dead zones.
  // If it's a perfect tie, default to authentic since most uploads are authentic.
  if (gap < 25 && confidenceScore >= 20) {
    const boost = Math.round((25 - gap) * 0.7);
    if (authenticityScore >= aiProbability) {
      authenticityScore = clampPercent(authenticityScore + boost);
      aiProbability = clampPercent(aiProbability - boost);
    } else {
      aiProbability = clampPercent(aiProbability + boost);
      authenticityScore = clampPercent(authenticityScore - Math.round(boost * 0.5)); // reduce auth less aggressively
    }
  }

  // If the gap is very large, the result is highly decisive.
  // We should boost the confidence score to reflect this certainty,
  // preventing unsure heuristic detectors from dragging down the overall confidence.
  const finalGap = Math.abs(authenticityScore - aiProbability);
  if (finalGap >= 40) {
    confidenceScore = Math.max(confidenceScore, Math.min(finalGap + 10, 95));
  } else if (finalGap >= 25) {
    confidenceScore = Math.max(confidenceScore, 75);
  }

  return {
    authenticityScore: clampPercent(authenticityScore),
    aiProbability: clampPercent(aiProbability),
    manipulationProbability: clampPercent(manipulationProbability),
    confidenceScore: clampPercent(confidenceScore),
  };
}

function summarizeModelResults(results: MediaAuthenticityModelResult[], detectors: AuthenticityDetector[]) {
  const weighted = results
    .filter((result) => result.confidence_score > 0)
    .map((result) => ({
      result,
      detector: detectors.find((item) => item.id === result.detector_id),
    }))
    .map(({ result, detector }) => ({
      result,
      weight: (detector?.weight ?? 1) * Math.max(result.confidence_score, 12),
    }));

  let authenticityScore = weightedAverage(weighted.map(({ result, weight }) => ({ value: result.authenticity_score, weight })));
  let aiProbability = weightedAverage(weighted.map(({ result, weight }) => ({ value: result.ai_generation_probability, weight })));
  let manipulationProbability = weightedAverage(weighted.map(({ result, weight }) => ({ value: result.manipulation_probability, weight })));
  let confidenceScore = weightedAverage(weighted.map(({ result, weight }) => ({ value: result.confidence_score, weight })));

  // Calibrate to avoid dead-zone results
  ({ authenticityScore, aiProbability, manipulationProbability, confidenceScore } =
    calibrateEnsembleScores(authenticityScore, aiProbability, manipulationProbability, confidenceScore));

  return {
    authenticityScore,
    aiProbability,
    manipulationProbability,
    confidenceScore,
    status: classifyStatus(aiProbability, manipulationProbability, authenticityScore, confidenceScore),
  };
}

function buildHumanExplanation(status: MediaAuthenticityStatus, itemCount: number, aiProbability: number, manipulationProbability: number): string {
  const fileText = itemCount === 1 ? 'file' : 'files';
  switch (status) {
    case 'authentic':
    case 'likely_human':
      return `The analyzed ${fileText} does not show strong AI-generation or manipulation signals in the available checks.`;
    case 'ai_generated':
      return `The analyzed ${fileText} contains strong signals consistent with AI-generated media.`;
    case 'ai_assisted':
      return `The analyzed ${fileText} contains mixed signals, suggesting AI assistance or partial synthetic content may be present.`;
    case 'manipulated':
      return `The analyzed ${fileText} contains stronger manipulation signals than AI-generation signals.`;
    case 'unsupported':
      return 'No uploaded file type could be evaluated by the available authenticity detectors.';
    default:
      return `The result is inconclusive. Current aggregate AI probability is ${aiProbability}% and manipulation probability is ${manipulationProbability}%.`;
  }
}

export async function analyzeMediaAuthenticity(
  files: MediaAuthenticityInput[],
  externalDetectors: AuthenticityDetector[] = []
): Promise<MediaAuthenticityResult> {
  const detectors = [...getDetectors(), ...externalDetectors];
  const items: MediaAuthenticityItem[] = [];

  for (const file of files) {
    const sniffedMime = sniffMime(file.buffer);
    const mediaType = detectMediaType(file.mimeType || sniffedMime, file.fileName);
    const byteStrings = extractByteStrings(file.buffer);
    const contextBase = {
      file,
      mediaType,
      sniffedMime,
      textSample: decodeTextSample(file.buffer, file.mimeType || sniffedMime, file.fileName),
      byteStrings,
    };
    const context: DetectorContext = {
      ...contextBase,
      metadata: buildMetadata(contextBase),
    };

    if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
      items.push({
        file_name: file.fileName,
        media_type: mediaType,
        provider: 'ShieldHer Open Detector Ensemble',
        status: 'unsupported',
        label: statusLabel('unsupported'),
        summary: 'This file type is stored, but no authenticity detector is currently registered for it.',
        confidence_score: 0,
        ai_generation_probability: 0,
        manipulation_probability: 0,
        authenticity_score: 0,
        ai_probability: 0,
        confidence: 0,
        metadata: context.metadata,
        evidence: [],
        model_results: [],
      });
      continue;
    }

    const modelResults = (await Promise.all(detectors.map((detector) => runDetectorSafely(detector, context))))
      .filter((result): result is MediaAuthenticityModelResult => Boolean(result));

    const aggregate = summarizeModelResults(modelResults, detectors);
    const technicalExplanation = modelResults
      .flatMap((result) => result.technical_details.map((detail) => `${result.detector_name}: ${detail}`))
      .slice(0, 12)
      .join('\n');

    items.push({
      file_name: file.fileName,
      media_type: mediaType,
      provider: 'ShieldHer Open Detector Ensemble',
      status: aggregate.status,
      label: statusLabel(aggregate.status),
      summary: buildHumanExplanation(aggregate.status, 1, aggregate.aiProbability, aggregate.manipulationProbability),
      authenticity_score: aggregate.authenticityScore,
      ai_generation_probability: aggregate.aiProbability,
      manipulation_probability: aggregate.manipulationProbability,
      confidence_score: aggregate.confidenceScore,
      ai_probability: aggregate.aiProbability,
      confidence: aggregate.confidenceScore,
      human_explanation: buildHumanExplanation(aggregate.status, 1, aggregate.aiProbability, aggregate.manipulationProbability),
      technical_explanation: technicalExplanation,
      metadata: context.metadata,
      evidence: modelResults.flatMap((result) => result.evidence).slice(0, 12),
      model_results: modelResults,
      possible_models: Array.from(new Set(modelResults.flatMap(r => r.possible_models || []))),
      risk_level: modelResults.some(r => r.risk_level === 'High') ? 'High' : (modelResults.some(r => r.risk_level === 'Medium') ? 'Medium' : 'Low'),
      limitations: Array.from(new Set(modelResults.flatMap(r => r.limitations || []))),
      final_reasoning: modelResults.map(r => r.final_reasoning).filter(Boolean).join('\n\n'),
    });
  }

  const supportedItems = items.filter((item) => item.status !== 'unsupported');
  const resultWeights = supportedItems.map((item) => ({ value: item.confidence_score || 0, weight: 1 }));
  const confidenceScore = weightedAverage(resultWeights);
  const aiProbability = weightedAverage(supportedItems.map((item) => ({ value: item.ai_generation_probability || 0, weight: item.confidence_score || 1 })));
  const manipulationProbability = weightedAverage(
    supportedItems.map((item) => ({ value: item.manipulation_probability || 0, weight: item.confidence_score || 1 }))
  );
  const authenticityScore = weightedAverage(supportedItems.map((item) => ({ value: item.authenticity_score || 0, weight: item.confidence_score || 1 })));
  const status =
    supportedItems.length === 0
      ? 'unsupported'
      : classifyStatus(aiProbability, manipulationProbability, authenticityScore, confidenceScore);

  return {
    provider: 'ShieldHer Open Detector Ensemble',
    status,
    label: statusLabel(status),
    summary: buildHumanExplanation(status, supportedItems.length || items.length, aiProbability, manipulationProbability),
    human_explanation: buildHumanExplanation(status, supportedItems.length || items.length, aiProbability, manipulationProbability),
    technical_explanation:
      'Scores are an ensemble aggregate across metadata signatures, container forensics, stylometry, and any configured self-hosted open-source detector endpoints.',
    authenticity_score: authenticityScore,
    ai_generation_probability: aiProbability,
    manipulation_probability: manipulationProbability,
    confidence_score: confidenceScore,
    ai_probability: aiProbability,
    confidence: confidenceScore,
    analyzed_count: files.length,
    supported_count: supportedItems.length,
    detectors_used: Array.from(new Set(supportedItems.flatMap((item) => item.model_results?.map((result) => result.detector_name) || []))),
    items,
    possible_models: Array.from(new Set(supportedItems.flatMap(i => i.possible_models || []))),
    risk_level: supportedItems.some(i => i.risk_level === 'High') ? 'High' : (supportedItems.some(i => i.risk_level === 'Medium') ? 'Medium' : 'Low'),
  };
}

export function getFriendlyAuthenticityMessage(status?: MediaAuthenticityStatus): string {
  switch (status) {
    case 'authentic':
    case 'likely_human':
      return 'This media does not strongly appear to be AI-generated or manipulated.';
    case 'ai_generated':
      return 'This media appears to be AI-generated.';
    case 'ai_assisted':
      return 'This media may include AI-assisted or partially synthetic content.';
    case 'manipulated':
      return 'This media shows signs of editing or manipulation.';
    case 'inconclusive':
      return 'We could not determine this confidently.';
    case 'unsupported':
      return 'This file type is not supported for authenticity detection yet.';
    default:
      return 'AI media authenticity detection is currently unavailable for this file.';
  }
}

export function getAuthenticityToneClass(status?: MediaAuthenticityStatus): 'danger' | 'safe' | 'neutral' {
  if (status === 'ai_generated' || status === 'manipulated') return 'danger';
  if (status === 'authentic' || status === 'likely_human') return 'safe';
  return 'neutral';
}
