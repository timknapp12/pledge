import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Title1,
  Title3,
  ErrorText,
  ScreenContainer,
  Row,
  PrimaryButton,
  SecondaryButton,
  FloatingLabelInput,
  CenteredColumn,
  Column,
  DateTimePickerSheet,
  DurationPickerSheet,
  RemindersSheet,
  DailyTodosSheet,
} from '@/components';
import { useCreatePledgeForm } from './useCreatePledgeForm';
import { ScheduleCard } from './ScheduleCard';
import { TodoSection } from './TodoSection';
import { PledgeSummary } from './PledgeSummary';
import { styles } from './styles';

// TODO - add keyboard avoiding view for inputs

export const CreatePledgeScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();

  const form = useCreatePledgeForm();

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
                styles.backButton,
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
                <View style={styles.section}>
                  <FloatingLabelInput
                    label={t('Goal Name')}
                    value={form.name}
                    onChangeText={form.setName}
                    autoFocus
                  />
                </View>

                <ScheduleCard
                  startDate={form.startDate}
                  endDate={form.endDate}
                  todos={form.todos}
                  showDailyTracking={form.showDailyTracking}
                  formatDate={form.formatDate}
                  formatTime={form.formatTime}
                  getDurationLabel={form.getDurationLabel}
                  getRemindersLabel={form.getRemindersLabel}
                  getDailyTrackingLabel={form.getDailyTrackingLabel}
                  onStartDatePress={() =>
                    form.startDateSheetRef.current?.expand()
                  }
                  onDurationPress={() =>
                    form.durationSheetRef.current?.expand()
                  }
                  onDailyTrackingPress={() =>
                    form.dailyTodosSheetRef.current?.expand()
                  }
                  onRemindersPress={() =>
                    form.remindersSheetRef.current?.expand()
                  }
                />

                <TodoSection
                  todos={form.todos}
                  newTodo={form.newTodo}
                  showDailyTracking={form.showDailyTracking}
                  onNewTodoChange={form.setNewTodo}
                  onAddTodo={form.handleAddTodo}
                  onRemoveTodo={form.handleRemoveTodo}
                />

                {/* Stake Amount */}
                <View style={styles.section}>
                  <Title3 style={{ marginBottom: 12 }}>
                    {t('Stake Amount')}
                  </Title3>
                  <Row gap={12}>
                    <View style={{ flex: 1 }}>
                      <FloatingLabelInput
                        label={t('USDC')}
                        value={form.stakeAmount}
                        onChangeText={form.setStakeAmount}
                        keyboardType='decimal-pad'
                      />
                    </View>
                  </Row>
                </View>

                {form.isValid && (
                  <PledgeSummary
                    durationLabel={form.getDurationLabel()}
                    todoCount={form.todos.length}
                    remindersLabel={form.getRemindersLabel()}
                    stakeAmount={form.stakeAmount}
                  />
                )}

                {(form.error || form.programError) && (
                  <ErrorText style={{ marginBottom: 16, textAlign: 'center' }}>
                    {form.error || form.programError}
                  </ErrorText>
                )}
              </CenteredColumn>
            </ScrollView>

            <CenteredColumn gap={12} width='100%'>
              <SecondaryButton onPress={() => router.back()}>
                {t('Cancel')}
              </SecondaryButton>
              <PrimaryButton
                onPress={form.handleCreate}
                disabled={!form.isValid}
                loading={form.isSubmitting}
              >
                {t('Create')}
              </PrimaryButton>
            </CenteredColumn>
          </KeyboardAvoidingView>
        </CenteredColumn>
      </Column>

      {/* Bottom Sheets */}
      <DateTimePickerSheet
        ref={form.startDateSheetRef}
        title={t('Start Date')}
        value={form.startDate}
        minimumDate={new Date()}
        onConfirm={form.handleStartDateConfirm}
      />

      <DurationPickerSheet
        ref={form.durationSheetRef}
        startDate={form.startDate}
        value={form.endDate}
        selectedPreset={form.durationPreset}
        onConfirm={form.handleDurationConfirm}
      />

      <RemindersSheet
        ref={form.remindersSheetRef}
        value={form.reminderSettings}
        onConfirm={form.handleRemindersConfirm}
      />

      {form.showDailyTracking && (
        <DailyTodosSheet
          ref={form.dailyTodosSheetRef}
          todos={form.todos}
          startDate={form.startDate}
          endDate={form.endDate}
          onConfirm={form.handleDailyTodosConfirm}
        />
      )}
    </ScreenContainer>
  );
};
