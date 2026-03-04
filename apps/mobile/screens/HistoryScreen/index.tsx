import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  View,
  StyleSheet,
} from 'react-native';
import {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { usePledges, formatUsdcAmount } from '@/hooks/useSupabase';
import { getAnimatedDisplayLamports } from '@/lib/animatedAmount';
import {
  Title1,
  Title2,
  Title3,
  BodySecondary,
  BodySmallSecondary,
  ScreenContainer,
  CenteredColumn,
  Card,
  TrackedScrollView,
  Column,
  Row,
  Gap,
  ErrorState,
} from '@/components';
import { ProgressBar } from '@/components/common/ProgressBar';
import { AnimatedCircularProgress } from '@/components/common/AnimatedCircularProgress';
import { PastPledgeItem } from './PastPledgeItem';
import { EmptyState } from './EmptyState';

export const HistoryScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const {
    data: allPledges,
    isLoading: pledgesLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = usePledges();

  // Filter for past pledges (completed or forfeited)
  const pastPledges =
    allPledges?.filter(
      (p) => p.status === 'Completed' || p.status === 'Forfeited',
    ) || [];

  // Calculate stats
  const totalPledged =
    allPledges?.reduce((sum, p) => sum + p.stake_amount, 0) || 0;
  const completedPledges =
    allPledges?.filter((p) => p.status === 'Completed') || [];
  const settledPledges = allPledges?.filter((p) => p.status !== 'Active') || [];
  const successRate =
    settledPledges.length > 0
      ? Math.round((completedPledges.length / settledPledges.length) * 100)
      : 0;

  const [focusCount, setFocusCount] = useState(0);
  const [displayPledged, setDisplayPledged] = useState(0);
  const pledgedProgress = useSharedValue(0);
  const totalPledgedRef = useSharedValue(totalPledged);

  useFocusEffect(
    useCallback(() => {
      setFocusCount((c) => c + 1);
    }, []),
  );

  useEffect(() => {
    totalPledgedRef.value = totalPledged;
  }, [totalPledged, totalPledgedRef]);

  useEffect(() => {
    setDisplayPledged(0);
    pledgedProgress.value = 0;
    pledgedProgress.value = withTiming(100, { duration: 1000 });
  }, [totalPledged, focusCount, pledgedProgress]);

  const updateDisplayPledged = useCallback(
    (progress: number, total: number) => {
      setDisplayPledged(getAnimatedDisplayLamports(progress, total));
    },
    [],
  );

  useAnimatedReaction(
    () => pledgedProgress.value,
    (progress) => {
      scheduleOnRN(updateDisplayPledged, progress, totalPledgedRef.value);
    },
  );

  const handlePledgePress = (pledgeId: string) => {
    router.push(`/pledge/${pledgeId}`);
  };

  if (authLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size='large' color={theme.colors.primary} />
      </ScreenContainer>
    );
  }

  if (!user) {
    return (
      <ScreenContainer>
        <CenteredColumn gap={16}>
          <Ionicons
            name='lock-closed-outline'
            size={64}
            color={theme.colors.textSecondary}
          />
          <BodySecondary style={{ textAlign: 'center' }}>
            {t('Connect your Solana wallet to get started')}
          </BodySecondary>
        </CenteredColumn>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <CenteredColumn
        flex={1}
        style={{ justifyContent: 'space-between', flex: 1 }}
      >
        <CenteredColumn flex={1} gap={24}>
          {/* HEADER ROW */}
          <Row width='100%' justify='flex-start'>
            <Title1>{t('History')}</Title1>
          </Row>

          <TrackedScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.colors.primary}
              />
            }
          >
            <Column gap={24}>
              {/* Stats Section */}
              <Column gap={4}>
                <View style={localStyles.sectionHeader}>
                  <Title3>{t('Stats')}</Title3>
                </View>
                <CenteredColumn gap={8}>
                  <Card style={{ alignItems: 'center', width: '100%', gap: 8 }}>
                    <Title2 style={{ color: theme.colors.primary }}>
                      ${formatUsdcAmount(displayPledged)}
                    </Title2>
                    <BodySmallSecondary>
                      {t('Total Pledged')}
                    </BodySmallSecondary>
                    <ProgressBar
                      progress={100}
                      height={6}
                      style={{ width: '100%' }}
                      animateKey={focusCount}
                      color={theme.colors.accent}
                    />
                  </Card>
                  <Card
                    style={{
                      width: '100%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Column gap={4} width='auto'>
                      <Title3 style={{ color: theme.colors.primary }}>
                        ({completedPledges.length}/{settledPledges.length})
                      </Title3>
                      <BodySmallSecondary>
                        {t('Success Rate')}
                      </BodySmallSecondary>
                    </Column>
                    {successRate > 0 && (
                      <AnimatedCircularProgress
                        progress={successRate}
                        size={66}
                        strokeWidth={5}
                        showPercentage
                        animateKey={focusCount}
                        color={theme.colors.accent}
                        textColor={theme.colors.text}
                      />
                    )}
                  </Card>
                </CenteredColumn>
              </Column>

              {/* Past Pledges Section */}
              <Column gap={4}>
                <View style={localStyles.sectionHeader}>
                  <Title3>{t('Past Pledges')}</Title3>
                </View>
                {pledgesLoading ? (
                  <CenteredColumn>
                    <Gap gap={48} />
                    <ActivityIndicator
                      size='large'
                      color={theme.colors.primary}
                    />
                  </CenteredColumn>
                ) : isError ? (
                  <ErrorState
                    message={error instanceof Error ? error.message : undefined}
                    onRetry={refetch}
                  />
                ) : pastPledges.length > 0 ? (
                  <View style={localStyles.contentContainer}>
                    {pastPledges.map((pledge) => (
                      <PastPledgeItem
                        key={pledge.id}
                        pledge={pledge}
                        onPress={() => handlePledgePress(pledge.id)}
                        animateKey={focusCount}
                      />
                    ))}
                  </View>
                ) : (
                  <EmptyState />
                )}
              </Column>
            </Column>
          </TrackedScrollView>
        </CenteredColumn>
      </CenteredColumn>
    </ScreenContainer>
  );
};

const localStyles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 100,
  },
});
