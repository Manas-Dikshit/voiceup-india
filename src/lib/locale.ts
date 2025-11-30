const SUPPORTED_LOCALES = ['en', 'hi', 'od'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: AppLocale = 'en';

type LocaleConfig = {
  acceptLanguage: string;
  apiLanguage: string;
};

const LOCALE_CONFIG: Record<AppLocale, LocaleConfig> = {
  en: {
    acceptLanguage: 'en-IN,en;q=0.9',
    apiLanguage: 'en',
  },
  hi: {
    acceptLanguage: 'hi-IN,hi;q=0.9,en;q=0.8',
    apiLanguage: 'hi',
  },
  od: {
    acceptLanguage: 'or-IN,or;q=0.9,en;q=0.7',
    apiLanguage: 'or',
  },
};

const normalizeLocaleInput = (input?: string | null): string | undefined => {
  if (!input) return undefined;
  return input.split('-')[0]?.toLowerCase();
};

export const normalizeAppLocale = (input?: string | null): AppLocale => {
  const normalized = normalizeLocaleInput(input);
  if (normalized === 'or') return 'od';
  if (normalized && (SUPPORTED_LOCALES as readonly string[]).includes(normalized)) {
    return normalized as AppLocale;
  }
  return DEFAULT_LOCALE;
};

export type LanguagePreference = {
  locale: AppLocale;
  acceptLanguage: string;
  apiLanguage: string;
};

export const resolveLanguagePreference = (input?: string | null): LanguagePreference => {
  const locale = normalizeAppLocale(input);
  const config = LOCALE_CONFIG[locale] ?? LOCALE_CONFIG[DEFAULT_LOCALE];
  return {
    locale,
    acceptLanguage: config.acceptLanguage,
    apiLanguage: config.apiLanguage,
  };
};

export const getBrowserLanguagePreference = (): LanguagePreference => {
  const browserLocale = typeof navigator !== 'undefined' ? navigator.language : undefined;
  return resolveLanguagePreference(browserLocale);
};

export { SUPPORTED_LOCALES };
