'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations, type SupportedLanguage } from '@/lib/translations';
import { LANGUAGE_OPTIONS, type LanguageOption } from '@/lib/languageOptions';

type LanguageContextValue = {
  language: string;
  setLanguage: (language: string) => void;
  t: (typeof translations)[SupportedLanguage];
  availableLanguages: LanguageOption[];
  isLanguageLoading: boolean;
};

const STORAGE_KEY = 'shieldher_language';
const PACK_CACHE_VERSION = 'v3';

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeWithBase<T>(base: T, candidate: unknown): T {
  if (typeof base === 'string') {
    return (typeof candidate === 'string' && candidate.trim() ? candidate : base) as T;
  }

  if (typeof base === 'number' || typeof base === 'boolean' || base == null) {
    return (typeof candidate === typeof base ? candidate : base) as T;
  }

  if (Array.isArray(base)) {
    if (!Array.isArray(candidate)) return base;
    return base.map((item, index) => mergeWithBase(item, candidate[index])) as T;
  }

  if (!isPlainObject(base)) return base;
  const source = isPlainObject(candidate) ? candidate : {};
  const output: Record<string, unknown> = {};
  Object.keys(base).forEach((key) => {
    output[key] = mergeWithBase((base as Record<string, unknown>)[key], source[key]);
  });
  return output as T;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<string>('en');
  const [hydrated, setHydrated] = useState(false);
  const [dynamicPacks, setDynamicPacks] = useState<Record<string, (typeof translations)['en']>>({});
  const [loadingLanguageCode, setLoadingLanguageCode] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const exists = LANGUAGE_OPTIONS.some((option) => option.code === stored);
    const nextLanguage = exists && stored ? stored : 'en';
    const hydrateFromStorage = () => {
      setLanguageState(nextLanguage);
      setHydrated(true);
    };
    const frameId = window.requestAnimationFrame(hydrateFromStorage);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!hydrated) return;
    if (language in translations) return;
    if (dynamicPacks[language]) return;

    const cacheKey = `shieldher_i18n_pack_${PACK_CACHE_VERSION}_${language}`;
    let cancelled = false;

    async function loadDynamicPack() {
      setLoadingLanguageCode(language);
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const merged = mergeWithBase(translations.en, parsed);
          if (!cancelled) {
            setDynamicPacks((prev) => ({ ...prev, [language]: merged }));
            setLoadingLanguageCode((prev) => (prev === language ? null : prev));
          }
          return;
        } catch {
          window.localStorage.removeItem(cacheKey);
        }
      }

      try {
        const res = await fetch('/api/translate-ui', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ languageCode: language }),
        });

        if (!res.ok) return;
        const data = (await res.json()) as { pack?: unknown };
        if (!data.pack) return;

        const merged = mergeWithBase(translations.en, data.pack);
        window.localStorage.setItem(cacheKey, JSON.stringify(merged));
        if (!cancelled) {
          setDynamicPacks((prev) => ({ ...prev, [language]: merged }));
          setLoadingLanguageCode((prev) => (prev === language ? null : prev));
        }
      } catch {
        // Keep fallback content if translation fetch fails.
        if (!cancelled) {
          setLoadingLanguageCode((prev) => (prev === language ? null : prev));
        }
      }
    }

    loadDynamicPack();
    return () => {
      cancelled = true;
    };
  }, [hydrated, language, dynamicPacks]);

  const setLanguage = (nextLanguage: string) => {
    if (!LANGUAGE_OPTIONS.some((option) => option.code === nextLanguage)) return;
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: mergeWithBase(
        translations.en,
        language in translations
          ? translations[language as SupportedLanguage]
          : dynamicPacks[language]
      ),
      availableLanguages: LANGUAGE_OPTIONS,
      isLanguageLoading: loadingLanguageCode === language,
    }),
    [language, dynamicPacks, loadingLanguageCode]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
