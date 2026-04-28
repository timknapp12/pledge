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
import {
  usePledges,
  formatUsdcAmount,
  getEffectiveStatus,
  useUserProfile,
  useSeasonPoints,
} from '@/hooks/useSupabase';
import {
  getAnimatedDisplayLamports,
  getAnimatedDisplayInteger,
} from '@/lib/animatedAmount';
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
  const { data: userProfile } = useUserProfile();
  const { data: seasonData } = useSeasonPoints();

  // Filter for past pledges (completed, forfeited, or expired)
  const pastPledges =
    allPledges?.filter((p) => {
      const s = getEffectiveStatus(p);
      return s === 'Completed' || s === 'Forfeited' || s === 'Expired';
    }) || [];

  // Calculate stats
  const totalPledged =
    allPledges?.reduce((sum, p) => sum + p.stake_amount, 0) || 0;
  // Avg completion across settled pledges with a recorded percentage
  const settledWithPct = pastPledges.filter(
    (p) => p.completion_percentage !== null,
  );
  const avgCompletion =
    settledWithPct.length > 0
      ? Math.round(
          settledWithPct.reduce((sum, p) => sum + p.completion_percentage!, 0) /
            settledWithPct.length,
        )
      : 0;

  // Consecutive 100% completions from most recent
  const sortedSettled = [...pastPledges].sort(
    (a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime(),
  );
  let perfectStreak = 0;
  for (const p of sortedSettled) {
    if (p.completion_percentage === 100) perfectStreak++;
    else break;
  }

  const totalPoints = userProfile?.points ?? 0;
  const seasonPoints = seasonData?.seasonPoints ?? 0;

  const [focusCount, setFocusCount] = useState(0);
  const [displayPledged, setDisplayPledged] = useState(0);
  const [displayPoints, setDisplayPoints] = useState(0);
  const [displaySeasonPoints, setDisplaySeasonPoints] = useState(0);
  const pledgedProgress = useSharedValue(0);
  const pointsProgress = useSharedValue(0);
  const totalPledgedRef = useSharedValue(totalPledged);
  const totalPointsRef = useSharedValue(totalPoints);
  const seasonPointsRef = useSharedValue(seasonPoints);

  useFocusEffect(
    useCallback(() => {
      setFocusCount((c) => c + 1);
    }, []),
  );

  useEffect(() => {
    totalPledgedRef.value = totalPledged;
  }, [totalPledged, totalPledgedRef]);

  useEffect(() => {
    totalPointsRef.value = totalPoints;
    seasonPointsRef.value = seasonPoints;
    setDisplayPledged(0);
    setDisplayPoints(0);
    setDisplaySeasonPoints(0);
    pledgedProgress.value = 0;
    pointsProgress.value = 0;
    pledgedProgress.value = withTiming(100, { duration: 1000 });
    pointsProgress.value = withTiming(100, { duration: 1000 });
  }, [totalPledged, totalPoints, seasonPoints, focusCount, pledgedProgress, pointsProgress, totalPointsRef, seasonPointsRef]);

  const updateDisplayPledged = useCallback(
    (progress: number, total: number) => {
      setDisplayPledged(getAnimatedDisplayLamports(progress, total));
    },
    [],
  );

  const updateDisplayPoints = useCallback(
    (progress: number, total: number, season: number) => {
      setDisplayPoints(getAnimatedDisplayInteger(progress, total));
      setDisplaySeasonPoints(getAnimatedDisplayInteger(progress, season));
    },
    [],
  );

  useAnimatedReaction(
    () => pledgedProgress.value,
    (progress) => {
      scheduleOnRN(updateDisplayPledged, progress, totalPledgedRef.value);
    },
  );

  useAnimatedReaction(
    () => pointsProgress.value,
    (progress) => {
      scheduleOnRN(
        updateDisplayPoints,
        progress,
        totalPointsRef.value,
        seasonPointsRef.value,
      );
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
                      progress={totalPledged > 0 ? 100 : 0}
                      height={6}
                      style={{ width: '100%' }}
                      animateKey={
                        totalPledged > 0 ? focusCount : 0
                      }
                      color={theme.colors.accent}
                    />
                  </Card>
                  <Row gap={8} width='100%'>
                    <Card style={localStyles.statCard}>
                      <Ionicons
                        name='star'
                        size={28}
                        color={theme.colors.primary}
                      />
                      <Title2 style={{ color: theme.colors.primary }}>
                        {displayPoints}
                      </Title2>
                      <BodySmallSecondary>
                        {t('Total Points')}
                      </BodySmallSecondary>
                    </Card>
                    <Card style={localStyles.statCard}>
                      <Ionicons
                        name='trophy'
                        size={28}
                        color={theme.colors.accent}
                      />
                      <Title2 style={{ color: theme.colors.accent }}>
                        {displaySeasonPoints}
                      </Title2>
                      <BodySmallSecondary>
                        {seasonData?.seasonName ?? t('Season Points')}
                      </BodySmallSecondary>
                    </Card>
                  </Row>
                  <Row gap={8} width='100%'>
                    <Card style={localStyles.statCard}>
                      <AnimatedCircularProgress
                        progress={avgCompletion}
                        size={66}
                        strokeWidth={5}
                        showPercentage
                        animateKey={focusCount}
                        color={theme.colors.accent}
                        textColor={theme.colors.text}
                      />
                      <BodySmallSecondary>
                        {t('Avg Completion')}
                      </BodySmallSecondary>
                    </Card>
                    <Card style={localStyles.statCard}>
                      <AnimatedCircularProgress
                        progress={perfectStreak > 0 ? 100 : 0}
                        size={66}
                        strokeWidth={5}
                        customText={`${perfectStreak}`}
                        animateKey={focusCount}
                        color={theme.colors.accent}
                        textColor={theme.colors.text}
                      />
                      <BodySmallSecondary>
                        {t('Perfect Streak')}
                      </BodySmallSecondary>
                    </Card>
                  </Row>
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
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  contentContainer: {
    paddingBottom: 100,
  },
});
