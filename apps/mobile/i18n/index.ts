import 'intl-pluralrules';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import locale files
import en from './locales/en.json';
import es from './locales/es.json';

// Type-safe translation keys
export type TranslationKey = keyof typeof en;

const resources = {
  en: { translation: en },
  es: { translation: es },
};

export const detectLanguage = (): string => {
  try {
    const languageCode = Localization.getLocales()[0]?.languageCode;
    // Only return supported languages, otherwise fallback to English
    return languageCode && ['en', 'es'].includes(languageCode)
      ? languageCode
      : 'en';
  } catch {
    return 'en';
  }
};

export const initializeI18n = async (): Promise<void> => {
  const language = detectLanguage();

  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: 'en',
    resources,
    ns: ['translation'],
    defaultNS: 'translation',
    debug: __DEV__,
    interpolation: { escapeValue: false },
  });
};

export const changeLanguage = async (lang: string): Promise<void> => {
  await i18n.changeLanguage(lang);
};

export const getCurrentLanguage = (): string => {
  return i18n.language || 'en';
};

export default i18n;
