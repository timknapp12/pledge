import { useState } from 'react';
import { Pressable, View } from 'react-native';
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
import { styles } from './styles';
import type { Todo } from '@/hooks/useSupabase';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type TodoSectionProps = {
  todos: Todo[];
  newTodo: string;
  showDailyTracking: boolean;
  onNewTodoChange: (text: string) => void;
  onAddTodo: () => void;
  onRemoveTodo: (index: number) => void;
  onInputFocus?: () => void;
};

export const TodoSection = ({
  todos,
  newTodo,
  showDailyTracking,
  onNewTodoChange,
  onAddTodo,
  onRemoveTodo,
  onInputFocus,
}: TodoSectionProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const [showEmptyError, setShowEmptyError] = useState(false);

  return (
    <View style={styles.section}>
      <Title3 style={{ marginBottom: 12 }}>{t('Action Items')}</Title3>

      {todos.map((todo, index) => (
        <Row
          key={index}
          gap={12}
          style={[
            styles.todoRow,
            { backgroundColor: theme.colors.cardBackground },
          ]}
        >
          <Ionicons
            name='checkbox-outline'
            size={20}
            color={theme.colors.textSecondary}
          />
          <Column flex={1}>
            <Body>{todo.text}</Body>
            {showDailyTracking && todo.days && (
              <BodySmall style={{ color: theme.colors.textSecondary }}>
                {todo.days.map((d) => t(DAY_NAMES[d])).join(', ')}
              </BodySmall>
            )}
          </Column>
          <Pressable onPress={() => onRemoveTodo(index)} style={{ padding: 4 }}>
            <Ionicons
              name='close-circle'
              size={20}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        </Row>
      ))}

      <Row gap={8}>
        <View style={{ flex: 1 }}>
          <FloatingLabelInput
            label={t('Add a task')}
            value={newTodo}
            onChangeText={(text) => {
              if (showEmptyError) setShowEmptyError(false);
              onNewTodoChange(text);
            }}
            onSubmitEditing={onAddTodo}
            returnKeyType='done'
            onFocus={onInputFocus}
          />
        </View>
        <Pressable
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            if (!newTodo.trim()) {
              setShowEmptyError(true);
              return;
            }
            onAddTodo();
          }}
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
        >
          <Ionicons name='add' size={24} color={theme.colors.iconOnPrimary} />
        </Pressable>
      </Row>
      {showEmptyError && (
        <ErrorText style={{ marginTop: 4 }}>
          {t('Enter a task before adding')}
        </ErrorText>
      )}
    </View>
  );
};
