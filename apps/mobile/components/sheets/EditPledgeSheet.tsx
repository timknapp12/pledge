import { useState, useCallback, forwardRef, useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Keyboard,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { BaseSheet } from './BaseSheet';
import {
  Title3,
  Body,
  BodySmall,
  Row,
  PrimaryButton,
  FloatingLabelInput,
} from '@/components/common';
import type { Pledge, PledgeTodos } from '@/hooks/useSupabase';
import type { AppTheme } from '@/theme';

interface EditPledgeSheetProps {
  pledge: Pledge;
  onSave: (name: string, todos: PledgeTodos) => Promise<void>;
}

export const EditPledgeSheet = forwardRef<BottomSheet, EditPledgeSheetProps>(
  ({ pledge, onSave }, ref) => {
    const { t } = useTranslation();
    const { theme } = useAppTheme();

    const [name, setName] = useState(pledge.name);
    const [todos, setTodos] = useState<PledgeTodos>(pledge.todos);
    const [newGoal, setNewGoal] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Reset state when sheet opens with fresh pledge data
    useEffect(() => {
      if (isOpen) {
        setName(pledge.name);
        setTodos(pledge.todos);
        setNewGoal('');
      }
    }, [isOpen, pledge]);

    // Get unique daily task texts (same text appears across multiple dates)
    const uniqueDailyTasks = useCallback((): string[] => {
      const seen = new Set<string>();
      const result: string[] = [];
      for (const tasks of Object.values(todos.daily)) {
        for (const task of tasks) {
          if (!seen.has(task)) {
            seen.add(task);
            result.push(task);
          }
        }
      }
      return result;
    }, [todos.daily]);

    const renameDailyTask = useCallback(
      (oldText: string, newText: string) => {
        if (!newText.trim() || oldText === newText) return;
        const newDaily: Record<string, string[]> = {};
        for (const [date, tasks] of Object.entries(todos.daily)) {
          newDaily[date] = tasks.map((t) => (t === oldText ? newText : t));
        }
        setTodos({ ...todos, daily: newDaily });
      },
      [todos],
    );

    const renameGoal = useCallback(
      (index: number, newText: string) => {
        if (!newText.trim()) return;
        const newGoals = [...todos.goals];
        newGoals[index] = newText;
        setTodos({ ...todos, goals: newGoals });
      },
      [todos],
    );

    const addGoal = useCallback(() => {
      const text = newGoal.trim();
      if (!text) return;
      setTodos({ ...todos, goals: [...todos.goals, text] });
      setNewGoal('');
    }, [newGoal, todos]);

    const hasChanges =
      name !== pledge.name ||
      JSON.stringify(todos) !== JSON.stringify(pledge.todos);

    const handleSave = useCallback(async () => {
      if (!hasChanges) return;
      Keyboard.dismiss();
      setIsSaving(true);
      try {
        await onSave(name.trim(), todos);
        // Close sheet after successful save
        if (ref && 'current' in ref && ref.current) {
          ref.current.close();
        }
      } finally {
        setIsSaving(false);
      }
    }, [hasChanges, name, todos, onSave, ref]);

    const dailyTasks = uniqueDailyTasks();

    return (
      <BaseSheet
        ref={ref}
        title={t('Edit Pledge')}
        enableDynamicSizing={false}
        snapPoints={['85%']}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.scrollView}
        >
          {/* Pledge Name */}
          <View style={styles.section}>
            <FloatingLabelInput
              label={t('Goal Name')}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Daily Tasks */}
          {dailyTasks.length > 0 && (
            <View style={styles.section}>
              <Title3 style={{ marginBottom: 12 }}>
                {t("Today's Tasks")}
              </Title3>
              {dailyTasks.map((taskText, index) => (
                <EditableTaskRow
                  key={`daily-${index}`}
                  text={taskText}
                  onRename={(newText) => renameDailyTask(taskText, newText)}
                  theme={theme}
                />
              ))}
            </View>
          )}

          {/* Goals */}
          <View style={styles.section}>
            <Title3 style={{ marginBottom: 12 }}>{t('Goals')}</Title3>
            {todos.goals.map((goalText, index) => (
              <EditableTaskRow
                key={`goal-${index}`}
                text={goalText}
                onRename={(newText) => renameGoal(index, newText)}
                theme={theme}
              />
            ))}

            {/* Add new goal */}
            <Row gap={8} style={{ marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <FloatingLabelInput
                  label={t('Add a task')}
                  value={newGoal}
                  onChangeText={setNewGoal}
                  onSubmitEditing={
                    newGoal.trim().length > 0 ? addGoal : Keyboard.dismiss
                  }
                  returnKeyType="done"
                />
              </View>
              {newGoal.trim().length > 0 && (
                <Pressable
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    addGoal();
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
          </View>

          {/* What can't be edited */}
          <View style={styles.section}>
            <BodySmall style={{ color: theme.colors.textSecondary }}>
              {t(
                'Pledge amount and deadline cannot be changed once created.',
              )}
            </BodySmall>
          </View>
        </ScrollView>

        {/* Save button */}
        <View style={styles.footer}>
          <PrimaryButton
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
            loading={isSaving}
          >
            {t('Save')}
          </PrimaryButton>
        </View>
      </BaseSheet>
    );
  },
);

EditPledgeSheet.displayName = 'EditPledgeSheet';

/** Inline-editable task row */
const EditableTaskRow = ({
  text,
  onRename,
  theme,
}: {
  text: string;
  onRename: (newText: string) => void;
  theme: AppTheme;
}) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  const handleBlur = useCallback(() => {
    setEditing(false);
    const trimmed = editText.trim();
    if (trimmed && trimmed !== text) {
      onRename(trimmed);
    } else {
      setEditText(text);
    }
  }, [editText, text, onRename]);

  // Sync when parent changes the text (e.g. after save)
  useEffect(() => {
    setEditText(text);
  }, [text]);

  return (
    <Pressable
      onPress={() => setEditing(true)}
      style={[
        styles.taskRow,
        {
          backgroundColor: theme.colors.cardBackground,
          borderColor: editing ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Ionicons
        name="create-outline"
        size={18}
        color={theme.colors.textSecondary}
      />
      {editing ? (
        <TextInput
          autoFocus
          value={editText}
          onChangeText={setEditText}
          onBlur={handleBlur}
          onSubmitEditing={handleBlur}
          returnKeyType="done"
          style={[styles.taskInput, { color: theme.colors.text }]}
          selectionColor={theme.colors.primary}
        />
      ) : (
        <Body style={{ flex: 1 }}>{text}</Body>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  taskInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    margin: 0,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  footer: {
    paddingTop: 12,
  },
});
