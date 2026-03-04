import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { changeLanguage } from '@/i18n';

export type Personality = 'carrot' | 'stick';

export interface SupportedLanguage {
  code: string;
  label: string;
}

interface UserPreferencesContextValue {
  personality: Personality;
  setPersonality: (p: Personality) => Promise<void>;
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  supportedLanguages: SupportedLanguage[];
  isUpdating: boolean;
}

const PERSONALITY_KEY = 'user_personality';
const LANGUAGE_KEY = 'user_language';

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(
  null,
);

export const useUserPreferences = (): UserPreferencesContextValue => {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx)
    throw new Error(
      'useUserPreferences must be used inside UserPreferencesProvider',
    );
  return ctx;
};

export const UserPreferencesProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { supabase, user } = useAuth();
  const [personality, setPersonalityState] = useState<Personality>('carrot');
  const [language, setLanguageState] = useState<string>('en');
  const [supportedLanguages, setSupportedLanguages] = useState<
    SupportedLanguage[]
  >([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Load cached values immediately, then sync from DB
  useEffect(() => {
    const loadCached = async () => {
      const [cachedPersonality, cachedLanguage] = await Promise.all([
        AsyncStorage.getItem(PERSONALITY_KEY),
        AsyncStorage.getItem(LANGUAGE_KEY),
      ]);
      if (cachedPersonality)
        setPersonalityState(cachedPersonality as Personality);
      if (cachedLanguage) {
        setLanguageState(cachedLanguage);
        changeLanguage(cachedLanguage);
      }
    };
    loadCached();
  }, []);

  // Fetch from DB when user is available
  useEffect(() => {
    if (!user) return;

    const fetchPreferences = async () => {
      const { data } = await supabase
        .from('users')
        .select('personality, language')
        .eq('id', user.id)
        .single();

      if (data) {
        const p = (data.personality ?? 'carrot') as Personality;
        const l = data.language ?? 'en';
        setPersonalityState(p);
        setLanguageState(l);
        changeLanguage(l);
        await Promise.all([
          AsyncStorage.setItem(PERSONALITY_KEY, p),
          AsyncStorage.setItem(LANGUAGE_KEY, l),
        ]);
      }
    };
    fetchPreferences();
  }, [user, supabase]);

  // Fetch supported languages from DB
  useEffect(() => {
    const fetchLanguages = async () => {
      const { data } = await supabase
        .from('supported_languages')
        .select('code, label')
        .order('sort_order', { ascending: true });

      if (data?.length) {
        setSupportedLanguages(data);
      }
    };
    fetchLanguages();
  }, [supabase]);

  // Re-schedule notifications for all active pledges
  const rescheduleNotifications = useCallback(async () => {
    if (!user) return;

    const { data: activePledges } = await supabase
      .from('pledges')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'Active')
      .not('reminder_settings', 'is', null);

    if (!activePledges?.length) return;

    await Promise.all(
      activePledges.map((pledge) =>
        supabase.rpc('schedule_pledge_notifications', {
          p_pledge_id: pledge.id,
          p_user_id: user.id,
        }),
      ),
    );
  }, [user, supabase]);

  const setPersonality = useCallback(
    async (p: Personality) => {
      if (!user) return;
      setIsUpdating(true);
      try {
        setPersonalityState(p);
        await AsyncStorage.setItem(PERSONALITY_KEY, p);

        await supabase
          .from('users')
          .update({ personality: p })
          .eq('id', user.id);

        await rescheduleNotifications();
      } catch (err) {
        console.error('Failed to update personality:', err);
      } finally {
        setIsUpdating(false);
      }
    },
    [user, supabase, rescheduleNotifications],
  );

  const setLanguage = useCallback(
    async (lang: string) => {
      if (!user) return;
      setIsUpdating(true);
      try {
        setLanguageState(lang);
        await AsyncStorage.setItem(LANGUAGE_KEY, lang);

        // Update client-side locale
        await changeLanguage(lang);

        // Update DB
        await supabase
          .from('users')
          .update({ language: lang })
          .eq('id', user.id);

        await rescheduleNotifications();
      } catch (err) {
        console.error('Failed to update language:', err);
      } finally {
        setIsUpdating(false);
      }
    },
    [user, supabase, rescheduleNotifications],
  );

  const value: UserPreferencesContextValue = {
    personality,
    setPersonality,
    language,
    setLanguage,
    supportedLanguages,
    isUpdating,
  };

  return React.createElement(
    UserPreferencesContext.Provider,
    { value },
    children,
  );
};
