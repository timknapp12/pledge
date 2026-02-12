import { useState, useCallback, useRef, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import BottomSheet from '@gorhom/bottom-sheet';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCreatePledgeInDb,
  parseUsdcToLamports,
  type Todo,
  type ReminderSettings,
} from '@/hooks/useSupabase';
import { useProgram } from '@/hooks/useProgram';
import {
  Title1,
  Title3,
  Body,
  BodySecondary,
  BodySmall,
  ErrorText,
  ScreenContainer,
  Row,
  Card,
  PrimaryButton,
  SecondaryButton,
  FloatingLabelInput,
  CenteredColumn,
  Column,
  DateTimePickerSheet,
  DurationPickerSheet,
  RemindersSheet,
  DailyTodosSheet,
  type DurationPreset,
} from '@/components';

//TODO- fix add button

const MAX_DAILY_TRACKING_DAYS = 7;

export const CreatePledgeScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();
  const { walletAddress } = useAuth();

  const { createPledge, error: programError } = useProgram();
  const createPledgeInDb = useCreatePledgeInDb();

  // Form state
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  });
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('1week');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [reminderSettings, setReminderSettings] =
    useState<ReminderSettings | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bottom sheet refs
  const startDateSheetRef = useRef<BottomSheet>(null);
  const durationSheetRef = useRef<BottomSheet>(null);
  const remindersSheetRef = useRef<BottomSheet>(null);
  const dailyTodosSheetRef = useRef<BottomSheet>(null);

  // Calculate duration in days
  const durationDays = useMemo(() => {
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);

  // Should show daily tracking option?
  const showDailyTracking =
    durationDays > 1 && durationDays <= MAX_DAILY_TRACKING_DAYS;

  // Check if any todos have day-specific assignments
  const hasDailyAssignments = useMemo(() => {
    return todos.some((todo) => todo.days !== null);
  }, [todos]);

  const handleAddTodo = useCallback(() => {
    if (newTodo.trim()) {
      setTodos((prev) => [...prev, { text: newTodo.trim(), days: null }]);
      setNewTodo('');
    }
  }, [newTodo]);

  const handleRemoveTodo = useCallback((index: number) => {
    setTodos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStartDateConfirm = useCallback(
    (date: Date) => {
      setStartDate(date);
      // Adjust end date if it's before the new start date
      if (endDate <= date) {
        const newEnd = new Date(date);
        newEnd.setDate(newEnd.getDate() + 7);
        setEndDate(newEnd);
        setDurationPreset('1week');
      }
    },
    [endDate]
  );

  const handleDurationConfirm = useCallback(
    (end: Date, preset: DurationPreset) => {
      setEndDate(end);
      setDurationPreset(preset);
      // Reset daily assignments if duration changes to outside tracking range
      const newDurationDays = Math.ceil(
        (end.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (newDurationDays <= 1 || newDurationDays > MAX_DAILY_TRACKING_DAYS) {
        setTodos((prev) => prev.map((todo) => ({ ...todo, days: null })));
      }
    },
    [startDate]
  );

  const handleRemindersConfirm = useCallback(
    (settings: ReminderSettings | null) => {
      setReminderSettings(settings);
    },
    []
  );

  const handleDailyTodosConfirm = useCallback((updatedTodos: Todo[]) => {
    setTodos(updatedTodos);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getDurationLabel = (): string => {
    if (durationDays === 1) return `1 ${t('day')}`;
    if (durationDays === 7) return `1 ${t('week')}`;
    if (durationDays === 30) return `1 ${t('Month')}`;
    return `${durationDays} ${t('days')}`;
  };

  const getRemindersLabel = (): string => {
    if (!reminderSettings || reminderSettings.reminders.length === 0) {
      return t('None');
    }
    const dailyReminder = reminderSettings.reminders.find(
      (r) => r.type === 'daily'
    );
    if (dailyReminder && dailyReminder.time) {
      return `${t('Daily at')} ${dailyReminder.time}`;
    }
    return `${reminderSettings.reminders.length} ${t(
      'Reminders'
    ).toLowerCase()}`;
  };

  const getDailyTrackingLabel = (): string => {
    if (hasDailyAssignments) {
      return t('Custom schedule');
    }
    return t('Every day');
  };

  const isValid =
    name.trim() && todos.length > 0 && parseFloat(stakeAmount) > 0;

  const handleCreate = async () => {
    if (!isValid || !walletAddress) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const stakeAmountNumber = parseFloat(stakeAmount);

      // 1. Create on-chain pledge
      const result = await createPledge(stakeAmountNumber, endDate);

      if (!result?.pledgeAddress) {
        throw new Error('Failed to create pledge on-chain');
      }

      // 2. Create in database
      await createPledgeInDb.mutateAsync({
        on_chain_address: result.pledgeAddress.toString(),
        name: name.trim(),
        timeframe_type: durationPreset,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        deadline: endDate.toISOString(),
        stake_amount: parseUsdcToLamports(stakeAmount),
        todos: todos,
        reminder_settings: reminderSettings,
      });

      // 3. Navigate back
      router.back();
    } catch (err: any) {
      console.error('Create pledge error:', err);
      setError(err.message || 'Failed to create pledge');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Column
        style={{
          justifyContent: 'space-between',
          flex: 1,
          width: '100%',
          marginBottom: 12,
        }}
      >
        <CenteredColumn style={{ flex: 1 }} gap={24}>
          {/* Header */}
          <Row gap={16} width='100%' justify='flex-start'>
            <Pressable
              onPress={() => router.back()}
              style={[
                localStyles.backButton,
                { backgroundColor: theme.colors.cardBackground },
              ]}
            >
              <Ionicons name='arrow-back' size={24} color={theme.colors.text} />
            </Pressable>
            <Title1>{t('New Pledge')}</Title1>
          </Row>

          <KeyboardAvoidingView
            style={{ flex: 1, width: '100%' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <CenteredColumn flex={1}>
                {/* Goal Name */}
                <View style={localStyles.section}>
                  <FloatingLabelInput
                    label={t('Goal Name')}
                    value={name}
                    onChangeText={setName}
                    autoFocus
                  />
                </View>

                {/* Schedule Section */}
                <View style={localStyles.section}>
                  <View
                    style={[
                      localStyles.scheduleCard,
                      { backgroundColor: theme.colors.cardBackground },
                    ]}
                  >
                    {/* Start Date */}
                    <Pressable
                      style={localStyles.scheduleRow}
                      onPress={() => startDateSheetRef.current?.expand()}
                    >
                      <BodySecondary>{t('Starts')}</BodySecondary>
                      <Row gap={8}>
                        <View
                          style={[
                            localStyles.dateChip,
                            { backgroundColor: theme.colors.background },
                          ]}
                        >
                          <Body>{formatDate(startDate)}</Body>
                        </View>
                        <View
                          style={[
                            localStyles.dateChip,
                            { backgroundColor: theme.colors.background },
                          ]}
                        >
                          <Body>{formatTime(startDate)}</Body>
                        </View>
                        <Ionicons
                          name='chevron-forward'
                          size={16}
                          color={theme.colors.textSecondary}
                        />
                      </Row>
                    </Pressable>

                    <View
                      style={[
                        localStyles.scheduleDivider,
                        { backgroundColor: theme.colors.border },
                      ]}
                    />

                    {/* End Date / Duration */}
                    <Pressable
                      style={localStyles.scheduleRow}
                      onPress={() => durationSheetRef.current?.expand()}
                    >
                      <BodySecondary>{t('Ends')}</BodySecondary>
                      <Row gap={8}>
                        <View
                          style={[
                            localStyles.durationBadge,
                            { backgroundColor: theme.colors.primaryAlpha10 },
                          ]}
                        >
                          <BodySmall style={{ color: theme.colors.primary }}>
                            {getDurationLabel()}
                          </BodySmall>
                        </View>
                        <View
                          style={[
                            localStyles.dateChip,
                            { backgroundColor: theme.colors.background },
                          ]}
                        >
                          <Body>{formatDate(endDate)}</Body>
                        </View>
                        <Ionicons
                          name='chevron-forward'
                          size={16}
                          color={theme.colors.textSecondary}
                        />
                      </Row>
                    </Pressable>

                    {/* Daily Tracking - only for 2-7 day pledges */}
                    {showDailyTracking && todos.length > 0 && (
                      <>
                        <View
                          style={[
                            localStyles.scheduleDivider,
                            { backgroundColor: theme.colors.border },
                          ]}
                        />
                        <Pressable
                          style={localStyles.scheduleRow}
                          onPress={() => dailyTodosSheetRef.current?.expand()}
                        >
                          <Column>
                            <Body>{t('Track Daily')}</Body>
                            <BodySmall
                              style={{ color: theme.colors.textSecondary }}
                            >
                              {t('Track progress each day')}
                            </BodySmall>
                          </Column>
                          <Row gap={8}>
                            <BodySecondary>
                              {getDailyTrackingLabel()}
                            </BodySecondary>
                            <Ionicons
                              name='chevron-forward'
                              size={16}
                              color={theme.colors.textSecondary}
                            />
                          </Row>
                        </Pressable>
                      </>
                    )}

                    <View
                      style={[
                        localStyles.scheduleDivider,
                        { backgroundColor: theme.colors.border },
                      ]}
                    />

                    {/* Reminders */}
                    <Pressable
                      style={localStyles.scheduleRow}
                      onPress={() => remindersSheetRef.current?.expand()}
                    >
                      <Body>{t('Reminders')}</Body>
                      <Row gap={8}>
                        <BodySecondary>{getRemindersLabel()}</BodySecondary>
                        <Ionicons
                          name='chevron-forward'
                          size={16}
                          color={theme.colors.textSecondary}
                        />
                      </Row>
                    </Pressable>
                  </View>
                </View>

                {/* To-Do Items */}
                <View style={localStyles.section}>
                  <Title3 style={{ marginBottom: 12 }}>
                    {t('To-Do Items')}
                  </Title3>

                  {todos.map((todo, index) => (
                    <Row
                      key={index}
                      gap={12}
                      style={[
                        localStyles.todoRow,
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
                          <BodySmall
                            style={{ color: theme.colors.textSecondary }}
                          >
                            {todo.days
                              .map((d) =>
                                t(
                                  [
                                    'Sun',
                                    'Mon',
                                    'Tue',
                                    'Wed',
                                    'Thu',
                                    'Fri',
                                    'Sat',
                                  ][d]
                                )
                              )
                              .join(', ')}
                          </BodySmall>
                        )}
                      </Column>
                      <Pressable
                        onPress={() => handleRemoveTodo(index)}
                        style={{ padding: 4 }}
                      >
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
                        onChangeText={setNewTodo}
                        onSubmitEditing={handleAddTodo}
                        returnKeyType='done'
                      />
                    </View>
                    <Pressable
                      onPress={handleAddTodo}
                      style={[
                        localStyles.addButton,
                        { backgroundColor: theme.colors.primary },
                      ]}
                    >
                      <Ionicons
                        name='add'
                        size={24}
                        color={theme.colors.iconOnPrimary}
                      />
                    </Pressable>
                  </Row>
                </View>

                {/* Stake Amount */}
                <View style={localStyles.section}>
                  <Title3 style={{ marginBottom: 12 }}>
                    {t('Stake Amount')}
                  </Title3>
                  <Row gap={12}>
                    <View style={{ flex: 1 }}>
                      <FloatingLabelInput
                        label={t('USDC')}
                        value={stakeAmount}
                        onChangeText={setStakeAmount}
                        keyboardType='decimal-pad'
                      />
                    </View>
                  </Row>
                </View>

                {/* Summary */}
                {isValid && (
                  <View style={localStyles.section}>
                    <Title3 style={{ marginBottom: 8 }}>{t('Summary')}</Title3>
                    <Card style={{ marginTop: 8 }}>
                      <View
                        style={[
                          localStyles.summaryRow,
                          { borderBottomColor: theme.colors.border },
                        ]}
                      >
                        <BodySecondary>{t('Duration')}</BodySecondary>
                        <Body>{getDurationLabel()}</Body>
                      </View>
                      <View
                        style={[
                          localStyles.summaryRow,
                          { borderBottomColor: theme.colors.border },
                        ]}
                      >
                        <BodySecondary>{t('Total tasks')}</BodySecondary>
                        <Body>{todos.length}</Body>
                      </View>
                      <View
                        style={[
                          localStyles.summaryRow,
                          { borderBottomColor: theme.colors.border },
                        ]}
                      >
                        <BodySecondary>{t('Reminders')}</BodySecondary>
                        <Body>{getRemindersLabel()}</Body>
                      </View>
                      <View
                        style={[
                          localStyles.summaryRow,
                          localStyles.summaryRowLast,
                        ]}
                      >
                        <BodySecondary>{t('Stake Amount')}</BodySecondary>
                        <Body>
                          ${stakeAmount} {t('USDC')}
                        </Body>
                      </View>
                    </Card>
                  </View>
                )}

                {(error || programError) && (
                  <ErrorText style={{ marginBottom: 16, textAlign: 'center' }}>
                    {error || programError}
                  </ErrorText>
                )}
              </CenteredColumn>
            </ScrollView>

            <CenteredColumn gap={12} width='100%'>
              <SecondaryButton onPress={() => router.back()}>
                {t('Cancel')}
              </SecondaryButton>
              <PrimaryButton
                onPress={handleCreate}
                disabled={!isValid}
                loading={isSubmitting}
              >
                {t('Create')}
              </PrimaryButton>
            </CenteredColumn>
          </KeyboardAvoidingView>
        </CenteredColumn>
      </Column>

      {/* Bottom Sheets */}
      <DateTimePickerSheet
        ref={startDateSheetRef}
        title={t('Start Date')}
        value={startDate}
        minimumDate={new Date()}
        onConfirm={handleStartDateConfirm}
      />

      <DurationPickerSheet
        ref={durationSheetRef}
        startDate={startDate}
        value={endDate}
        selectedPreset={durationPreset}
        onConfirm={handleDurationConfirm}
      />

      <RemindersSheet
        ref={remindersSheetRef}
        value={reminderSettings}
        onConfirm={handleRemindersConfirm}
      />

      {showDailyTracking && (
        <DailyTodosSheet
          ref={dailyTodosSheetRef}
          todos={todos}
          startDate={startDate}
          endDate={endDate}
          onConfirm={handleDailyTodosConfirm}
        />
      )}
    </ScreenContainer>
  );
};

const localStyles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: 16,
    marginBottom: 24,
    width: '100%',
  },
  scheduleCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  scheduleDivider: {
    height: 1,
    marginLeft: 16,
  },
  dateChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  durationBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  todoRow: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  addButton: {
    padding: 12,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
});
