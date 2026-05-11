import { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '@/theme/ThemeProvider';
import { SHEET_COLORS } from '@/theme/colors';
import { BaseSheet } from './BaseSheet';
import { DEFAULT_GRACE_PERIOD_SECONDS } from '@/lib/anchor/constants';

interface GracePeriodInfoSheetProps {
  deadline: string;
}

function formatGraceEnd(graceEnd: Date): string {
  return (
    graceEnd.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' ' +
    graceEnd.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  );
}

export const GracePeriodInfoSheet = forwardRef<
  BottomSheet,
  GracePeriodInfoSheetProps
>(({ deadline }, ref) => {
  const { t } = useTranslation();
  const { isDark } = useThemeMode();
  const colors = isDark ? SHEET_COLORS.dark : SHEET_COLORS.light;

  const graceEnd = new Date(
    new Date(deadline).getTime() + DEFAULT_GRACE_PERIOD_SECONDS * 1000,
  );
  const graceHours = Math.round(DEFAULT_GRACE_PERIOD_SECONDS / 3600);

  return (
    <BaseSheet ref={ref} title={t('Grace Period')}>
      <View style={styles.container}>
        <Text style={[styles.body, { color: colors.text }]}>
          {t(
            'Your deadline has passed. You have a {{hours}}-hour grace period to report your completion. If your pledge is not 100% complete by the time the grace period ends, you will forfeit funds for the unfinished portion.',
            { hours: graceHours },
          )}
        </Text>
        <View style={[styles.endsRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('Grace period ends')}
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {formatGraceEnd(graceEnd)}
          </Text>
        </View>
      </View>
    </BaseSheet>
  );
});

GracePeriodInfoSheet.displayName = 'GracePeriodInfoSheet';

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  endsRow: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 4,
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
});
