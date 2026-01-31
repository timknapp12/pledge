import { useState, useCallback } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'styled-components/native';
import styled from 'styled-components/native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useCreatePledgeInDb, parseUsdcToLamports, Todo } from '@/hooks/useSupabase';
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
} from '@/components';

type Timeframe = '1day' | '1week' | '1month' | 'custom';

const HeaderRow = styled(Row)`
  padding: 60px 20px 20px 20px;
`;

const BackButton = styled.Pressable`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${({ theme }) => theme.colors.cardBackground};
  align-items: center;
  justify-content: center;
`;

const ContentArea = styled.View`
  padding: 0 20px 40px 20px;
`;

const Section = styled.View`
  margin: 16px 0 24px 0;
`;

const TodoRow = styled(Row)`
  padding: 12px;
  background-color: ${({ theme }) => theme.colors.cardBackground};
  border-radius: 8px;
  margin-bottom: 8px;
`;

const SummaryRow = styled(Row)<{ $last?: boolean }>`
  justify-content: space-between;
  padding: 8px 0;
  border-bottom-width: ${({ $last }) => ($last ? 0 : 1)}px;
  border-bottom-color: ${({ theme }) => theme.colors.border};
`;

const BottomBar = styled(CenteredColumn)`
  padding: 20px;
  width: 100%;
`;

const AddButton = styled.Pressable`
  padding: 12px;
  background-color: ${({ theme }) => theme.colors.primary};
  border-radius: 8px;
  align-self: flex-end;
`;

const TimeframeButton = styled.Pressable<{ $selected: boolean }>`
  flex: 1;
  padding: 12px 8px;
  border-radius: 8px;
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.primary : theme.colors.cardBackground};
  align-items: center;
  border-width: 1px;
  border-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.primary : theme.colors.border};
`;

const TimeframeText = styled(BodySmall)<{ $selected: boolean }>`
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.iconOnPrimary : theme.colors.text};
  font-weight: ${({ $selected }) => ($selected ? '600' : '400')};
`;

export const CreatePledgeScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { walletAddress } = useAuth();

  const { createPledge, error: programError } = useProgram();
  const createPledgeInDb = useCreatePledgeInDb();

  const [name, setName] = useState('');
  const [timeframe, setTimeframe] = useState<Timeframe>('1week');
  const [todos, setTodos] = useState<string[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddTodo = useCallback(() => {
    if (newTodo.trim()) {
      setTodos((prev) => [...prev, newTodo.trim()]);
      setNewTodo('');
    }
  }, [newTodo]);

  const handleRemoveTodo = useCallback((index: number) => {
    setTodos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const calculateDeadline = (): Date => {
    const now = new Date();
    switch (timeframe) {
      case '1day':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case '1week':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case '1month':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  };

  const getDurationText = (): string => {
    switch (timeframe) {
      case '1day':
        return `1 ${t('day')}`;
      case '1week':
        return `1 ${t('week')}`;
      case '1month':
        return `30 ${t('days')}`;
      default:
        return `1 ${t('week')}`;
    }
  };

  const isValid = name.trim() && todos.length > 0 && parseFloat(stakeAmount) > 0;

  const handleCreate = async () => {
    if (!isValid || !walletAddress) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const startDate = new Date();
      const deadline = calculateDeadline();
      const stakeAmountNumber = parseFloat(stakeAmount);

      // 1. Create on-chain pledge
      const result = await createPledge(stakeAmountNumber, deadline);

      if (!result?.pledgeAddress) {
        throw new Error('Failed to create pledge on-chain');
      }

      // 2. Create in database
      const todoItems: Todo[] = todos.map((text) => ({ text, days: null }));

      await createPledgeInDb.mutateAsync({
        on_chain_address: result.pledgeAddress.toString(),
        name: name.trim(),
        timeframe_type: timeframe,
        start_date: startDate.toISOString(),
        end_date: deadline.toISOString(),
        deadline: deadline.toISOString(),
        stake_amount: parseUsdcToLamports(stakeAmount),
        todos: todoItems,
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
      <HeaderRow $gap={16}>
        <BackButton onPress={() => router.back()}>
          <Ionicons name='arrow-back' size={24} color={theme.colors.text} />
        </BackButton>
        <Title1>{t('New Pledge')}</Title1>
      </HeaderRow>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <ContentArea>
            {/* Goal Name */}
            <Section>
              <FloatingLabelInput
                label={t('Goal Name')}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </Section>

            {/* Timeframe */}
            <Section>
              <Title3 style={{ marginBottom: 12 }}>{t('Timeframe')}</Title3>
              <Row $gap={8}>
                <TimeframeButton
                  $selected={timeframe === '1day'}
                  onPress={() => setTimeframe('1day')}
                >
                  <TimeframeText $selected={timeframe === '1day'}>
                    {t('1 Day')}
                  </TimeframeText>
                </TimeframeButton>
                <TimeframeButton
                  $selected={timeframe === '1week'}
                  onPress={() => setTimeframe('1week')}
                >
                  <TimeframeText $selected={timeframe === '1week'}>
                    {t('1 Week')}
                  </TimeframeText>
                </TimeframeButton>
                <TimeframeButton
                  $selected={timeframe === '1month'}
                  onPress={() => setTimeframe('1month')}
                >
                  <TimeframeText $selected={timeframe === '1month'}>
                    {t('1 Month')}
                  </TimeframeText>
                </TimeframeButton>
              </Row>
            </Section>

            {/* To-Do Items */}
            <Section>
              <Title3 style={{ marginBottom: 12 }}>{t('To-Do Items')}</Title3>

              {todos.map((todo, index) => (
                <TodoRow key={index} $gap={12}>
                  <Ionicons
                    name='checkbox-outline'
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                  <Body style={{ flex: 1 }}>{todo}</Body>
                  <Pressable onPress={() => handleRemoveTodo(index)} style={{ padding: 4 }}>
                    <Ionicons name='close-circle' size={20} color={theme.colors.textSecondary} />
                  </Pressable>
                </TodoRow>
              ))}

              <Row $gap={8}>
                <View style={{ flex: 1 }}>
                  <FloatingLabelInput
                    label={t('Add a task')}
                    value={newTodo}
                    onChangeText={setNewTodo}
                    onSubmitEditing={handleAddTodo}
                    returnKeyType='done'
                  />
                </View>
                <AddButton onPress={handleAddTodo}>
                  <Ionicons name='add' size={24} color={theme.colors.iconOnPrimary} />
                </AddButton>
              </Row>
            </Section>

            {/* Stake Amount */}
            <Section>
              <Title3 style={{ marginBottom: 12 }}>{t('Stake Amount')}</Title3>
              <Row $gap={12}>
                <View style={{ flex: 1 }}>
                  <FloatingLabelInput
                    label={t('USDC')}
                    value={stakeAmount}
                    onChangeText={setStakeAmount}
                    keyboardType='decimal-pad'
                  />
                </View>
              </Row>
            </Section>

            {/* Summary */}
            {isValid && (
              <Section>
                <Title3 style={{ marginBottom: 8 }}>{t('Summary')}</Title3>
                <Card style={{ marginTop: 8 }}>
                  <SummaryRow>
                    <BodySecondary>{t('Duration')}</BodySecondary>
                    <Body>{getDurationText()}</Body>
                  </SummaryRow>
                  <SummaryRow>
                    <BodySecondary>{t('Total tasks')}</BodySecondary>
                    <Body>{todos.length}</Body>
                  </SummaryRow>
                  <SummaryRow $last>
                    <BodySecondary>{t('Stake Amount')}</BodySecondary>
                    <Body>${stakeAmount} {t('USDC')}</Body>
                  </SummaryRow>
                </Card>
              </Section>
            )}

            {(error || programError) && (
              <ErrorText style={{ marginBottom: 16, textAlign: 'center' }}>
                {error || programError}
              </ErrorText>
            )}
          </ContentArea>
        </ScrollView>

        <BottomBar $gap={12}>
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
        </BottomBar>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};
