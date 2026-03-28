import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserProfile } from '@/hooks/useSupabase';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import type { Personality } from '@/hooks/useUserPreferences';
import {
  Title1,
  Title3,
  Body,
  BodySecondary,
  BodySmallSecondary,
  MonoText,
  ScreenContainer,
  CenteredColumn,
  Column,
  Card,
  TrackedScrollView,
  ThemeSelector,
  SegmentControl,
  OutlineButton,
  Row,
  useAlert,
} from '@/components';
import { SettingsItem } from './SettingsItem';

export const ProfileScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();
  const { user, walletAddress, disconnect } = useAuth();
  const {
    registerForPushNotifications,
    disableNotifications,
    isEnabled: notificationsEnabled,
    isRegistering,
  } = useNotifications();

  const {
    personality,
    setPersonality,
    language,
    setLanguage,
    supportedLanguages,
  } = useUserPreferences();

  const { data: userProfile } = useUserProfile();
  const { alert } = useAlert();
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);

  const personalitySegments = useMemo(
    () => [
      { key: 'carrot', label: `${t('Carrot')}   🥕` },
      { key: 'stick', label: `${t('Stick')}   🪓` },
    ],
    [t],
  );

  const languageSegments = useMemo(
    () =>
      supportedLanguages.map((lang) => ({
        key: lang.code,
        label: lang.label,
      })),
    [supportedLanguages],
  );

  const handlePersonalityChange = useCallback(
    (key: string) => {
      setPersonality(key as Personality);
    },
    [setPersonality],
  );

  const handleLanguageChange = useCallback(
    (key: string) => {
      setLanguage(key);
    },
    [setLanguage],
  );

  const handleSignOut = () => {
    alert({
      title: t('Sign Out'),
      message: t('Are you sure?'),
      buttons: [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Sign Out'), style: 'destructive', onPress: disconnect },
      ],
    });
  };

  const handleTemplates = () => {
    router.push('/templates');
  };

  const handleFAQ = () => {
    router.push('/faq');
  };

  const handleTerms = () => {
    router.push('/terms');
  };

  const handlePrivacy = () => {
    router.push('/privacy');
  };

  const handleAppGuide = () => {
    router.push('/onboarding?fromSettings=true');
  };

  const handleNotificationsToggle = useCallback(
    async (value: boolean) => {
      setIsTogglingNotifications(true);
      try {
        if (value) {
          await registerForPushNotifications();
        } else {
          await disableNotifications();
        }
      } catch (err) {
        console.error('Failed to toggle notifications:', err);
      } finally {
        setIsTogglingNotifications(false);
      }
    },
    [registerForPushNotifications, disableNotifications],
  );

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  if (!user) {
    return (
      <ScreenContainer>
        <CenteredColumn gap={16}>
          <Ionicons
            name='person-outline'
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
      <Column
        style={{
          justifyContent: 'space-between',
          flex: 1,
          width: '100%',
        }}
      >
        <CenteredColumn flex={1} gap={24}>
          {/* HEADER ROW */}
          <Row width='100%' justify='space-between' align='center'>
            <Title1>{t('Profile')}</Title1>
            <Row align='center' gap={4}>
              <Ionicons name='star' size={18} color={theme.colors.primary} />
              <Body style={{ color: theme.colors.primary, fontWeight: '600' }}>
                {userProfile?.points ?? 0}
              </Body>
            </Row>
          </Row>
          <TrackedScrollView showsVerticalScrollIndicator={false}>
            <Column flex={1} gap={24}>
              {/* Wallet Card */}
              <Card style={localStyles.walletCard}>
                <View
                  style={[
                    localStyles.walletIcon,
                    { backgroundColor: `${theme.colors.primary}20` },
                  ]}
                >
                  <Ionicons
                    name='wallet'
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <Column gap={4}>
                  <Body>{t('Connected Wallet')}</Body>
                  <MonoText>
                    {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-8)}
                  </MonoText>
                </Column>
              </Card>

              {/* Theme Section */}
              <Column gap={4}>
                <View>
                  <Title3>{t('Theme')}</Title3>
                </View>
                <ThemeSelector />
              </Column>

              {/* Notification Personality Section */}
              <Column gap={4}>
                <View>
                  <Title3>{t('Personality')}</Title3>
                </View>
                <Card>
                  <BodySecondary>
                    {t('Choose the tone of your push notifications')}
                  </BodySecondary>
                  <SegmentControl
                    segments={personalitySegments}
                    selectedKey={personality}
                    onSelect={handlePersonalityChange}
                  />
                  <BodySmallSecondary>
                    {personality === 'carrot'
                      ? t(
                          "Encouraging & Positive: Hey! Time to crush your tasks today! You've got this!",
                        )
                      : t(
                          "Drill Sergeant: Hey loser! You have 3 hours left. Don't waste your money and your life!",
                        )}
                  </BodySmallSecondary>
                </Card>
              </Column>

              {/* Language Section */}
              {languageSegments.length > 0 && (
                <Column gap={4}>
                  <View>
                    <Title3>{t('Language')}</Title3>
                  </View>
                  <SegmentControl
                    segments={languageSegments}
                    selectedKey={language}
                    onSelect={handleLanguageChange}
                  />
                </Column>
              )}

              {/* Settings Section */}
              <Column gap={4}>
                <View>
                  <Title3>{t('Settings')}</Title3>
                </View>
                <Card>
                  <SettingsItem
                    icon='documents-outline'
                    label={t('Templates')}
                    onPress={handleTemplates}
                  />
                  <SettingsItem
                    icon='notifications-outline'
                    label={t('Notifications')}
                    switchValue={notificationsEnabled}
                    onSwitchChange={handleNotificationsToggle}
                    switchDisabled={isTogglingNotifications || isRegistering}
                  />
                  <SettingsItem
                    icon='help-circle-outline'
                    label={t('FAQs')}
                    onPress={handleFAQ}
                  />
                  <SettingsItem
                    icon='book-outline'
                    label={t('App Guide')}
                    onPress={handleAppGuide}
                  />
                  <SettingsItem
                    icon='document-text-outline'
                    label={t('Terms & Conditions')}
                    onPress={handleTerms}
                  />
                  <SettingsItem
                    icon='shield-checkmark-outline'
                    label={t('Privacy Policy')}
                    onPress={handlePrivacy}
                    isLast
                  />
                </Card>
              </Column>
            </Column>

            {/* Sign Out */}
            <CenteredColumn padding={16} gap={16}>
              <OutlineButton icon='log-out-outline' onPress={handleSignOut}>
                {t('Sign Out')}
              </OutlineButton>
              <BodySmallSecondary>Pledge v{appVersion}</BodySmallSecondary>
            </CenteredColumn>
          </TrackedScrollView>
        </CenteredColumn>
      </Column>
    </ScreenContainer>
  );
};

const localStyles = StyleSheet.create({
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
