import { useState, useCallback, useRef, useMemo, forwardRef, useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Keyboard,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { BaseSheet } from './BaseSheet';
import { RemindersSheet } from './RemindersSheet';
import {
  Title3,
  Body,
  BodySmall,
  BodySecondary,
  Row,
  PrimaryButton,
  FloatingLabelInput,
} from '@/components/common';
import type {
  Pledge,
  PledgeTodos,
  ReminderSettings,
  TaskDefinition,
  TaskSchedule,
} from '@/hooks/useSupabase';
import { toLocalDateStr } from '@/hooks/useSupabase';

interface EditPledgeSheetProps {
  pledge: Pledge;
  onSave: (
    name: string,
    todos: PledgeTodos,
    reminderSettings: ReminderSettings | null,
  ) => Promise<void>;
}

const MAX_DAILY_TRACKING_DAYS = 90;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type SchedulePreset = { key: TaskSchedule; label: string };

const SCHEDULE_PRESETS: SchedulePreset[] = [
  { key: 'not_daily', label: 'Not daily' },
  { key: 'every_day', label: 'Every day' },
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'weekends', label: 'Weekends' },
  { key: 'custom', label: 'Custom' },
];

/** Append new task definitions to existing PledgeTodos, only for today and future dates. */
const appendNewTasks = (
  existing: PledgeTodos,
  newDefs: TaskDefinition[],
  endDate: Date,
): PledgeTodos => {
  const goals = [...existing.goals];
  const daily: Record<string, string[]> = {};
  for (const [date, tasks] of Object.entries(existing.daily)) {
    daily[date] = [...tasks];
  }

  // Generate dates from today to endDate (exclusive)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const dates: { dateStr: string; dayOfWeek: number }[] = [];
  const current = new Date(today);
  // <= so the deadline day is included (end has been snapped to local midnight).
  while (current <= end) {
    dates.push({
      dateStr: toLocalDateStr(current),
      dayOfWeek: current.getDay(),
    });
    current.setDate(current.getDate() + 1);
  }

  for (const def of newDefs) {
    if (def.schedule === 'not_daily') {
      goals.push(def.text);
      continue;
    }

    for (const { dateStr, dayOfWeek } of dates) {
      let include = false;
      switch (def.schedule) {
        case 'every_day':
          include = true;
          break;
        case 'weekdays':
          include = dayOfWeek >= 1 && dayOfWeek <= 5;
          break;
        case 'weekends':
          include = dayOfWeek === 0 || dayOfWeek === 6;
          break;
        case 'custom':
          include = def.customDays?.includes(dayOfWeek) ?? false;
          break;
      }
      if (include) {
        if (!daily[dateStr]) daily[dateStr] = [];
        // Only append if this task isn't already on this date
        if (!daily[dateStr].includes(def.text)) {
          daily[dateStr].push(def.text);
        }
      }
    }
  }

  return { goals, daily };
};

const getScheduleLabel = (
  def: TaskDefinition,
  t: (key: string) => string,
): string | null => {
  switch (def.schedule) {
    case 'not_daily':
      return null;
    case 'every_day':
      return t('Every day');
    case 'weekdays':
      return t('Weekdays');
    case 'weekends':
      return t('Weekends');
    case 'custom':
      if (!def.customDays?.length) return null;
      return def.customDays.map((d) => t(DAY_LABELS[d])).join(', ');
  }
};

const formatReminderTime = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const EditPledgeSheet = forwardRef<BottomSheet, EditPledgeSheetProps>(
  ({ pledge, onSave }, ref) => {
    const { t } = useTranslation();
    const { theme } = useAppTheme();

    const remindersSheetRef = useRef<BottomSheet>(null);
    const scrollViewRef = useRef<BottomSheetScrollViewMethods>(null);
    const addTaskY = useRef(0);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
      const showEvent =
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent =
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
      const showSub = Keyboard.addListener(showEvent, (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      });
      const hideSub = Keyboard.addListener(hideEvent, () => {
        setKeyboardHeight(0);
      });
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, []);

    const [name, setName] = useState(pledge.name);
    const [reminderSettings, setReminderSettings] =
      useState<ReminderSettings | null>(pledge.reminder_settings);
    const [newTaskDefs, setNewTaskDefs] = useState<TaskDefinition[]>([]);
    const [newTaskText, setNewTaskText] = useState('');
    const [schedule, setSchedule] = useState<TaskSchedule>('not_daily');
    const [customDays, setCustomDays] = useState<number[]>([]);
    const [showEmptyError, setShowEmptyError] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Reset state when sheet opens
    useEffect(() => {
      if (isOpen) {
        setName(pledge.name);
        setReminderSettings(pledge.reminder_settings);
        setNewTaskDefs([]);
        setNewTaskText('');
        setSchedule('not_daily');
        setCustomDays([]);
        setShowEmptyError(false);
      }
    }, [isOpen, pledge]);

    // Compute remaining days for daily options
    const remainingDays = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(pledge.end_date);
      end.setHours(0, 0, 0, 0);
      return Math.ceil(
        (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
    }, [pledge.end_date]);

    const showDailyOptions =
      remainingDays >= 2 && remainingDays <= MAX_DAILY_TRACKING_DAYS;

    // Get unique existing daily task texts
    const existingDailyTasks = useMemo((): string[] => {
      const seen = new Set<string>();
      const result: string[] = [];
      for (const tasks of Object.values(pledge.todos.daily)) {
        for (const task of tasks) {
          if (!seen.has(task)) {
            seen.add(task);
            result.push(task);
          }
        }
      }
      return result;
    }, [pledge.todos.daily]);

    // Reminders label
    const remindersLabel = useMemo((): string => {
      if (!reminderSettings || reminderSettings.reminders.length === 0) {
        return t('None');
      }
      const parts: string[] = [];
      const dailyReminder = reminderSettings.reminders.find(
        (r) => r.type === 'daily',
      );
      if (dailyReminder?.time) {
        parts.push(
          `${t('Daily at')} ${formatReminderTime(dailyReminder.time)}`,
        );
      }
      const deadlineReminders = reminderSettings.reminders
        .filter((r) => r.type === 'before_deadline' && r.hours)
        .map((r) => {
          if (r.hours === 24) return t('1 day before');
          if (r.hours === 1) return t('1 hour before');
          return `${r.hours} ${t('hours before')}`;
        });
      if (deadlineReminders.length > 0) {
        parts.push(deadlineReminders.join(', '));
      }
      return parts.join(', ') || t('None');
    }, [reminderSettings, t]);

    const scrollToAddTask = useCallback(() => {
      // Wait for keyboard spacer to render, then scroll
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, addTaskY.current - 80),
          animated: true,
        });
      }, 400);
    }, []);

    // Add new task
    const handleAddTask = useCallback(() => {
      const text = newTaskText.trim();
      if (!text) {
        setShowEmptyError(true);
        return;
      }
      if (showDailyOptions && schedule === 'custom' && customDays.length === 0) {
        return;
      }

      const effectiveSchedule: TaskSchedule = showDailyOptions
        ? schedule
        : 'not_daily';

      setNewTaskDefs((prev) => [
        ...prev,
        {
          text,
          schedule: effectiveSchedule,
          customDays:
            effectiveSchedule === 'custom' ? [...customDays] : undefined,
        },
      ]);
      setNewTaskText('');
      setShowEmptyError(false);
    }, [newTaskText, schedule, customDays, showDailyOptions]);

    const removeNewTask = useCallback((index: number) => {
      setNewTaskDefs((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const toggleDay = useCallback((dayIndex: number) => {
      setCustomDays((prev) =>
        prev.includes(dayIndex)
          ? prev.filter((d) => d !== dayIndex)
          : [...prev, dayIndex].sort((a, b) => a - b),
      );
    }, []);

    // Detect changes
    const hasChanges =
      name !== pledge.name ||
      newTaskDefs.length > 0 ||
      JSON.stringify(reminderSettings) !==
        JSON.stringify(pledge.reminder_settings);

    const handleSave = useCallback(async () => {
      if (!hasChanges) return;
      Keyboard.dismiss();
      setIsSaving(true);
      try {
        let updatedTodos = pledge.todos;
        if (newTaskDefs.length > 0) {
          updatedTodos = appendNewTasks(
            pledge.todos,
            newTaskDefs,
            new Date(pledge.end_date),
          );
        }
        await onSave(name.trim(), updatedTodos, reminderSettings);
        if (ref && 'current' in ref && ref.current) {
          ref.current.close();
        }
      } finally {
        setIsSaving(false);
      }
    }, [hasChanges, name, pledge, newTaskDefs, reminderSettings, onSave, ref]);

    return (
      <>
        <BaseSheet
          ref={ref}
          title={t('Edit Pledge')}
          enableDynamicSizing={false}
          snapPoints={['85%']}
          scrollable
          scrollViewRef={scrollViewRef}
          renderFooter={() => (
            <PrimaryButton
              onPress={handleSave}
              disabled={!hasChanges || isSaving}
              loading={isSaving}
            >
              {t('Save')}
            </PrimaryButton>
          )}
          onOpen={() => setIsOpen(true)}
          onClose={() => setIsOpen(false)}
        >
            {/* Pledge Name */}
            <View style={[styles.section, { marginTop: 8 }]}>
              <FloatingLabelInput
                label={t('Goal Name')}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Reminders */}
            <View style={styles.section}>
              <Title3 style={{ marginBottom: 12 }}>{t('Reminders')}</Title3>
              <Pressable
                style={[
                  styles.reminderRow,
                  { backgroundColor: theme.colors.cardBackground },
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  remindersSheetRef.current?.expand();
                }}
              >
                <BodySecondary style={{ flex: 1 }}>
                  {remindersLabel}
                </BodySecondary>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* Existing Tasks (read-only) */}
            {(existingDailyTasks.length > 0 ||
              pledge.todos.goals.length > 0) && (
              <View style={styles.section}>
                <Title3 style={{ marginBottom: 12 }}>
                  {t('Current Tasks')}
                </Title3>
                {existingDailyTasks.map((taskText, index) => (
                  <View
                    key={`daily-${index}`}
                    style={[
                      styles.readOnlyRow,
                      { backgroundColor: theme.colors.cardBackground },
                    ]}
                  >
                    <Ionicons
                      name="checkbox-outline"
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                    <Body style={{ flex: 1 }}>{taskText}</Body>
                  </View>
                ))}
                {pledge.todos.goals.map((goalText, index) => (
                  <View
                    key={`goal-${index}`}
                    style={[
                      styles.readOnlyRow,
                      { backgroundColor: theme.colors.cardBackground },
                    ]}
                  >
                    <Ionicons
                      name="flag-outline"
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                    <Body style={{ flex: 1 }}>{goalText}</Body>
                  </View>
                ))}
              </View>
            )}

            {/* Add New Tasks */}
            <View
              style={styles.section}
              onLayout={(e: LayoutChangeEvent) => {
                addTaskY.current = e.nativeEvent.layout.y;
              }}
            >
              <Title3 style={{ marginBottom: 12 }}>
                {t('Add New Tasks')}
              </Title3>

              {/* Schedule presets */}
              {showDailyOptions && (
                <View style={{ marginBottom: 12 }}>
                  <BodySmall
                    style={{
                      color: theme.colors.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    {t('Schedule')}
                  </BodySmall>
                  <View style={styles.presetRow}>
                    {SCHEDULE_PRESETS.map((preset) => {
                      const selected = schedule === preset.key;
                      return (
                        <Pressable
                          key={preset.key}
                          style={[
                            styles.presetChip,
                            {
                              backgroundColor: selected
                                ? theme.colors.primary
                                : theme.colors.cardBackground,
                              borderColor: selected
                                ? theme.colors.primary
                                : theme.colors.border,
                            },
                          ]}
                          onPress={() => setSchedule(preset.key)}
                        >
                          <BodySmall
                            style={{
                              color: selected
                                ? theme.colors.iconOnPrimary
                                : theme.colors.text,
                              fontWeight: '600',
                            }}
                          >
                            {t(preset.label)}
                          </BodySmall>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Custom day-of-week chips */}
                  {schedule === 'custom' && (
                    <View style={styles.dayRow}>
                      {DAY_LABELS.map((label, index) => {
                        const selected = customDays.includes(index);
                        return (
                          <Pressable
                            key={index}
                            style={[
                              styles.dayChip,
                              {
                                backgroundColor: selected
                                  ? theme.colors.primary
                                  : 'transparent',
                                borderColor: selected
                                  ? theme.colors.primary
                                  : theme.colors.border,
                              },
                            ]}
                            onPress={() => toggleDay(index)}
                          >
                            <BodySmall
                              style={{
                                color: selected
                                  ? theme.colors.iconOnPrimary
                                  : theme.colors.text,
                                fontWeight: '500',
                              }}
                            >
                              {t(label)}
                            </BodySmall>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Task input */}
              <Row gap={8}>
                <View style={{ flex: 1 }}>
                  <FloatingLabelInput
                    label={t('Add a task')}
                    value={newTaskText}
                    onChangeText={(text) => {
                      if (showEmptyError) setShowEmptyError(false);
                      setNewTaskText(text);
                    }}
                    onFocus={scrollToAddTask}
                    onSubmitEditing={
                      newTaskText.trim().length > 0
                        ? handleAddTask
                        : Keyboard.dismiss
                    }
                    returnKeyType="done"
                  />
                </View>
                {newTaskText.trim().length > 0 && (
                  <Pressable
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {}
                      handleAddTask();
                    }}
                    style={[
                      styles.addButton,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <Ionicons
                      name="add"
                      size={24}
                      color={theme.colors.iconOnPrimary}
                    />
                  </Pressable>
                )}
              </Row>
              {showEmptyError && (
                <BodySmall style={{ color: theme.colors.error, marginTop: 4 }}>
                  {t('Enter a task before adding')}
                </BodySmall>
              )}

              {/* Newly added tasks */}
              {newTaskDefs.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  {newTaskDefs.map((def, index) => {
                    const scheduleLabel = getScheduleLabel(def, t);
                    return (
                      <Row
                        key={index}
                        gap={12}
                        style={[
                          styles.newTaskRow,
                          { backgroundColor: theme.colors.cardBackground },
                        ]}
                      >
                        <Ionicons
                          name="checkbox-outline"
                          size={20}
                          color={theme.colors.textSecondary}
                        />
                        <View style={{ flex: 1 }}>
                          <Body>{def.text}</Body>
                          {scheduleLabel && (
                            <BodySmall
                              style={{ color: theme.colors.textSecondary }}
                            >
                              {scheduleLabel}
                            </BodySmall>
                          )}
                        </View>
                        <Pressable
                          onPress={() => removeNewTask(index)}
                          style={{ padding: 4 }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color={theme.colors.textSecondary}
                          />
                        </Pressable>
                      </Row>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Info text */}
            <View style={styles.section}>
              <BodySmall style={{ color: theme.colors.textSecondary }}>
                {t(
                  'Pledge amount, deadline, and existing tasks cannot be changed once created.',
                )}
              </BodySmall>
            </View>

            {/* Keyboard spacer */}
            {keyboardHeight > 0 && <View style={{ height: keyboardHeight }} />}
        </BaseSheet>

        <RemindersSheet
          ref={remindersSheetRef}
          value={reminderSettings}
          onConfirm={setReminderSettings}
        />
      </>
    );
  },
);

EditPledgeSheet.displayName = 'EditPledgeSheet';

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  newTaskRow: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
});
