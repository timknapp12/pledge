import { forwardRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { Switch } from '@/components/common';
import BottomSheet from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeMode } from '@/theme/ThemeProvider';
import { SHEET_COLORS } from '@/theme/colors';
import { BaseSheet } from './BaseSheet';
import { RoundButton, Row } from '../common';
import {
  type ReminderConfig,
  type ReminderSettings,
} from '@/hooks/useSupabase';
import { useNotifications } from '@/hooks/useNotifications';

interface RemindersSheetProps {
  value: ReminderSettings | null;
  onConfirm: (settings: ReminderSettings | null) => void;
  onClose?: () => void;
}

const DEADLINE_OPTIONS = [
  { hours: 24, label: '1 day before' },
  { hours: 1, label: '1 hour before' },
];

export const RemindersSheet = forwardRef<BottomSheet, RemindersSheetProps>(
  ({ value, onConfirm, onClose }, ref) => {
    const { t } = useTranslation();
    const { isDark } = useThemeMode();
    const colors = isDark ? SHEET_COLORS.dark : SHEET_COLORS.light;
    const { registerForPushNotifications, permissionStatus } =
      useNotifications();

    const [dailyEnabled, setDailyEnabled] = useState(false);
    const [dailyTime, setDailyTime] = useState(new Date());
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [deadlineReminders, setDeadlineReminders] = useState<number[]>([]);
    const [hasBeenOpened, setHasBeenOpened] = useState(false);

    useEffect(() => {
      if (value?.reminders) {
        const dailyReminder = value.reminders.find((r) => r.type === 'daily');
        if (dailyReminder) {
          setDailyEnabled(true);
          if (dailyReminder.time) {
            const [hours, minutes] = dailyReminder.time.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            setDailyTime(date);
          }
        } else {
          setDailyEnabled(false);
        }

        const deadlines = value.reminders
          .filter((r) => r.type === 'before_deadline' && r.hours)
          .map((r) => r.hours!);
        setDeadlineReminders(deadlines);
      } else {
        setDailyEnabled(false);
        setDeadlineReminders([]);
      }
    }, [value]);

    const ensureNotificationsEnabled = async (): Promise<boolean> => {
      // If already granted, we're good
      if (permissionStatus === 'granted') {
        return true;
      }

      // Register for push notifications (handles permission request + token storage)
      const token = await registerForPushNotifications();

      if (!token) {
        Alert.alert(
          t('Notifications Disabled'),
          t(
            'Please enable notifications in your device settings to receive reminders.',
          ),
          [{ text: t('OK') }],
        );
        return false;
      }

      return true;
    };

    const handleDailyToggle = async (enabled: boolean) => {
      if (enabled) {
        const hasPermission = await ensureNotificationsEnabled();
        if (!hasPermission) return;
      }
      setDailyEnabled(enabled);
    };

    const handleDeadlineToggle = async (hours: number) => {
      const isCurrentlyEnabled = deadlineReminders.includes(hours);

      if (!isCurrentlyEnabled) {
        const hasPermission = await ensureNotificationsEnabled();
        if (!hasPermission) return;
        setDeadlineReminders((prev) => [...prev, hours]);
      } else {
        setDeadlineReminders((prev) => prev.filter((h) => h !== hours));
      }
    };

    const handleTimeChange = useCallback((_event: any, date?: Date) => {
      if (Platform.OS === 'android') {
        setShowTimePicker(false);
      }
      if (date) {
        setDailyTime(date);
      }
    }, []);

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
    };

    const formatTimeForStorage = (date: Date): string => {
      return `${date.getHours().toString().padStart(2, '0')}:${date
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
    };

    const handleConfirm = useCallback(() => {
      const reminders: ReminderConfig[] = [];

      if (dailyEnabled) {
        reminders.push({
          type: 'daily',
          time: formatTimeForStorage(dailyTime),
        });
      }

      deadlineReminders.forEach((hours) => {
        reminders.push({
          type: 'before_deadline',
          hours,
        });
      });

      const settings: ReminderSettings | null =
        reminders.length > 0 ? { reminders } : null;
      onConfirm(settings);

      if (ref && 'current' in ref && ref.current) {
        ref.current.close();
      }
    }, [dailyEnabled, dailyTime, deadlineReminders, onConfirm, ref]);

    return (
      <BaseSheet
        ref={ref}
        title={t('Reminders')}
        snapPoints={['55%']}
        onClose={onClose}
        onOpen={() => setHasBeenOpened(true)}
      >
        {hasBeenOpened && (
          <View style={styles.container}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderContent}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('Daily Reminder')}
                    </Text>
                    <Text
                      style={[
                        styles.sectionSubtitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t('Get reminded every day')}
                    </Text>
                  </View>
                  <Switch
                    value={dailyEnabled}
                    onValueChange={handleDailyToggle}
                  />
                </View>
              </View>

              {dailyEnabled && (
                <Pressable
                  style={[
                    styles.timeSelector,
                    { backgroundColor: colors.cardBackground },
                  ]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text
                    style={[
                      styles.timeSelectorLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t('Time')}
                  </Text>
                  <View style={styles.timeSelectorValue}>
                    <Text
                      style={[styles.timeSelectorText, { color: colors.text }]}
                    >
                      {formatTime(dailyTime)}
                    </Text>
                    <Ionicons
                      name='chevron-forward'
                      size={16}
                      color={colors.textSecondary}
                    />
                  </View>
                </Pressable>
              )}

              {showTimePicker && (
                <View style={styles.timePickerContainer}>
                  <DateTimePicker
                    value={dailyTime}
                    mode='time'
                    display='spinner'
                    onChange={handleTimeChange}
                    themeVariant={isDark ? 'dark' : 'light'}
                  />
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: colors.textSecondary }]}
              >
                {t('Deadline Reminders')}
              </Text>
              {DEADLINE_OPTIONS.map((option) => (
                <View
                  key={option.hours}
                  style={[
                    styles.optionRow,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>
                    {t(option.label)}
                  </Text>
                  <Switch
                    value={deadlineReminders.includes(option.hours)}
                    onValueChange={() => handleDeadlineToggle(option.hours)}
                  />
                </View>
              ))}
            </View>

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
  },
);

RemindersSheet.displayName = 'RemindersSheet';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    paddingVertical: 12,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  timeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  timeSelectorLabel: {
    fontSize: 15,
  },
  timeSelectorValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeSelectorText: {
    fontSize: 15,
  },
  timePickerContainer: {
    marginTop: 8,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
  },
});
