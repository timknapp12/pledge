import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  initializeI18n,
  detectLanguage,
  changeLanguage,
  getCurrentLanguage,
} from '../i18n';

interface I18nContextType {
  isReady: boolean;
  currentLanguage: string;
  setLanguage: (lang: string) => Promise<void>;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');

  // Initialize i18n on mount
  useEffect(() => {
    const init = async () => {
      await initializeI18n();
      setCurrentLanguage(getCurrentLanguage());
      setIsReady(true);
    };

    init();
  }, []);

  // Re-detect language when app returns from background
  // (user may have changed device language in settings)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isReady) {
        const detectedLang = detectLanguage();
        if (detectedLang !== currentLanguage) {
          await changeLanguage(detectedLang);
          setCurrentLanguage(detectedLang);
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [isReady, currentLanguage]);

  const setLanguage = useCallback(async (lang: string) => {
    await changeLanguage(lang);
    setCurrentLanguage(lang);
  }, []);

  // Don't render children until i18n is ready
  if (!isReady) {
    return null;
  }

  return (
    <I18nContext.Provider value={{ isReady, currentLanguage, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
