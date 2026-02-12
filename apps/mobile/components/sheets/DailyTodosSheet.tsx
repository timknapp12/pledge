import { forwardRef, useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeMode } from '@/theme/ThemeProvider';
import { SHEET_COLORS } from '@/theme/colors';
import { BaseSheet } from './BaseSheet';
import { RoundButton } from '../common/buttons';
import { Row } from '../common';
import { type Todo } from '@/hooks/useSupabase';

interface DailyTodosSheetProps {
  todos: Todo[];
  startDate: Date;
  endDate: Date;
  onConfirm: (todos: Todo[]) => void;
  onClose?: () => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DailyTodosSheet = forwardRef<BottomSheet, DailyTodosSheetProps>(
  ({ todos, startDate, endDate, onConfirm, onClose }, ref) => {
    const { t } = useTranslation();
    const { isDark } = useThemeMode();
    const colors = isDark ? SHEET_COLORS.dark : SHEET_COLORS.light;

    const [editedTodos, setEditedTodos] = useState<Todo[]>(todos);

    useEffect(() => {
      setEditedTodos(todos);
    }, [todos]);

    const availableDays = useMemo(() => {
      const days: { dayIndex: number; date: Date; label: string }[] = [];
      const current = new Date(startDate);

      while (current < endDate) {
        const dayIndex = current.getDay();
        days.push({
          dayIndex,
          date: new Date(current),
          label: DAY_LABELS[dayIndex],
        });
        current.setDate(current.getDate() + 1);
      }

      return days;
    }, [startDate, endDate]);

    const uniqueDayIndices = useMemo(() => {
      return [...new Set(availableDays.map((d) => d.dayIndex))].sort(
        (a, b) => a - b
      );
    }, [availableDays]);

    const handleToggleDay = useCallback(
      (todoIndex: number, dayIndex: number) => {
        setEditedTodos((prev) => {
          const updated = [...prev];
          const todo = { ...updated[todoIndex] };

          if (todo.days === null) {
            todo.days = uniqueDayIndices.filter((d) => d !== dayIndex);
          } else if (todo.days.includes(dayIndex)) {
            todo.days = todo.days.filter((d) => d !== dayIndex);
            if (todo.days.length === 0) {
              todo.days = null;
            }
          } else {
            todo.days = [...todo.days, dayIndex].sort((a, b) => a - b);
            if (todo.days.length === uniqueDayIndices.length) {
              todo.days = null;
            }
          }

          updated[todoIndex] = todo;
          return updated;
        });
      },
      [uniqueDayIndices]
    );

    const handleSetEveryDay = useCallback((todoIndex: number) => {
      setEditedTodos((prev) => {
        const updated = [...prev];
        updated[todoIndex] = { ...updated[todoIndex], days: null };
        return updated;
      });
    }, []);

    const handleConfirm = useCallback(() => {
      onConfirm(editedTodos);
      if (ref && 'current' in ref && ref.current) {
        ref.current.close();
      }
    }, [editedTodos, onConfirm, ref]);

    const isDaySelected = (todo: Todo, dayIndex: number): boolean => {
      if (todo.days === null) return true;
      return todo.days.includes(dayIndex);
    };

    const getDaysSummary = (todo: Todo): string => {
      if (todo.days === null) return t('Every day');
      if (todo.days.length === 0) return t('No days selected');
      return todo.days.map((d) => t(DAY_LABELS[d])).join(', ');
    };

    return (
      <BaseSheet
        ref={ref}
        title={t('Daily Schedule')}
        snapPoints={['75%']}
        onClose={onClose}
      >
        <View style={styles.container}>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t('Assign each task to specific days or keep for every day')}
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
          >
            {editedTodos.map((todo, todoIndex) => (
              <View
                key={todoIndex}
                style={[
                  styles.todoCard,
                  { backgroundColor: colors.cardBackground },
                ]}
              >
                <View style={styles.todoHeader}>
                  <Ionicons
                    name='checkbox-outline'
                    size={18}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.todoText, { color: colors.text }]}>
                    {todo.text}
                  </Text>
                </View>

                <View style={styles.daysRow}>
                  {uniqueDayIndices.map((dayIndex) => (
                    <Pressable
                      key={dayIndex}
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: isDaySelected(todo, dayIndex)
                            ? colors.primary
                            : 'transparent',
                          borderColor: isDaySelected(todo, dayIndex)
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                      onPress={() => handleToggleDay(todoIndex, dayIndex)}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          {
                            color: isDaySelected(todo, dayIndex)
                              ? colors.iconOnPrimary
                              : colors.text,
                          },
                        ]}
                      >
                        {t(DAY_LABELS[dayIndex])}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.todoFooter}>
                  <Text
                    style={[
                      styles.daysSummary,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {getDaysSummary(todo)}
                  </Text>
                  {todo.days !== null && (
                    <Pressable onPress={() => handleSetEveryDay(todoIndex)}>
                      <Text
                        style={[styles.allDaysLink, { color: colors.primary }]}
                      >
                        {t('All days')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

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
      </BaseSheet>
    );
  }
);

DailyTodosSheet.displayName = 'DailyTodosSheet';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  todoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  todoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '500',
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  todoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  daysSummary: {
    fontSize: 13,
  },
  allDaysLink: {
    fontSize: 13,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    paddingTop: 16,
    gap: 12,
    marginTop: 'auto',
  },
  buttonWrapper: {
    flex: 1,
  },
});
