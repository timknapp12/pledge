import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'styled-components/native';
import styled from 'styled-components/native';
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
  Row,
  Card,
  TrackedScrollView,
  ThemeSelector,
  OutlineButton,
} from '@/components';

const Header = styled.View`
  padding: 60px 20px 20px 20px;
`;

const WalletCard = styled(Card)`
  margin: 0 20px 24px 20px;
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const WalletIcon = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background-color: ${({ theme }) => theme.colors.primary}20;
  align-items: center;
  justify-content: center;
`;

const SectionHeader = styled.View`
  padding: 0 20px;
  margin-bottom: 12px;
`;

const SettingsCard = styled(Card)`
  margin: 0 20px 12px 20px;
`;

const SettingsRow = styled.Pressable`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colors.border};
`;

const SettingsRowLast = styled(SettingsRow)`
  border-bottom-width: 0;
`;

const SettingsLabel = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface SettingsItemProps {
  icon: IoniconsName;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
}

function SettingsItem({
  icon,
  label,
  value,
  onPress,
  isLast,
}: SettingsItemProps) {
  const theme = useTheme();
  const Container = isLast ? SettingsRowLast : SettingsRow;

  return (
    <Container onPress={onPress} disabled={!onPress}>
      <SettingsLabel>
        <Ionicons name={icon} size={20} color={theme.colors.textSecondary} />
        <Body>{label}</Body>
      </SettingsLabel>
      <Row $gap={8}>
        {value && <BodySecondary>{value}</BodySecondary>}
        {onPress && (
          <Ionicons
            name='chevron-forward'
            size={20}
            color={theme.colors.textSecondary}
          />
        )}
      </Row>
    </Container>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
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
        <CenteredColumn $gap={16}>
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
    <ScreenContainer
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <TrackedScrollView showsVerticalScrollIndicator={false}>
        <Header>
          <Title1>{t('Profile')}</Title1>
        </Header>

        {/* Wallet Card */}
        <WalletCard>
          <WalletIcon>
            <Ionicons name='wallet' size={24} color={theme.colors.primary} />
          </WalletIcon>
          <Column style={{ flex: 1 }}>
            <Body>{t('Connected Wallet')}</Body>
            <MonoText style={{ marginTop: 4 }}>
              {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-8)}
            </MonoText>
          </Column>
        </WalletCard>

        {/* Theme Section */}
        <SectionHeader>
          <Title3>{t('Theme')}</Title3>
        </SectionHeader>
        <ThemeSelector />

        {/* Settings Section */}
        <SectionHeader>
          <Title3>{t('Settings')}</Title3>
        </SectionHeader>
        <SettingsCard>
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
        </SettingsCard>

        {/* Sign Out */}
        <CenteredColumn $padding={16} $gap={16}>
          <OutlineButton icon='log-out-outline' onPress={handleSignOut}>
            {t('Sign Out')}
          </OutlineButton>
          <BodySmallSecondary>Pledge v{appVersion}</BodySmallSecondary>
        </CenteredColumn>
      </TrackedScrollView>
    </ScreenContainer>
  );
}
