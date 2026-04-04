import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  ActivityIndicator,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  Title1,
  Title2,
  Title3,
  Body,
  BodySmall,
  BodySecondary,
  BodySmallSecondary,
  MonoText,
  ScreenContainer,
  CenteredColumn,
  Column,
  Card,
  Row,
  PrimaryButton,
} from '@/components';
import { useScrollContext } from '@/contexts/ScrollContext';
import {
  useUserProfile,
  useSeasonPoints,
  usePointEvents,
  useReferralCount,
} from '@/hooks/useSupabase';
import { PointEventItem } from './PointEventItem';
import { getAnimatedDisplayInteger } from '@/lib/animatedAmount';

const POINTS_URL = 'https://pledgeapp.xyz/points.html';

export const PointsScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();
  const { data: userProfile } = useUserProfile();
  const { data: seasonData } = useSeasonPoints();
  const { data: pointEvents } = usePointEvents();
  const { data: referralCount } = useReferralCount();

  const totalPoints = userProfile?.points ?? 0;
  const seasonPoints = seasonData?.seasonPoints ?? 0;

  // Animated points count-up
  const [displayPoints, setDisplayPoints] = useState(0);
  const [displaySeasonPoints, setDisplaySeasonPoints] = useState(0);
  const pointsProgress = useSharedValue(0);
  const totalPointsRef = useSharedValue(totalPoints);
  const seasonPointsRef = useSharedValue(seasonPoints);

  useEffect(() => {
    totalPointsRef.value = totalPoints;
    seasonPointsRef.value = seasonPoints;
    setDisplayPoints(0);
    setDisplaySeasonPoints(0);
    pointsProgress.value = 0;
    pointsProgress.value = withTiming(100, { duration: 1000 });
  }, [totalPoints, seasonPoints, pointsProgress, totalPointsRef, seasonPointsRef]);

  const updateDisplayPoints = useCallback(
    (progress: number, total: number, season: number) => {
      setDisplayPoints(getAnimatedDisplayInteger(progress, total));
      setDisplaySeasonPoints(getAnimatedDisplayInteger(progress, season));
    },
    [],
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

  const referralCode = userProfile?.referral_code ?? '';
  const [_copied, setCopied] = useState(false);
  const [webViewVisible, setWebViewVisible] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated copy icon
  const copyOpacity = useSharedValue(1);
  const checkOpacity = useSharedValue(0);
  const iconScale = useSharedValue(1);

  const copyIconStyle = useAnimatedStyle(() => ({
    opacity: copyOpacity.value,
    position: 'absolute' as const,
  }));

  const checkIconStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: iconScale.value }],
    position: 'absolute' as const,
  }));

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopyCode = useCallback(async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);

    // Animate: fade out copy, scale-in checkmark
    copyOpacity.value = withTiming(0, { duration: 150 });
    checkOpacity.value = withTiming(1, { duration: 150 });
    iconScale.value = withSequence(
      withTiming(1.3, { duration: 150 }),
      withTiming(1, { duration: 100 }),
    );
    setCopied(true);

    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      // Animate back
      checkOpacity.value = withTiming(0, { duration: 150 });
      copyOpacity.value = withTiming(1, { duration: 150 });
      setCopied(false);
    }, 2000);
  }, [referralCode, copyOpacity, checkOpacity, iconScale]);

  const handleShareCode = useCallback(async () => {
    if (!referralCode) return;
    await Share.share({
      message: t('Join me on Pledge! Use my referral code: {{code}}', {
        code: referralCode,
      }),
    });
  }, [referralCode, t]);

  // Scroll tracking (mirrors TrackedScrollView behavior)
  const { setScrolling } = useScrollContext();
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScrollBeginDrag = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    setScrolling(true);
  }, [setScrolling]);

  const handleScrollEnd = useCallback(() => {
    scrollTimeout.current = setTimeout(() => setScrolling(false), 0);
  }, [setScrolling]);

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (
        !e.nativeEvent.velocity ||
        (e.nativeEvent.velocity.y === 0 && e.nativeEvent.velocity.x === 0)
      ) {
        handleScrollEnd();
      }
    },
    [handleScrollEnd],
  );

  const handleMomentumScrollEnd = useCallback(() => {
    handleScrollEnd();
  }, [handleScrollEnd]);

  const renderHeader = () => (
    <Column gap={24}>
      {/* Points Summary */}
      <Column gap={4}>
        <View style={localStyles.sectionHeader}>
          <Title3>{t('Points')}</Title3>
        </View>
        <Row gap={8} width='100%'>
          <Card style={localStyles.statCard}>
            <Ionicons name='star' size={28} color={theme.colors.primary} />
            <Title2 style={{ color: theme.colors.primary }}>
              {displayPoints}
            </Title2>
            <BodySmallSecondary>{t('Total Points')}</BodySmallSecondary>
          </Card>
          <Card style={localStyles.statCard}>
            <Ionicons name='trophy' size={28} color={theme.colors.accent} />
            <Title2 style={{ color: theme.colors.accent }}>
              {displaySeasonPoints}
            </Title2>
            <BodySmallSecondary>
              {seasonData?.seasonName ?? t('Season Points')}
            </BodySmallSecondary>
          </Card>
        </Row>
      </Column>

      {/* How Points Work */}
      <Column gap={4}>
        <View style={localStyles.sectionHeader}>
          <Title3>{t('How Points Work')}</Title3>
        </View>
        <Card>
          <Column gap={12}>
            <Row gap={8} align='flex-start'>
              <View
                style={[
                  localStyles.ruleIcon,
                  { backgroundColor: `${theme.colors.primary}20` },
                ]}
              >
                <Ionicons
                  name='add-circle'
                  size={18}
                  color={theme.colors.primary}
                />
              </View>
              <Column gap={2} style={{ flex: 1 }}>
                <Body>{t('Create Pledges')}</Body>
                <BodySmallSecondary>
                  {t(
                    'Earn base points + bonus for stake size. Duration bonus awarded at completion.',
                  )}
                </BodySmallSecondary>
              </Column>
            </Row>
            <Row gap={8} align='flex-start'>
              <View
                style={[
                  localStyles.ruleIcon,
                  {
                    backgroundColor: `${theme.colors.statusCompleted}20`,
                  },
                ]}
              >
                <Ionicons
                  name='checkmark-circle'
                  size={18}
                  color={theme.colors.statusCompleted}
                />
              </View>
              <Column gap={2} style={{ flex: 1 }}>
                <Body>{t('Complete Goals')}</Body>
                <BodySmallSecondary>
                  {t('100% completion = 2x multiplier on creation points')}
                </BodySmallSecondary>
              </Column>
            </Row>
            <Row gap={8} align='flex-start'>
              <View
                style={[
                  localStyles.ruleIcon,
                  { backgroundColor: `${theme.colors.accent}20` },
                ]}
              >
                <Ionicons
                  name='flame'
                  size={18}
                  color={theme.colors.accent}
                />
              </View>
              <Column gap={2} style={{ flex: 1 }}>
                <Body>{t('Build Streaks')}</Body>
                <BodySmallSecondary>
                  {t('Consecutive 100% completions multiply your points')}
                </BodySmallSecondary>
              </Column>
            </Row>
            <Row gap={8} align='flex-start'>
              <View
                style={[
                  localStyles.ruleIcon,
                  { backgroundColor: `${theme.colors.primary}20` },
                ]}
              >
                <Ionicons
                  name='people'
                  size={18}
                  color={theme.colors.primary}
                />
              </View>
              <Column gap={2} style={{ flex: 1 }}>
                <Body>{t('Refer Friends')}</Body>
                <BodySmallSecondary>
                  {t(
                    'Both get 25 points + you earn 10% of their pledge points this season',
                  )}
                </BodySmallSecondary>
              </Column>
            </Row>
          </Column>
        </Card>
      </Column>

      {/* Referral Code */}
      <Column gap={4}>
        <View style={localStyles.sectionHeader}>
          <Title3>{t('Your Referral Code')}</Title3>
        </View>
        <Card>
          <Column gap={12} style={{ alignItems: 'center' }}>
            <Pressable
              onPress={handleCopyCode}
              style={[
                localStyles.codeBox,
                { borderColor: theme.colors.border },
              ]}
            >
              <MonoText style={localStyles.codeText}>
                {referralCode || '------'}
              </MonoText>
              <View style={{ width: 20, height: 20 }}>
                <Animated.View style={copyIconStyle}>
                  <Ionicons
                    name='copy-outline'
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </Animated.View>
                <Animated.View style={checkIconStyle}>
                  <Ionicons
                    name='checkmark-circle'
                    size={20}
                    color={theme.colors.statusCompleted}
                  />
                </Animated.View>
              </View>
            </Pressable>
            <BodySmallSecondary>
              {t('{{count}} friends referred', {
                count: referralCount ?? 0,
              })}
            </BodySmallSecondary>

            <PrimaryButton
              icon='share-social-outline'
              onPress={handleShareCode}
            >
              {t('Share')}
            </PrimaryButton>
          </Column>
        </Card>
      </Column>

      {/* Learn More */}
      <Pressable onPress={() => setWebViewVisible(true)}>
        <Card style={localStyles.learnMoreCard}>
          <Row gap={8} align='center'>
            <Ionicons
              name='information-circle-outline'
              size={18}
              color={theme.colors.primary}
            />
            <BodySmall style={{ color: theme.colors.primary }}>
              {t('Learn more about points')}
            </BodySmall>
          </Row>
          <Ionicons
            name='open-outline'
            size={16}
            color={theme.colors.textSecondary}
          />
        </Card>
      </Pressable>

      {/* Points History Header */}
      <View style={localStyles.sectionHeader}>
        <Title3>{t('Points History')}</Title3>
      </View>
    </Column>
  );

  const renderEmpty = () => (
    <Card style={{ alignItems: 'center' }}>
      <BodySecondary>
        {t('No points earned yet. Create your first pledge!')}
      </BodySecondary>
    </Card>
  );

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <CenteredColumn flex={1} gap={24}>
        {/* Header */}
        <Row width='100%' justify='flex-start' align='center'>
          <Pressable onPress={() => router.back()}>
            <Ionicons name='arrow-back' size={24} color={theme.colors.text} />
          </Pressable>
          <Title1 style={{ marginLeft: 12 }}>{t('Points & Referrals')}</Title1>
        </Row>

        <FlatList
          data={pointEvents ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PointEventItem event={item} />}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
          style={{ width: '100%' }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
        />
      </CenteredColumn>

      {/* WebView Modal */}
      <Modal
        visible={webViewVisible}
        animationType='slide'
        onRequestClose={() => setWebViewVisible(false)}
      >
        <View
          style={[
            localStyles.modalContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <Row
            style={[
              localStyles.modalHeader,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <BodySmall style={{ flex: 1 }}>
              {t('Learn more about points')}
            </BodySmall>
            <Pressable
              onPress={() => setWebViewVisible(false)}
              style={localStyles.closeButton}
            >
              <Ionicons name='close' size={24} color={theme.colors.text} />
            </Pressable>
          </Row>
          <WebView
            source={{ uri: POINTS_URL }}
            style={{ flex: 1 }}
            startInLoadingState
            renderLoading={() => (
              <View style={localStyles.loadingContainer}>
                <ActivityIndicator size='large' color={theme.colors.primary} />
              </View>
            )}
          />
        </View>
      </Modal>
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
    padding: 12,
  },
  ruleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  codeText: {
    fontSize: 24,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  learnMoreCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
