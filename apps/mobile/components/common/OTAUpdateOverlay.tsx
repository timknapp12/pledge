import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { cardBorderRadius } from '@/theme';
import { useAppTheme } from '@/theme/ThemeProvider';

import { PrimaryButton } from './buttons/buttons';
import { Body, Title3 } from './texts';

interface OTAUpdateOverlayProps {
  status: 'available' | 'downloading';
  onUpdate: () => void;
}

export const OTAUpdateOverlay = ({
  status,
  onUpdate,
}: OTAUpdateOverlayProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const isDownloading = status === 'downloading';

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.cardBackground,
            borderColor: theme.colors.border,
            shadowColor: theme.colors.shadowColor,
          },
        ]}
      >
        <Title3 style={styles.title}>{t('New Update Available')}</Title3>
        <Body
          style={{ color: theme.colors.textSecondary, textAlign: 'center' }}
        >
          {t('A new version of Pledge is ready to install.')}
        </Body>
        <PrimaryButton
          onPress={onUpdate}
          loading={isDownloading}
          disabled={isDownloading}
          style={styles.button}
        >
          {t('Restart & Update')}
        </PrimaryButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 10000,
    elevation: 24,
  },
  card: {
    ...cardBorderRadius,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 16,
    width: 320,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    minWidth: 200,
  },
});
