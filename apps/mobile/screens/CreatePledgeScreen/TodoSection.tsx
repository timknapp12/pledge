import { useState, useCallback } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import {
  Title3,
  Body,
  BodySmall,
  ErrorText,
  Row,
  Column,
  FloatingLabelInput,
} from '@/components';
import { styles as screenStyles } from './styles';
import type { TaskDefinition, TaskSchedule } from '@/hooks/useSupabase';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type SchedulePreset = {
  key: TaskSchedule;
  label: string;
};

const SCHEDULE_PRESETS: SchedulePreset[] = [
  { key: 'not_daily', label: 'Not daily' },
  { key: 'every_day', label: 'Every day' },
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'weekends', label: 'Weekends' },
  { key: 'custom', label: 'Custom' },
];

type TodoSectionProps = {
  taskDefinitions: TaskDefinition[];
  showDailyOptions: boolean;
  onAddTask: (def: TaskDefinition) => void;
  onRemoveTask: (index: number) => void;
  onInputFocus?: () => void;
};

const getScheduleLabel = (
  def: TaskDefinition,
  t: (key: string) => string
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

export const TodoSection = ({
  taskDefinitions,
  showDailyOptions,
  onAddTask,
  onRemoveTask,
  onInputFocus,
}: TodoSectionProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();

  // Local UI state
  const [newTodo, setNewTodo] = useState('');
  const [schedule, setSchedule] = useState<TaskSchedule>('not_daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [showEmptyError, setShowEmptyError] = useState(false);

  const handleAdd = useCallback(() => {
    const text = newTodo.trim();
    if (!text) {
      setShowEmptyError(true);
      return;
    }

    // For custom schedule, require at least one day selected
    if (showDailyOptions && schedule === 'custom' && customDays.length === 0) {
      return;
    }

    const effectiveSchedule: TaskSchedule = showDailyOptions
      ? schedule
      : 'not_daily';

    onAddTask({
      text,
      schedule: effectiveSchedule,
      customDays: effectiveSchedule === 'custom' ? [...customDays] : undefined,
    });

    setNewTodo('');
    setShowEmptyError(false);
  }, [newTodo, schedule, customDays, showDailyOptions, onAddTask]);

  const toggleDay = useCallback((dayIndex: number) => {
    setCustomDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    );
  }, []);

  return (
    <View style={screenStyles.section}>
      <Title3 style={{ marginBottom: 12 }}>{t('Action Items')}</Title3>

      {/* Schedule presets — only for 2-90 day pledges */}
      {showDailyOptions && (
        <View style={{ marginBottom: 12 }}>
          <BodySmall
            style={{ color: theme.colors.textSecondary, marginBottom: 8 }}
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

          {/* Custom day-of-week chips — Sun first */}
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
            value={newTodo}
            onChangeText={(text) => {
              if (showEmptyError) setShowEmptyError(false);
              setNewTodo(text);
            }}
            onSubmitEditing={handleAdd}
            returnKeyType='done'
            onFocus={onInputFocus}
          />
        </View>
        {newTodo.trim().length > 0 && (
          <Pressable
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              handleAdd();
            }}
            style={[
              screenStyles.addButton,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <Ionicons name='add' size={24} color={theme.colors.iconOnPrimary} />
          </Pressable>
        )}
      </Row>
      {showEmptyError && (
        <ErrorText style={{ marginTop: 4 }}>
          {t('Enter a task before adding')}
        </ErrorText>
      )}

      {/* Task list */}
      {taskDefinitions.length > 0 && (
        <View style={{ marginTop: 12 }}>
          {taskDefinitions.map((def, index) => {
            const scheduleLabel = getScheduleLabel(def, t);
            return (
              <Row
                key={index}
                gap={12}
                style={[
                  screenStyles.todoRow,
                  { backgroundColor: theme.colors.cardBackground },
                ]}
              >
                <Ionicons
                  name='checkbox-outline'
                  size={20}
                  color={theme.colors.textSecondary}
                />
                <Column flex={1}>
                  <Body>{def.text}</Body>
                  {scheduleLabel && (
                    <BodySmall style={{ color: theme.colors.textSecondary }}>
                      {scheduleLabel}
                    </BodySmall>
                  )}
                </Column>
                <Pressable
                  onPress={() => onRemoveTask(index)}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name='close-circle'
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
  );
};

const styles = StyleSheet.create({
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
});
