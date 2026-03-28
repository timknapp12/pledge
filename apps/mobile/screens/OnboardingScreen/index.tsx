import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  ViewToken,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Title1,
  Body,
  BodySmall,
  ScreenContainer,
  PrimaryButton,
} from '@/components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_KEY = 'hasSeenOnboarding';

interface OnboardingPage {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
}

const PAGES: OnboardingPage[] = [
  {
    icon: 'rocket-outline',
    titleKey: 'Pledge your tokens, crush your goals',
    bodyKey: 'onboarding_welcome_body',
  },
  {
    icon: 'list-outline',
    titleKey: 'How It Works',
    bodyKey: 'onboarding_how_body',
  },
  {
    icon: 'calendar-outline',
    titleKey: 'Two Types of Tasks',
    bodyKey: 'onboarding_tasks_body',
  },
  {
    icon: 'shield-checkmark-outline',
    titleKey: 'Fair & Simple Rules',
    bodyKey: 'onboarding_rules_body',
  },
  {
    icon: 'time-outline',
    titleKey: '24-Hour Grace Period',
    bodyKey: 'onboarding_grace_body',
  },
  {
    icon: 'checkmark-circle-outline',
    titleKey: "You're Ready!",
    bodyKey: 'onboarding_ready_body',
  },
];

export const OnboardingScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();
  const { fromSettings } = useLocalSearchParams<{ fromSettings?: string }>();
  const isFromSettings = fromSettings === 'true';

  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleDone = useCallback(async () => {
    if (!isFromSettings) {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    }
    router.back();
  }, [isFromSettings, router]);

  const handleNext = useCallback(() => {
    if (currentIndex < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleDone();
    }
  }, [currentIndex, handleDone]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const isLastPage = currentIndex === PAGES.length - 1;

  return (
    <ScreenContainer style={styles.screen}>
      {/* Skip button */}
      {!isLastPage && (
        <Pressable style={styles.skipButton} onPress={handleDone}>
          <BodySmall style={{ color: theme.colors.textSecondary }}>
            {t('Skip')}
          </BodySmall>
        </Pressable>
      )}

      {/* Pages */}
      <FlatList
        ref={flatListRef}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(_, i) => String(i)}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <View style={styles.pageContent}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: `${theme.colors.primary}15` },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={80}
                  color={theme.colors.primary}
                />
              </View>
              <Title1 style={styles.title}>{t(item.titleKey)}</Title1>
              <Body
                style={[styles.body, { color: theme.colors.textSecondary }]}
              >
                {t(item.bodyKey)}
              </Body>
            </View>
          </View>
        )}
      />

      {/* Bottom section: dots + button */}
      <View style={styles.bottomSection}>
        {/* Dot indicators */}
        <View style={styles.dotsContainer}>
          {PAGES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentIndex
                      ? theme.colors.primary
                      : theme.colors.border,
                  width: index === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started button */}
        <View style={styles.buttonContainer}>
          <PrimaryButton onPress={handleNext}>
            {isLastPage ? t('Get Started') : t('Next')}
          </PrimaryButton>
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  skipButton: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
    width: '100%',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    width: '100%',
  },
});
