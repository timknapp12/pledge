import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserPreferences } from './useUserPreferences';

/**
 * Returns a `tp()` function that resolves personality-variant translations.
 *
 * Uses i18next's built-in context feature. Calling `tp('Some string')`
 * looks up `"Some string_carrot"` or `"Some string_stick"` in locale files
 * based on the user's personality preference.
 *
 * Locale file format:
 *   "Some string_carrot": "You're doing great!",
 *   "Some string_stick": "Stop slacking."
 */
export const usePersonalityText = () => {
  const { t } = useTranslation();
  const { personality } = useUserPreferences();

  const tp = useCallback(
    (key: string) => t(key, { context: personality }),
    [t, personality],
  );

  return tp;
};
