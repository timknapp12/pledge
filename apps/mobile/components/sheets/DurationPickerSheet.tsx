import { forwardRef, useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeMode } from '@/theme/ThemeProvider';
import { SHEET_COLORS } from '@/theme/colors';
import { BaseSheet } from './BaseSheet';

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
  const [endTime, setEndTime] = useState({
    hours: value.getHours(),
    minutes: value.getMinutes(),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  useEffect(() => {
    setPreset(selectedPreset);
    setCustomDate(value);
    setEndTime({ hours: value.getHours(), minutes: value.getMinutes() });
  }, [selectedPreset, value]);

  const minimumEndDate = useMemo(
    () => new Date(startDate.getTime() + 60 * 60 * 1000),
    [startDate]
  );

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

  const getEndDate = useCallback((): Date => {
    const date =
      preset === 'custom' ? new Date(customDate) : calculateEndDate(preset);
    date.setHours(endTime.hours, endTime.minutes, 0, 0);
    return date;
  }, [preset, customDate, calculateEndDate, endTime]);

  const openDatePicker = useCallback(
    (initial: Date) => {
      if (Platform.OS === 'android') {
        DateTimePickerAndroid.open({
          value: initial,
          minimumDate: minimumEndDate,
          mode: 'date',
          onChange: (event, date) => {
            if (event.type === 'dismissed' || !date) return;
            setCustomDate(date);
          },
        });
      } else {
        setCustomDate(initial);
        setShowDatePicker(true);
        setShowTimePicker(false);
      }
    },
    [minimumEndDate],
  );

  const openTimePicker = useCallback(() => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: getEndDate(),
        mode: 'time',
        display: 'spinner',
        onChange: (event, date) => {
          if (event.type === 'dismissed' || !date) return;
          setEndTime({ hours: date.getHours(), minutes: date.getMinutes() });
        },
      });
    } else {
      setShowTimePicker(true);
      setShowDatePicker(false);
    }
  }, [getEndDate]);

  const handleDateChange = useCallback((_event: unknown, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setCustomDate(date);
      setPreset('custom');
    }
  }, []);

  const handleTimeChange = useCallback((_event: unknown, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (date) {
      setEndTime({ hours: date.getHours(), minutes: date.getMinutes() });
      setPreset('custom');
    }
  }, []);

  const handlePresetSelect = useCallback(
    (presetKey: DurationPreset) => {
      setPreset(presetKey);
      if (presetKey === 'custom') {
        openDatePicker(customDate);
      } else {
        setShowDatePicker(false);
        setShowTimePicker(false);
      }
    },
    [openDatePicker, customDate],
  );

  const handleClose = useCallback(() => {
    onConfirm(getEndDate(), preset);
    onClose?.();
  }, [getEndDate, preset, onConfirm, onClose]);

  const getDurationDays = (): number => {
    const end = getEndDate();
    const diffTime = end.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <BaseSheet
      ref={ref}
      title={t('Duration')}
      snapPoints={['50%']}
      onClose={handleClose}
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
                      preset === p.key
                        ? colors.primary
                        : colors.cardBackground,
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
                    preset === 'custom'
                      ? colors.primary
                      : colors.cardBackground,
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
            style={[
              styles.summaryCard,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.summaryRow}>
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                {t('Ends')}
              </Text>
              <View style={styles.summaryValue}>
                <Pressable
                  style={[
                    styles.dateChip,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    setPreset('custom');
                    openDatePicker(
                      preset === 'custom' ? customDate : getEndDate()
                    );
                  }}
                >
                  <Text style={[styles.chipText, { color: colors.text }]}>
                    {formatDate(getEndDate())}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.dateChip,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={openTimePicker}
                >
                  <Ionicons
                    name='time-outline'
                    size={14}
                    color={colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.chipText, { color: colors.text }]}>
                    {formatTime(getEndDate())}
                  </Text>
                </Pressable>
              </View>
            </View>
            <View
              style={[
                styles.durationBadge,
                { backgroundColor: colors.primaryAlpha10 },
              ]}
            >
              <Ionicons
                name='calendar-outline'
                size={14}
                color={colors.primary}
              />
              <Text style={[styles.durationText, { color: colors.primary }]}>
                {getDurationDays()}{' '}
                {getDurationDays() === 1 ? t('day') : t('days')}
              </Text>
            </View>
          </View>

          {Platform.OS === 'ios' && showDatePicker && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={customDate}
                mode='date'
                display='spinner'
                minimumDate={minimumEndDate}
                onChange={handleDateChange}
                themeVariant={isDark ? 'dark' : 'light'}
              />
            </View>
          )}

          {Platform.OS === 'ios' && showTimePicker && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={getEndDate()}
                mode='time'
                display='spinner'
                onChange={handleTimeChange}
                themeVariant={isDark ? 'dark' : 'light'}
              />
            </View>
          )}

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
    marginTop: 8,
  },
  summaryValue: {
    alignItems: 'flex-end',
    gap: 6,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
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
    marginTop: 8,
  },
});
