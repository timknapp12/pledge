import { Alert, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
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
  const { user, walletAddress, disconnect } = useAuth();

  const handleSignOut = () => {
    Alert.alert(t('Sign Out'), t('Are you sure?'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Sign Out'), style: 'destructive', onPress: disconnect },
    ]);
  };

  const handleTemplates = () => {
    // TODO: Navigate to templates screen
  };

  const handleNotifications = () => {
    // TODO: Navigate to notifications settings
  };

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
        <CenteredColumn style={{ flex: 1 }} gap={24}>
          {/* HEADER ROW */}
          <Row width='100%'>
            <Title1>{t('Profile')}</Title1>
          </Row>
          <TrackedScrollView showsVerticalScrollIndicator={false}>
            <Column style={{ flex: 1 }} gap={24}>
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
                    onPress={handleNotifications}
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
