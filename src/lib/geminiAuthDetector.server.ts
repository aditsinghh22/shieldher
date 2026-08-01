/**
 * Gemini Multi-Pass Forensic Detector — SERVER ONLY
 * 
 * This file contains server-only imports (fs, os, @google/generative-ai/server)
 * and must NEVER be imported from client components.
 * 
 * It is imported only from the API route (analyze/route.ts).
 * 
 * Architecture:
 * - Pass 1: Primary forensic analysis with 19/16/13 dimension checks
 * - Pass 2: Adversarial verification that challenges Pass 1 findings
 * - Reconciliation: Cross-validates both passes into a final verdict
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  type MediaAuthenticityEvidence,
  type MediaAuthenticityEvidenceKind,
} from '@/lib/types';
import {
  type AuthenticityDetector,
  type DetectorContext,
  createResult,
  clampPercent,
} from '@/lib/mediaAuthenticity';

// ═══════════════════════════════════════
// PASS 1 PROMPTS — Primary Forensic Analysis
// ═══════════════════════════════════════

const IMAGE_FORENSIC_PROMPT = `You are an expert AI media forensic analyst specializing in detecting AI-generated, AI-edited, and authentic media.

Your task is to determine whether this image is:
1. AI Generated
2. AI Edited / Partially AI Generated
3. Authentic (Human Created)
4. Inconclusive

IMPORTANT RULES:
- Never guess.
- Do not assume media is AI simply because it looks high quality.
- If there is insufficient evidence, return "Inconclusive."
- Base every conclusion only on observable forensic evidence.
- Consider multiple possible explanations before making a decision.

Analyze ALL 19 forensic dimensions systematically:

1. FACIAL SYMMETRY: Is the face unnaturally perfect or asymmetric in ways that suggest generation?
2. EYE REFLECTIONS: Do both eyes show consistent, realistic reflections? Mismatched reflections are a strong AI signal.
3. TEETH CONSISTENCY: Are teeth individually defined or a fused white block? Do they have natural imperfections?
4. FINGER COUNT & HAND STRUCTURE: Count every finger. Extra, fused, missing, or impossibly bent digits?
5. HAIR BOUNDARIES: Is hair sharply defined or does it blur/merge into background? Does it have natural flyaways?
6. SKIN TEXTURE: Is skin unnaturally smooth/waxy or does it show pores, blemishes, wrinkles?
7. LIGHTING CONSISTENCY: Do shadows and highlights come from a consistent light source across the entire scene?
8. SHADOWS: Are shadows physically plausible? Do they match object positions and light direction?
9. OBJECT GEOMETRY: Are objects geometrically correct? Warped edges, impossible angles?
10. PERSPECTIVE: Is the vanishing point consistent? Do parallel lines converge correctly?
11. BACKGROUND COHERENCE: Is the background internally consistent? Repeating patterns, impossible architecture?
12. TEXT RENDERING: Is any text in the image crisp and correctly spelled, or garbled/inconsistent?
13. WATERMARKS: Are there visible AI tool watermarks or metadata watermarks (SynthID, C2PA)?
14. COMPRESSION ARTIFACTS: Do compression artifacts match expected patterns for the format?
15. AI HALLUCINATIONS: Any objects that are semantically wrong (e.g., 6-legged animals, floating objects)?
16. REPEATED PATTERNS: Tiling, mirroring, or repeating textures that suggest generative models?
17. IMPOSSIBLE OBJECTS: Objects that couldn't exist in reality (Escher-like geometry, merged items)?
18. EDGE BLENDING: Soft/blurred boundaries where subjects meet background (GAN blending artifact)?
19. INPAINTING TRACES: Regions where texture/color doesn't match surroundings (selective editing)?

ALSO CHECK FOR SCREENSHOTS:
- SEMANTIC TEXT (CRITICAL FOR CHAT SCREENSHOTS): Read the dialogue. Does it sound like ChatGPT/AI wrote it? Overly polite, perfect grammar, robotic phrasing, "delve", "furthermore"?
- FAKE CHAT UI (CRITICAL): Check for impossible UI combinations (iOS status bar + Android app UI = fake generator).

SCORING RULES:
- confidence 95-100: Extremely strong forensic evidence (3+ strong findings all pointing same direction)
- confidence 80-94: Strong evidence with minor uncertainty (2+ strong findings)
- confidence 60-79: Moderate evidence (1 strong or 2+ moderate findings)
- confidence 40-59: Insufficient evidence (only weak findings) → verdict MUST be "inconclusive"
- confidence below 40: Return "inconclusive" with explanation

CRITICAL: Most real-world photos ARE authentic. Do NOT over-flag. If you see no clear artifacts, verdict MUST be "authentic."

Respond with ONLY this JSON (no markdown, no text outside):
{
  "classification": "AI Generated" | "AI Edited" | "Authentic" | "Inconclusive",
  "confidence": <number 0-100>,
  "risk_level": "Low" | "Medium" | "High",
  "summary": "<1-2 sentence plain language finding>",
  "evidence": [
    {
      "finding": "<specific observable artifact or lack thereof>",
      "supports": "AI" | "Authentic" | "Neutral",
      "strength": "Weak" | "Moderate" | "Strong"
    }
  ],
  "possible_models": ["<suspected AI model if AI detected, e.g. Midjourney, DALL-E 3, Stable Diffusion, Flux, GPT-4o, or Unknown>"],
  "limitations": ["<why certainty may be limited>"],
  "final_reasoning": "<detailed forensic explanation of your conclusion>"
}`;

const VIDEO_FORENSIC_PROMPT = `You are an expert AI media forensic analyst specializing in detecting deepfakes, AI-generated videos, and manipulated video content.

Your task is to determine whether this video is:
1. AI Generated (fully synthetic, AI avatar, Sora/Runway/Kling output)
2. AI Edited / Deepfake (face swap, lip sync manipulation, partial generation)
3. Authentic (real recording)
4. Inconclusive

IMPORTANT RULES:
- Never guess.
- Do not assume video is AI simply because it looks polished.
- If there is insufficient evidence, return "Inconclusive."
- Base every conclusion only on observable forensic evidence.
- Consider multiple possible explanations before making a decision.

Analyze ALL 16 forensic dimensions systematically:

1. LIP SYNC CONSISTENCY: Do lip movements precisely match spoken words throughout? Any desync?
2. FACE SWAPPING ARTIFACTS: Blending at face-neck junction, skin tone mismatch, resolution differences between face and body?
3. IDENTITY CONSISTENCY: Does the person's identity stay consistent frame-to-frame? Facial features shifting?
4. EYE BLINKING: Natural blink rate is 15-20/min. No blinking or unnaturally regular blinking = deepfake signal.
5. HEAD MOVEMENT: Natural or robotic? Do shoulders move naturally with head? (HeyGen/Synthesia avatars have rigid shoulders)
6. FACIAL WARPING: Any frames where the face distorts, jitters, or morphs unnaturally?
7. TEMPORAL CONSISTENCY: Frame-to-frame coherence. Flickering details, popping artifacts?
8. MOTION BLUR: Is motion blur natural or absent/synthetic? AI videos often lack proper motion blur.
9. PHYSICS REALISM: Do objects, clothing, hair obey physics? Gravity, momentum, cloth simulation?
10. LIGHTING CONTINUITY: Does lighting stay consistent across frames? Flickering ambient light?
11. REFLECTION CONSISTENCY: Do reflections in eyes, glasses, mirrors stay temporally consistent?
12. FRAME INTERPOLATION ARTIFACTS: Ghosting, morphing between keyframes, temporal smearing?
13. OBJECT PERMANENCE: Do objects persist correctly? Appearing/disappearing items?
14. CAMERA MOVEMENT REALISM: Is camera movement physically plausible or impossibly smooth?
15. SCENE TRANSITIONS: Are transitions natural or hiding splicing/generation boundaries?
16. AUDIO-VIDEO SYNC: Listen carefully! Is the voice an AI TTS clone? Robotic cadence, no breathing, flat prosody?

CRITICAL: Video deepfakes, AI avatars (HeyGen, Synthesia, D-ID), and synthetic voice clones are HIGHLY prevalent. Be extremely vigilant! If you observe ANY strong artifact (robotic posture, unnaturally perfect TTS voice, fused teeth), flag immediately.

SCORING RULES:
- confidence 95-100: Extremely strong forensic evidence
- confidence 80-94: Strong evidence with minor uncertainty
- confidence 60-79: Moderate evidence
- confidence 40-59: Insufficient evidence → verdict MUST be "Inconclusive"
- confidence below 40: Return "Inconclusive"

Respond with ONLY this JSON:
{
  "classification": "AI Generated" | "AI Edited" | "Authentic" | "Inconclusive",
  "confidence": <number 0-100>,
  "risk_level": "Low" | "Medium" | "High",
  "summary": "<1-2 sentence finding>",
  "evidence": [
    {
      "finding": "<specific observable artifact>",
      "supports": "AI" | "Authentic" | "Neutral",
      "strength": "Weak" | "Moderate" | "Strong"
    }
  ],
  "possible_models": ["<suspected model: HeyGen, Synthesia, D-ID, Runway, Sora, Kling, Pika, ElevenLabs, Unknown>"],
  "limitations": ["<why certainty may be limited>"],
  "final_reasoning": "<detailed forensic explanation>"
}`;

const AUDIO_FORENSIC_PROMPT = `You are an expert AI audio forensic analyst specializing in detecting AI-generated speech, voice cloning, and manipulated audio.

Your task is to determine whether this audio is:
1. AI Generated (TTS, voice cloning, AI music)
2. AI Edited / Spliced (partial AI manipulation of real audio)
3. Authentic (real human recording)
4. Inconclusive

IMPORTANT RULES:
- Never guess.
- Do not assume audio is AI simply because it sounds clear.
- If there is insufficient evidence, return "Inconclusive."
- Base every conclusion only on observable forensic evidence.

Analyze ALL 13 forensic dimensions systematically:

1. PROSODY: Does the speech have natural prosodic patterns (stress, intonation, rhythm)? AI often sounds monotonous or unnaturally patterned.
2. PITCH VARIATION: Natural speech has irregular pitch variations. AI tends toward smooth, predictable pitch curves.
3. BREATHING: Natural speech has breath intakes, lip smacks, micro-pauses. AI TTS often lacks these entirely.
4. NATURAL PAUSES: Hesitations, "um", "uh", false starts, self-corrections. AI rarely produces these.
5. BACKGROUND NOISE: Is ambient noise consistent and naturalistic? Sudden changes suggest splicing.
6. ROOM ACOUSTICS: Do reverb and echo match a real physical space? AI audio often has flat/anechoic quality.
7. EMOTION CONSISTENCY: Does emotional tone shift naturally? AI struggles with authentic emotional transitions.
8. SPECTROGRAM ANOMALIES: Any audible artifacts that suggest frequency-domain manipulation?
9. ROBOTIC ARTIFACTS: Metallic quality, buzzing, unnatural sibilance, clipped transients?
10. VOICE CLONING INDICATORS: Unnaturally consistent voice quality, no fatigue over long recordings, identical formant patterns?
11. PRONUNCIATION CONSISTENCY: Does pronunciation stay consistent? AI sometimes varies pronunciation of the same word.
12. CUT-AND-PASTE EDITS: Abrupt tonal changes, volume jumps, or click artifacts at edit points?
13. NOISE FLOOR CONSISTENCY: Does the background noise floor stay uniform? Changes indicate splicing.

SCORING RULES:
- confidence 95-100: Extremely strong forensic evidence
- confidence 80-94: Strong evidence with minor uncertainty
- confidence 60-79: Moderate evidence
- confidence 40-59: Insufficient evidence → verdict MUST be "Inconclusive"
- confidence below 40: Return "Inconclusive"

CRITICAL: Most voice recordings ARE authentic. Do NOT over-flag.

Respond with ONLY this JSON:
{
  "classification": "AI Generated" | "AI Edited" | "Authentic" | "Inconclusive",
  "confidence": <number 0-100>,
  "risk_level": "Low" | "Medium" | "High",
  "summary": "<1-2 sentence finding>",
  "evidence": [
    {
      "finding": "<specific observable artifact>",
      "supports": "AI" | "Authentic" | "Neutral",
      "strength": "Weak" | "Moderate" | "Strong"
    }
  ],
  "possible_models": ["<suspected model: ElevenLabs, Suno, XTTS, Bark, OpenAI TTS, Google WaveNet, Unknown>"],
  "limitations": ["<why certainty may be limited>"],
  "final_reasoning": "<detailed forensic explanation>"
}`;

const TEXT_FORENSIC_PROMPT = `You are an expert AI-text detection analyst. Determine if this text was written by a HUMAN or by an LLM (ChatGPT, Claude, Gemini, etc).

IMPORTANT RULES:
- Never guess. Base conclusions only on observable stylometric evidence.
- If there is insufficient evidence, return "Inconclusive."
- Short texts (<100 words) inherently limit confidence.

Analyze these signals systematically:

1. SENTENCE RHYTHM: AI sentences tend to be similar length. Humans vary wildly.
2. PERSONAL VOICE: Does it have genuine personality, colloquialisms, or is it generic and polished?
3. LLM SIGNATURE PHRASES: "It's important to note", "delve", "Furthermore", "In conclusion", "Let's explore", "I'd be happy to", "as a language model", "it's worth noting", "navigating the complexities", "in today's world", "it is crucial", "one must consider".
4. PARAGRAPH STRUCTURE: AI favors intro → bullet list → tidy conclusion. Humans are messier.
5. ERRORS & INFORMALITY: Humans make typos, use slang, abbreviations, incomplete sentences. AI is pristine.
6. SPECIFICITY: Humans include oddly specific personal details. AI stays carefully on-topic.
7. HEDGING DENSITY: Excessive "might", "could", "potentially", "it's possible" = AI signal.
8. EMOTIONAL AUTHENTICITY: Genuine emotion vs performed/templated responses.

TEXT TO ANALYZE:
---
{TEXT_CONTENT}
---

SCORING RULES:
- confidence 95-100: Extremely strong evidence (multiple strong signals converge)
- confidence 80-94: Strong evidence with minor uncertainty
- confidence 60-79: Moderate evidence
- confidence 40-59: Insufficient evidence → verdict MUST be "Inconclusive"
- confidence below 40: Return "Inconclusive"

Respond with ONLY this JSON:
{
  "classification": "AI Generated" | "AI Edited" | "Authentic" | "Inconclusive",
  "confidence": <number 0-100>,
  "risk_level": "Low" | "Medium" | "High",
  "summary": "<1-2 sentence finding>",
  "evidence": [
    {
      "finding": "<specific observable pattern>",
      "supports": "AI" | "Authentic" | "Neutral",
      "strength": "Weak" | "Moderate" | "Strong"
    }
  ],
  "possible_models": ["<suspected model: ChatGPT, Claude, Gemini, Unknown>"],
  "limitations": ["<why certainty may be limited>"],
  "final_reasoning": "<detailed stylometric explanation>"
}`;

// ═══════════════════════════════════════
// PASS 2 PROMPTS — Adversarial Verification
// ═══════════════════════════════════════

function buildVerifierPrompt(mediaType: string, pass1Summary: string, pass1Verdict: string): string {
  return `You are an INDEPENDENT forensic verifier. A previous analysis of this ${mediaType} concluded:

PREVIOUS VERDICT: "${pass1Verdict}"
PREVIOUS SUMMARY: "${pass1Summary}"

Your job is to CHALLENGE this conclusion. Specifically:
1. Look for evidence the previous analysis might have MISSED.
2. Look for evidence that CONTRADICTS the previous conclusion.
3. Consider alternative explanations for the findings.
4. If the previous analysis said "AI Generated", look hard for signs it could be authentic.
5. If the previous analysis said "Authentic", look hard for subtle AI artifacts.

IMPORTANT RULES:
- Do NOT simply agree with the previous analysis. Actively challenge it.
- If after rigorous challenge you still agree, that strengthens the conclusion.
- If you find contradicting evidence, report it honestly.
- Never hallucinate evidence. Only report what you actually observe.
- If you cannot determine, return "Inconclusive."

Respond with ONLY this JSON:
{
  "classification": "AI Generated" | "AI Edited" | "Authentic" | "Inconclusive",
  "confidence": <number 0-100>,
  "risk_level": "Low" | "Medium" | "High",
  "summary": "<1-2 sentence finding from YOUR independent analysis>",
  "evidence": [
    {
      "finding": "<specific finding from YOUR independent review>",
      "supports": "AI" | "Authentic" | "Neutral",
      "strength": "Weak" | "Moderate" | "Strong"
    }
  ],
  "agrees_with_pass1": <true | false>,
  "disagreement_reason": "<if disagrees, explain why>",
  "possible_models": ["<if AI detected>"],
  "limitations": ["<why certainty may be limited>"],
  "final_reasoning": "<detailed independent analysis>"
}`;
}

// ═══════════════════════════════════════
// Model candidates & JSON parsing
// ═══════════════════════════════════════

const GEMINI_DETECTOR_MODEL_CANDIDATES = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash'];

function parseGeminiJsonSafe(rawText: string): Record<string, unknown> | null {
  const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(clean.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
}

// ═══════════════════════════════════════
// Classification → internal verdict mapping
// ═══════════════════════════════════════

function classificationToVerdict(classification: string): string {
  const lower = classification.toLowerCase().replace(/[^a-z_ ]/g, '');
  if (lower.includes('ai generated') || lower === 'ai_generated') return 'ai_generated';
  if (lower.includes('ai edited') || lower === 'ai_edited' || lower.includes('ai assisted') || lower === 'ai_assisted') return 'ai_assisted';
  if (lower.includes('authentic') || lower === 'authentic') return 'authentic';
  if (lower.includes('manipulated') || lower === 'manipulated') return 'manipulated';
  return 'inconclusive';
}

function classificationToRiskLevel(classification: string): 'Low' | 'Medium' | 'High' {
  const verdict = classificationToVerdict(classification);
  if (verdict === 'ai_generated' || verdict === 'manipulated') return 'High';
  if (verdict === 'ai_assisted') return 'Medium';
  return 'Low';
}

// ═══════════════════════════════════════
// Verdict-Score Consistency Enforcement
// ═══════════════════════════════════════

type GeminiScores = {
  authenticity_score: number;
  ai_generation_probability: number;
  manipulation_probability: number;
  confidence_score: number;
};

function deriveScoresFromClassification(classification: string, confidence: number): GeminiScores {
  const verdict = classificationToVerdict(classification);
  const conf = clampPercent(confidence);

  switch (verdict) {
    case 'ai_generated':
      return {
        authenticity_score: clampPercent(Math.max(5, 100 - conf - 10)),
        ai_generation_probability: clampPercent(Math.max(70, conf)),
        manipulation_probability: 15,
        confidence_score: conf,
      };
    case 'ai_assisted':
      return {
        authenticity_score: clampPercent(Math.max(35, 60 - (conf - 50) * 0.5)),
        ai_generation_probability: clampPercent(Math.min(65, Math.max(40, conf * 0.7))),
        manipulation_probability: 25,
        confidence_score: conf,
      };
    case 'manipulated':
      return {
        authenticity_score: clampPercent(Math.max(20, 50 - (conf - 50) * 0.4)),
        ai_generation_probability: 30,
        manipulation_probability: clampPercent(Math.max(65, conf)),
        confidence_score: conf,
      };
    case 'authentic':
      return {
        authenticity_score: clampPercent(Math.max(70, conf)),
        ai_generation_probability: clampPercent(Math.max(5, 100 - conf - 10)),
        manipulation_probability: 10,
        confidence_score: conf,
      };
    default: // inconclusive
      return {
        authenticity_score: 45,
        ai_generation_probability: 40,
        manipulation_probability: 20,
        confidence_score: Math.min(conf, 55),
      };
  }
}

// ═══════════════════════════════════════
// Dual-Pass Reconciliation
// ═══════════════════════════════════════

interface PassResult {
  classification: string;
  confidence: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  summary: string;
  evidence: Array<{ finding: string; supports: string; strength: string }>;
  possibleModels: string[];
  limitations: string[];
  finalReasoning: string;
  agreesWithPass1?: boolean;
}

function reconcilePasses(pass1: PassResult, pass2: PassResult | null): {
  scores: GeminiScores;
  verdict: string;
  classification: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  summary: string;
  evidence: Array<{ finding: string; supports: string; strength: string }>;
  possibleModels: string[];
  limitations: string[];
  finalReasoning: string;
  dualPassAgreement: boolean;
} {
  // If pass 2 failed, use pass 1 only with slightly reduced confidence
  if (!pass2) {
    const scores = deriveScoresFromClassification(pass1.classification, Math.max(pass1.confidence - 5, 30));
    return {
      scores,
      verdict: classificationToVerdict(pass1.classification),
      classification: pass1.classification,
      riskLevel: pass1.riskLevel,
      summary: pass1.summary,
      evidence: pass1.evidence,
      possibleModels: pass1.possibleModels,
      limitations: [...pass1.limitations, 'Adversarial verification pass was not completed.'],
      finalReasoning: pass1.finalReasoning,
      dualPassAgreement: false,
    };
  }

  const v1 = classificationToVerdict(pass1.classification);
  const v2 = classificationToVerdict(pass2.classification);
  const bothAgree = v1 === v2 || pass2.agreesWithPass1 === true;

  // Merge evidence from both passes, de-duplicate by finding text
  const allEvidence = [...pass1.evidence];
  const existingFindings = new Set(pass1.evidence.map(e => e.finding.toLowerCase().trim()));
  for (const ev of pass2.evidence) {
    if (!existingFindings.has(ev.finding.toLowerCase().trim())) {
      allEvidence.push(ev);
    }
  }

  // Merge possible models
  const allModels = Array.from(new Set([...pass1.possibleModels, ...pass2.possibleModels]));
  const allLimitations = Array.from(new Set([...pass1.limitations, ...pass2.limitations]));

  if (bothAgree) {
    // Both agree — BOOST confidence
    const boostedConfidence = clampPercent(Math.max(pass1.confidence, pass2.confidence) + 8);
    const scores = deriveScoresFromClassification(pass1.classification, boostedConfidence);
    return {
      scores,
      verdict: v1,
      classification: pass1.classification,
      riskLevel: pass1.riskLevel,
      summary: pass1.summary,
      evidence: allEvidence,
      possibleModels: allModels,
      limitations: allLimitations,
      finalReasoning: `[Dual-pass verified] Both independent analyses agree. ${pass1.finalReasoning}`,
      dualPassAgreement: true,
    };
  }

  // Passes DISAGREE — use higher-confidence pass but reduce overall confidence
  const stronger = pass1.confidence >= pass2.confidence ? pass1 : pass2;
  const weaker = pass1.confidence >= pass2.confidence ? pass2 : pass1;
  const reducedConfidence = clampPercent(stronger.confidence - 15);

  // If the gap is enormous, the weaker pass might just be wrong
  const gap = stronger.confidence - weaker.confidence;
  const finalConfidence = gap > 30 ? clampPercent(stronger.confidence - 8) : reducedConfidence;
  const finalClassification = gap > 30 ? stronger.classification : stronger.classification;

  const scores = deriveScoresFromClassification(finalClassification, finalConfidence);

  return {
    scores,
    verdict: classificationToVerdict(finalClassification),
    classification: finalClassification,
    riskLevel: classificationToRiskLevel(finalClassification),
    summary: `${stronger.summary} (Note: verification pass ${gap > 30 ? 'concurred with reduced certainty' : 'partially disagreed'})`,
    evidence: allEvidence,
    possibleModels: allModels,
    limitations: [
      ...allLimitations,
      `Analysis passes disagreed: Pass 1 said "${pass1.classification}" (${pass1.confidence}%), Pass 2 said "${pass2.classification}" (${pass2.confidence}%). ${gap > 30 ? 'Stronger pass prevailed.' : 'Confidence reduced due to disagreement.'}`,
    ],
    finalReasoning: `[Dual-pass disagreement] Pass 1: ${pass1.finalReasoning}\n\nPass 2 (adversarial): ${pass2.finalReasoning}`,
    dualPassAgreement: false,
  };
}

// ═══════════════════════════════════════
// Parse a single Gemini pass result
// ═══════════════════════════════════════

function parsePassResult(parsed: Record<string, unknown>): PassResult {
  const classification = typeof parsed.classification === 'string' ? parsed.classification : 'Inconclusive';
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 50;

  // Parse evidence array
  const rawEvidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];
  const evidence = rawEvidence
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map(e => ({
      finding: typeof e.finding === 'string' ? e.finding : '',
      supports: typeof e.supports === 'string' ? e.supports : 'Neutral',
      strength: typeof e.strength === 'string' ? e.strength : 'Weak',
    }))
    .filter(e => e.finding.length > 0);

  const possibleModels = Array.isArray(parsed.possible_models)
    ? (parsed.possible_models as string[]).filter(m => typeof m === 'string' && m.length > 0)
    : [];

  const limitations = Array.isArray(parsed.limitations)
    ? (parsed.limitations as string[]).filter(l => typeof l === 'string' && l.length > 0)
    : [];

  return {
    classification,
    confidence: clampPercent(confidence),
    riskLevel: typeof parsed.risk_level === 'string'
      ? (parsed.risk_level as 'Low' | 'Medium' | 'High')
      : classificationToRiskLevel(classification),
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis completed.',
    evidence,
    possibleModels,
    limitations,
    finalReasoning: typeof parsed.final_reasoning === 'string' ? parsed.final_reasoning : '',
    agreesWithPass1: typeof parsed.agrees_with_pass1 === 'boolean' ? parsed.agrees_with_pass1 : undefined,
  };
}

// ═══════════════════════════════════════
// Gemini API call helper with model fallback
// ═══════════════════════════════════════

type InlinePart = { inlineData: { data: string; mimeType: string } };
type FileDataPart = { fileData: { fileUri: string; mimeType: string } };

async function callGeminiWithRetry(
  genAI: GoogleGenerativeAI,
  prompt: string,
  mediaParts: Array<InlinePart | FileDataPart>,
): Promise<Record<string, unknown> | null> {
  for (const modelName of GEMINI_DETECTOR_MODEL_CANDIDATES) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const parts: Array<string | InlinePart | FileDataPart> = [prompt, ...mediaParts];
        const response = await model.generateContent(parts);
        const rawText = response.response.text();
        const parsed = parseGeminiJsonSafe(rawText);
        if (parsed) return parsed;
      } catch (e: unknown) {
        const errObj = e as { status?: number; message?: string };
        const statusCode = errObj.status || Number(errObj.message?.match(/\[(\d{3})\s/)?.[1]);
        if (statusCode === 403 || statusCode === 404) break;
        if (attempt < 2) await new Promise<void>((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════
// Main Detector
// ═══════════════════════════════════════

const geminiContentDetector: AuthenticityDetector = {
  id: 'gemini-multipass-forensic-detector',
  name: 'AI Forensic Analysis (Gemini Multi-Pass)',
  modalities: ['image', 'audio', 'video', 'document', 'text', 'generic'],
  weight: 1.5,
  async analyze(context) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const genAI = new GoogleGenerativeAI(apiKey);

    // Select prompt based on media type
    let prompt: string;
    switch (context.mediaType) {
      case 'image':
        prompt = IMAGE_FORENSIC_PROMPT;
        break;
      case 'audio':
        prompt = AUDIO_FORENSIC_PROMPT;
        break;
      case 'video':
        prompt = VIDEO_FORENSIC_PROMPT;
        break;
      case 'text':
      case 'document':
        if (!context.textSample || context.textSample.length < 50) return null;
        prompt = TEXT_FORENSIC_PROMPT.replace('{TEXT_CONTENT}', context.textSample.slice(0, 8000));
        break;
      default:
        return null;
    }

    // Build media parts
    let mediaParts: Array<InlinePart | FileDataPart> = [];
    let tempPath: string | null = null;

    try {
      if (context.mediaType === 'video') {
        // Videos must be uploaded via File Manager
        const tempDir = await mkdtemp(join(tmpdir(), 'shieldher-auth-'));
        const ext = context.file.mimeType.split('/')[1] || 'mp4';
        tempPath = join(tempDir, `content_analysis.${ext}`);

        await writeFile(tempPath, context.file.buffer);
        const fileManager = new GoogleAIFileManager(apiKey);
        const uploadResult = await fileManager.uploadFile(tempPath, { mimeType: context.file.mimeType });
        let geminiFile = uploadResult.file;

        let waitAttempts = 0;
        while (geminiFile.state === FileState.PROCESSING && waitAttempts < 24) {
          await new Promise<void>((resolve) => setTimeout(resolve, 2500));
          geminiFile = await fileManager.getFile(geminiFile.name);
          waitAttempts++;
        }
        if (geminiFile.state === FileState.FAILED) {
          throw new Error('Gemini failed to process video for authenticity analysis');
        }

        mediaParts = [{ fileData: { fileUri: geminiFile.uri, mimeType: geminiFile.mimeType } }];
      } else if (context.mediaType === 'image' || context.mediaType === 'audio') {
        const base64 = context.file.buffer.toString('base64');
        const mime = context.sniffedMime || context.file.mimeType;
        mediaParts = [{ inlineData: { data: base64, mimeType: mime } }];
      }
      // For text/document, no media parts — text is embedded in the prompt

      // ═══════════════════════════════════════
      // PASS 1 — Primary Forensic Analysis
      // ═══════════════════════════════════════
      const pass1Raw = await callGeminiWithRetry(genAI, prompt, mediaParts);
      if (!pass1Raw) {
        console.warn('[MediaAuthenticity] Gemini Pass 1: all model candidates failed');
        return null;
      }

      const pass1 = parsePassResult(pass1Raw);

      // ═══════════════════════════════════════
      // PASS 2 — Adversarial Verification
      // ═══════════════════════════════════════
      let pass2: PassResult | null = null;
      try {
        const verifierPrompt = buildVerifierPrompt(
          context.mediaType,
          pass1.summary,
          pass1.classification
        );
        const pass2Raw = await callGeminiWithRetry(genAI, verifierPrompt, mediaParts);
        if (pass2Raw) {
          pass2 = parsePassResult(pass2Raw);
        }
      } catch (e) {
        console.warn('[MediaAuthenticity] Gemini Pass 2 (verifier) failed:', e);
      }

      // ═══════════════════════════════════════
      // RECONCILE both passes
      // ═══════════════════════════════════════
      const reconciled = reconcilePasses(pass1, pass2);

      // Convert evidence to typed evidence objects
      const evidenceKindMap: Record<string, MediaAuthenticityEvidenceKind> = {
        audio: 'spectrogram',
        video: 'timestamp',
        text: 'text_region',
        document: 'text_region',
      };
      const evidenceKind = evidenceKindMap[context.mediaType] || 'heatmap';

      const evidence: MediaAuthenticityEvidence[] = reconciled.evidence.map((e, i) => ({
        kind: evidenceKind,
        label: `Finding #${i + 1}`,
        description: e.finding,
        evidence_supports: e.supports as 'AI' | 'Authentic' | 'Neutral',
        evidence_strength: e.strength as 'Weak' | 'Moderate' | 'Strong',
      }));

      const result = createResult(
        this,
        context,
        reconciled.scores,
        reconciled.summary,
        [
          `Classification: ${reconciled.classification}`,
          `Confidence: ${reconciled.scores.confidence_score}%`,
          `Risk Level: ${reconciled.riskLevel}`,
          `Dual-pass agreement: ${reconciled.dualPassAgreement ? 'Yes' : 'No'}`,
          ...(reconciled.possibleModels.length > 0 ? [`Suspected models: ${reconciled.possibleModels.join(', ')}`] : []),
        ],
        evidence,
        GEMINI_DETECTOR_MODEL_CANDIDATES[0]
      );

      // Attach the new extended fields
      result.possible_models = reconciled.possibleModels;
      result.risk_level = reconciled.riskLevel;
      result.limitations = reconciled.limitations;
      result.final_reasoning = reconciled.finalReasoning;

      return result;
    } finally {
      if (tempPath) {
        try { await unlink(tempPath); } catch { /* cleanup best-effort */ }
      }
    }
  },
};

export default geminiContentDetector;
