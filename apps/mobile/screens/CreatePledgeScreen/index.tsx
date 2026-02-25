import { useRef, useCallback } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
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
  Body,
  BodySecondary,
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
  StakeAmountSheet,
} from '@/components';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';
import { useCreatePledgeForm } from './useCreatePledgeForm';
import { ScheduleCard } from './ScheduleCard';
import { TodoSection } from './TodoSection';
import { PledgeSummary } from './PledgeSummary';
import { styles } from './styles';

export const CreatePledgeScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();

  const form = useCreatePledgeForm();
  const { balance: usdcBalance, isLoading: balanceLoading } = useUsdcBalance();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputPositions = useRef<Record<string, number>>({});

  const trackLayout = useCallback((key: string, e: LayoutChangeEvent) => {
    inputPositions.current[key] = e.nativeEvent.layout.y;
  }, []);

  const scrollToSection = useCallback((key: string) => {
    const y = inputPositions.current[key];
    if (y === undefined) return;
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, y - 100),
        animated: true,
      });
    }, 300);
  }, []);

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
            behavior='padding'
            keyboardVerticalOffset={100}
          >
            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps='handled'
            >
              <CenteredColumn flex={1}>
                {/* 1. Schedule (start date, duration, reminders) */}
                <ScheduleCard
                  startDate={form.startDate}
                  endDate={form.endDate}
                  formatDate={form.formatDate}
                  formatTime={form.formatTime}
                  getDurationLabel={form.getDurationLabel}
                  getRemindersLabel={form.getRemindersLabel}
                  onStartDatePress={() => {
                    Keyboard.dismiss();
                    form.startDateSheetRef.current?.expand();
                  }}
                  onDurationPress={() => {
                    Keyboard.dismiss();
                    form.durationSheetRef.current?.expand();
                  }}
                  onRemindersPress={() => {
                    Keyboard.dismiss();
                    form.remindersSheetRef.current?.expand();
                  }}
                />

                {/* 2. Action Items (tasks with inline schedule presets) */}
                <View
                  style={{ width: '100%' }}
                  onLayout={(e) => trackLayout('todo', e)}
                >
                  <TodoSection
                    taskDefinitions={form.taskDefinitions}
                    showDailyOptions={form.showDailyOptions}
                    onAddTask={form.addTaskDefinition}
                    onRemoveTask={form.removeTaskDefinition}
                    onInputFocus={() => scrollToSection('todo')}
                  />
                </View>

                {/* 3. Goal Name (optional) */}
                <View style={styles.section}>
                  <FloatingLabelInput
                    label={t('Goal Name (optional)')}
                    value={form.name}
                    onChangeText={form.setName}
                  />
                </View>

                {/* 4. Stake Amount */}
                <View style={styles.section}>
                  <Title3 style={{ marginBottom: 12 }}>
                    {t('Stake Amount')}
                  </Title3>
                  <Pressable
                    style={[
                      styles.scheduleCard,
                      { backgroundColor: theme.colors.cardBackground },
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      form.stakeAmountSheetRef.current?.expand();
                    }}
                  >
                    <View style={styles.scheduleRow}>
                      <BodySecondary>{t('USDC')}</BodySecondary>
                      <Row gap={8}>
                        <View
                          style={[
                            styles.dateChip,
                            { backgroundColor: theme.colors.background },
                          ]}
                        >
                          <Body>
                            {form.stakeAmount
                              ? `$${form.stakeAmount}`
                              : t('Select amount')}
                          </Body>
                        </View>
                        <Ionicons
                          name='chevron-forward'
                          size={16}
                          color={theme.colors.textSecondary}
                        />
                      </Row>
                    </View>
                  </Pressable>
                </View>

                {/* 5. Summary */}
                {form.isValid && (
                  <PledgeSummary
                    durationLabel={form.getDurationLabel()}
                    taskCount={form.taskDefinitions.length}
                    remindersLabel={form.getRemindersLabel()}
                    stakeAmount={form.stakeAmount}
                    goalName={form.name.trim() || undefined}
                  />
                )}

                {(form.error || form.programError) && (
                  <ErrorText style={{ marginBottom: 16, textAlign: 'center' }}>
                    {form.error || form.programError}
                  </ErrorText>
                )}
              </CenteredColumn>
            </ScrollView>
          </KeyboardAvoidingView>

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

      <StakeAmountSheet
        ref={form.stakeAmountSheetRef}
        value={form.stakeAmount}
        walletBalance={usdcBalance}
        balanceLoading={balanceLoading}
        onConfirm={form.setStakeAmount}
      />
    </ScreenContainer>
  );
};
