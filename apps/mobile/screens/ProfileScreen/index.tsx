import { useState, useEffect, useCallback } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
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
  OutlineButton,
  Row,
} from '@/components';
import { SettingsItem } from './SettingsItem';

export const ProfileScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const { user, walletAddress, supabase, disconnect } = useAuth();
  const {
    registerForPushNotifications,
    disableNotifications,
    isRegistering,
  } = useNotifications();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);

  // Load notifications_enabled from DB
  useEffect(() => {
    if (!user) return;

    supabase
      .from('users')
      .select('notifications_enabled')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setNotificationsEnabled(data.notifications_enabled ?? false);
        }
      });
  }, [user, supabase]);

  const handleSignOut = () => {
    Alert.alert(t('Sign Out'), t('Are you sure?'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Sign Out'), style: 'destructive', onPress: disconnect },
    ]);
  };

  const handleTemplates = () => {
    // TODO: Navigate to templates screen
  };

  const handleNotificationsToggle = useCallback(
    async (value: boolean) => {
      setIsTogglingNotifications(true);
      try {
        if (value) {
          const token = await registerForPushNotifications();
          if (token) {
            setNotificationsEnabled(true);
          }
          // If token is null, permission was denied — don't toggle
        } else {
          await disableNotifications();
          setNotificationsEnabled(false);
        }
      } catch (err) {
        console.error('Failed to toggle notifications:', err);
      } finally {
        setIsTogglingNotifications(false);
      }
    },
    [registerForPushNotifications, disableNotifications]
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
          <Row width='100%'>
            <Title1>{t('Profile')}</Title1>
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
                <View style={localStyles.sectionHeader}>
                  <Title3>{t('Theme')}</Title3>
                </View>
                <ThemeSelector />
              </Column>

              {/* Settings Section */}
              <Column gap={4}>
                <View style={localStyles.sectionHeader}>
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
  sectionHeader: {
    paddingHorizontal: 20,
  },
});
