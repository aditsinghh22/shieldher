import { NextRequest, NextResponse } from 'next/server';
import { translations } from '@/lib/translations';

type TranslationPack = (typeof translations)[keyof typeof translations];

const packCache = new Map<string, TranslationPack>();
const BATCH_SIZE = 42;
const GOOGLE_TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 220;
const REQUEST_TIMEOUT_MS = 9000;
const FAST_BATCH_CONCURRENCY = 4;
const SECOND_PASS_RETRY_CONCURRENCY = 3;

type StringLeaf = {
  id: string;
  text: string;
};

const LANGUAGE_CODE_MAP: Record<string, string> = {
  zh: 'zh-CN',
};

function normalizeLanguageCode(code: string) {
  return LANGUAGE_CODE_MAP[code] ?? code;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number
) {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runner());
  await Promise.all(workers);
  return results;
}

const CONVERSATIONAL_REPLACEMENTS: Record<string, Array<[RegExp, string]>> = {
  hi: [
    [/\bकृपया\b/g, 'प्लीज'],
    [/\bप्रारंभिक\b/g, 'शुरुआती'],
    [/\bविश्लेषण\b/g, 'जांच'],
    [/\bसिफारिशें\b/g, 'सुझाव'],
    [/\bसंभावित\b/g, 'हो सकने वाले'],
    [/\bउल्लंघन\b/g, 'समस्या'],
    [/\bविस्तृत\b/g, 'पूरी'],
    [/\bदर्ज\b/g, 'लिखें'],
    [/\bसंपर्क करें\b/g, 'बात करें'],
    [/\bसहायक सामग्री\b/g, 'सहायक जानकारी'],
  ],
  es: [
    [/\banálisis preliminar\b/gi, 'revisión inicial'],
    [/\brecomendaciones\b/gi, 'sugerencias'],
    [/\bpotenciales violaciones\b/gi, 'posibles problemas'],
  ],
  fr: [
    [/\banalyse préliminaire\b/gi, 'premier avis'],
    [/\brecommandations\b/gi, 'suggestions'],
    [/\bviolations potentielles\b/gi, 'problèmes possibles'],
  ],
};

function toConversationalTone(languageCode: string, text: string) {
  const replacements = CONVERSATIONAL_REPLACEMENTS[languageCode];
  let output = text.replace(/\s{2,}/g, ' ').trim();

  if (replacements) {
    replacements.forEach(([pattern, value]) => {
      output = output.replace(pattern, value);
    });
  }

  return output;
}

function collectStringLeaves(value: unknown, path: string[] = [], out: StringLeaf[] = []) {
  if (typeof value === 'string') {
    out.push({ id: path.join('.'), text: value });
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStringLeaves(item, [...path, String(index)], out));
    return out;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) =>
      collectStringLeaves(item, [...path, key], out)
    );
  }

  return out;
}

function setByPath(target: unknown, id: string, translated: string) {
  const parts = id.split('.');
  let cursor = target as Record<string, unknown> | unknown[];

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const index = Number(key);
    if (Array.isArray(cursor) && Number.isInteger(index)) {
      cursor = cursor[index] as Record<string, unknown> | unknown[];
    } else {
      cursor = (cursor as Record<string, unknown>)[key] as Record<string, unknown> | unknown[];
    }
  }

  const last = parts[parts.length - 1];
  const lastIndex = Number(last);
  if (Array.isArray(cursor) && Number.isInteger(lastIndex)) {
    cursor[lastIndex] = translated;
  } else {
    (cursor as Record<string, unknown>)[last] = translated;
  }
}

async function translateTextWithGoogle(languageCode: string, text: string) {
  const normalizedCode = normalizeLanguageCode(languageCode);
  const url = `${GOOGLE_TRANSLATE_ENDPOINT}?client=gtx&sl=en&tl=${encodeURIComponent(
    normalizedCode
  )}&dt=t&q=${encodeURIComponent(text)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error(`Google Translate request failed (${res.status})`);
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Google Translate response malformed');
  }

  const segments = data[0] as unknown[];
  const translated = segments
    .map((segment) => (Array.isArray(segment) ? segment[0] : ''))
    .filter((value): value is string => typeof value === 'string')
    .join('')
    .trim();

  return toConversationalTone(languageCode, translated || text);
}

async function translateWithRetry(languageCode: string, text: string) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await translateTextWithGoogle(languageCode, text);
    } catch {
      if (attempt === MAX_RETRIES) break;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  return text;
}

function countTranslated(leaves: StringLeaf[], translatedMap: Map<string, string>) {
  let translated = 0;
  for (const leaf of leaves) {
    const value = translatedMap.get(leaf.id);
    if (value && value.trim() && value !== leaf.text) {
      translated += 1;
    }
  }
  return translated;
}

function applyToneToPack<T extends TranslationPack>(languageCode: string, pack: T): T {
  const leaves = collectStringLeaves(pack);
  const clone = structuredClone(pack);
  leaves.forEach((leaf) => {
    setByPath(clone, leaf.id, toConversationalTone(languageCode, leaf.text));
  });
  return clone as T;
}

async function translateBatchFast(languageCode: string, batch: StringLeaf[]) {
  return Promise.all(
    batch.map(async (item) => {
      try {
        const text = await translateWithRetry(languageCode, item.text);
        return { id: item.id, text };
      } catch {
        return { id: item.id, text: item.text };
      }
    })
  );
}

function buildUniqueLeaves(leaves: StringLeaf[]) {
  const uniqueTexts = Array.from(new Set(leaves.map((leaf) => leaf.text)));
  const uniqueLeaves: StringLeaf[] = uniqueTexts.map((text, index) => ({
    id: String(index),
    text,
  }));
  return { uniqueTexts, uniqueLeaves };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { languageCode?: string };
    const languageCode = (body.languageCode || '').trim().toLowerCase();

    if (!languageCode) {
      return NextResponse.json({ error: 'languageCode is required' }, { status: 400 });
    }

    if (languageCode === 'en') {
      return NextResponse.json({ pack: translations.en });
    }
    if (languageCode === 'hi') {
      return NextResponse.json({ pack: applyToneToPack('hi', translations.hi) });
    }

    const cached = packCache.get(languageCode);
    if (cached) {
      return NextResponse.json({ pack: cached });
    }

    const basePack = translations.en;
    const leaves = collectStringLeaves(basePack);
    const translatedMap = new Map<string, string>();
    const { uniqueTexts, uniqueLeaves } = buildUniqueLeaves(leaves);
    const translatedBySourceText = new Map<string, string>();

    const uniqueBatches = chunkArray(uniqueLeaves, BATCH_SIZE);
    const fastBatchResults = await runWithConcurrency(
      uniqueBatches,
      (batch) => translateBatchFast(languageCode, batch),
      FAST_BATCH_CONCURRENCY
    );

    fastBatchResults.flat().forEach((item) => {
      const sourceText = uniqueTexts[Number(item.id)];
      if (sourceText && typeof item.text === 'string') {
        translatedBySourceText.set(sourceText, item.text);
      }
    });

    leaves.forEach((leaf) => {
      translatedMap.set(leaf.id, translatedBySourceText.get(leaf.text) ?? leaf.text);
    });

    const translatedCount = countTranslated(leaves, translatedMap);
    const translationRatio = translatedCount / Math.max(leaves.length, 1);

    // If many entries remain in English (rate-limit/network), retry only unchanged unique texts.
    if (translationRatio < 0.7) {
      const unchangedUniqueTexts = uniqueTexts.filter((sourceText) => {
        const translated = translatedBySourceText.get(sourceText);
        return !translated || translated === sourceText;
      });

      await runWithConcurrency(
        unchangedUniqueTexts,
        async (sourceText) => {
          const translated = await translateWithRetry(languageCode, sourceText);
          translatedBySourceText.set(sourceText, translated);
        },
        SECOND_PASS_RETRY_CONCURRENCY
      );

      leaves.forEach((leaf) => {
        translatedMap.set(leaf.id, translatedBySourceText.get(leaf.text) ?? leaf.text);
      });
    }

    const pack = structuredClone(basePack);
    leaves.forEach((leaf) => {
      const translated = translatedMap.get(leaf.id);
      if (translated && translated.trim()) {
        setByPath(pack, leaf.id, translated);
      }
    });

    packCache.set(languageCode, pack);
    return NextResponse.json({ pack });
  } catch {
    return NextResponse.json({ error: 'Failed to translate UI pack' }, { status: 500 });
  }
}
