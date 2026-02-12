import { forwardRef, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeMode } from '@/theme/ThemeProvider';
import { SHEET_COLORS } from '@/theme/colors';
import { BaseSheet } from './BaseSheet';
import { RoundButton, Row } from '../common';

export type DurationPreset = '1day' | '1week' | '1month' | 'custom';

interface DurationPickerSheetProps {
  startDate: Date;
  value: Date;
  selectedPreset: DurationPreset;
  onConfirm: (endDate: Date, preset: DurationPreset) => void;
  onClose?: () => void;
}

const PRESETS: { key: DurationPreset; label: string; days: number }[] = [
  { key: '1day', label: '1 Day', days: 1 },
  { key: '1week', label: '1 Week', days: 7 },
  { key: '1month', label: '1 Month', days: 30 },
];

export const DurationPickerSheet = forwardRef<
  BottomSheet,
  DurationPickerSheetProps
>(({ startDate, value, selectedPreset, onConfirm, onClose }, ref) => {
  const { t } = useTranslation();
  const { isDark } = useThemeMode();
  const colors = isDark ? SHEET_COLORS.dark : SHEET_COLORS.light;

  const [preset, setPreset] = useState<DurationPreset>(selectedPreset);
  const [customDate, setCustomDate] = useState(value);
  const [showCustomPicker, setShowCustomPicker] = useState(
    selectedPreset === 'custom'
  );
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  useEffect(() => {
    setPreset(selectedPreset);
    setCustomDate(value);
    setShowCustomPicker(selectedPreset === 'custom');
  }, [selectedPreset, value]);

  const calculateEndDate = useCallback(
    (presetKey: DurationPreset): Date => {
      const end = new Date(startDate);
      const presetConfig = PRESETS.find((p) => p.key === presetKey);
      if (presetConfig) {
        end.setDate(end.getDate() + presetConfig.days);
      }
      return end;
    },
    [startDate]
  );

  const handlePresetSelect = useCallback(
    (presetKey: DurationPreset) => {
      setPreset(presetKey);
      if (presetKey === 'custom') {
        setShowCustomPicker(true);
      } else {
        setShowCustomPicker(false);
        setCustomDate(calculateEndDate(presetKey));
      }
    },
    [calculateEndDate]
  );

  const handleCustomDateChange = useCallback((_event: any, date?: Date) => {
    if (date) {
      setCustomDate(date);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    const endDate = preset === 'custom' ? customDate : calculateEndDate(preset);
    onConfirm(endDate, preset);
    if (ref && 'current' in ref && ref.current) {
      ref.current.close();
    }
  }, [preset, customDate, calculateEndDate, onConfirm, ref]);

  const getEndDate = (): Date => {
    return preset === 'custom' ? customDate : calculateEndDate(preset);
  };

  const getDurationDays = (): number => {
    const end = getEndDate();
    const diffTime = end.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const minimumEndDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  return (
    <BaseSheet
      ref={ref}
      title={t('Duration')}
      snapPoints={hasBeenOpened && showCustomPicker ? ['70%'] : ['50%']}
      onClose={onClose}
      onOpen={() => setHasBeenOpened(true)}
    >
      {hasBeenOpened && (
      <View style={styles.container}>
        <View style={styles.presetRow}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.key}
              style={[
                styles.presetButton,
                {
                  backgroundColor:
                    preset === p.key ? colors.primary : colors.cardBackground,
                  borderColor:
                    preset === p.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => handlePresetSelect(p.key)}
            >
              <Text
                style={[
                  styles.presetText,
                  {
                    color:
                      preset === p.key ? colors.iconOnPrimary : colors.text,
                  },
                ]}
              >
                {t(p.label)}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[
              styles.presetButton,
              {
                backgroundColor:
                  preset === 'custom' ? colors.primary : colors.cardBackground,
                borderColor:
                  preset === 'custom' ? colors.primary : colors.border,
              },
            ]}
            onPress={() => handlePresetSelect('custom')}
          >
            <Text
              style={[
                styles.presetText,
                {
                  color:
                    preset === 'custom' ? colors.iconOnPrimary : colors.text,
                },
              ]}
            >
              {t('Custom')}
            </Text>
          </Pressable>
        </View>

        <View
          style={[styles.summaryCard, { backgroundColor: colors.background }]}
        >
          <View style={styles.summaryRow}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              {t('Ends')}
            </Text>
            <View style={styles.summaryValue}>
              <Text style={[styles.summaryText, { color: colors.text }]}>
                {formatDate(getEndDate())}
              </Text>
              <Text
                style={[styles.summarySubtext, { color: colors.textSecondary }]}
              >
                {formatTime(getEndDate())}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.durationBadge,
              { backgroundColor: colors.primaryAlpha10 },
            ]}
          >
            <Ionicons name='time-outline' size={14} color={colors.primary} />
            <Text style={[styles.durationText, { color: colors.primary }]}>
              {getDurationDays()}{' '}
              {getDurationDays() === 1 ? t('day') : t('days')}
            </Text>
          </View>
        </View>

        {showCustomPicker && (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={customDate}
              mode='datetime'
              display='spinner'
              onChange={handleCustomDateChange}
              minimumDate={minimumEndDate}
              themeVariant={isDark ? 'dark' : 'light'}
            />
          </View>
        )}

        <Row>
          <RoundButton
            variant='secondary'
            icon='close'
            onPress={() => {
              if (ref && 'current' in ref && ref.current) {
                ref.current.close();
              }
            }}
          />
          <RoundButton icon='checkmark' onPress={handleConfirm} />
        </Row>
      </View>
      )}
    </BaseSheet>
  );
});

DurationPickerSheet.displayName = 'DurationPickerSheet';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  presetButton: {
    flex: 1,
    minWidth: 70,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryLabel: {
    fontSize: 15,
  },
  summaryValue: {
    alignItems: 'flex-end',
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '500',
  },
  summarySubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  durationText: {
    fontSize: 13,
    marginLeft: 4,
    fontWeight: '500',
  },
  pickerContainer: {
    flex: 1,
    minHeight: 150,
  },
});
