import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import {
  Title1,
  BodySecondary,
  BodySmall,
  ErrorText,
  ScreenContainer,
  CenteredColumn,
  PrimaryButton,
  Gap,
  Row,
} from '@/components';

const TERMS_URL = 'https://sol-pledge.com/terms.html';
const PRIVACY_URL = 'https://sol-pledge.com/privacy.html';
const TERMS_TOKEN = '__TERMS__';
const PRIVACY_TOKEN = '__PRIVACY__';

export const ConnectWalletScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const { isConnecting, error, connect } = useAuth();
  const [legalModal, setLegalModal] = useState<
    { url: string; title: string } | null
  >(null);

  const sentence = t(
    'By connecting your wallet, you agree to our {{terms}} and {{privacy}}.',
    { terms: TERMS_TOKEN, privacy: PRIVACY_TOKEN },
  );
  const parts = sentence.split(/(__TERMS__|__PRIVACY__)/);

  return (
    <ScreenContainer>
      <CenteredColumn
        gap={16}
        style={{
          justifyContent: 'space-between',
          flex: 1,
          marginBottom: 60,
        }}
      >
        <CenteredColumn gap={12} justify='center' flex={1}>
          <Ionicons
            name='wallet-outline'
            size={64}
            color={theme.colors.primary}
          />
          <Title1>{t('Pledge')}</Title1>
          <Gap gap={32} />
          <BodySecondary style={{ textAlign: 'center', maxWidth: 280 }}>
            {t(
              'Pledge your tokens, crush your goals. Connect your wallet to get started.',
            )}
          </BodySecondary>
        </CenteredColumn>

        <CenteredColumn gap={12} width='100%'>
          <PrimaryButton
            onPress={connect}
            loading={isConnecting}
            icon='wallet-outline'
          >
            {t('Connect Wallet')}
          </PrimaryButton>

          <BodySmall
            style={{
              textAlign: 'center',
              color: theme.colors.textSecondary,
              maxWidth: 320,
            }}
          >
            {parts.map((part, i) => {
              if (part === TERMS_TOKEN) {
                return (
                  <Text
                    key={i}
                    style={[styles.link, { color: theme.colors.primary }]}
                    onPress={() =>
                      setLegalModal({
                        url: TERMS_URL,
                        title: t('Terms'),
                      })
                    }
                  >
                    {t('Terms')}
                  </Text>
                );
              }
              if (part === PRIVACY_TOKEN) {
                return (
                  <Text
                    key={i}
                    style={[styles.link, { color: theme.colors.primary }]}
                    onPress={() =>
                      setLegalModal({
                        url: PRIVACY_URL,
                        title: t('Privacy Policy'),
                      })
                    }
                  >
                    {t('Privacy Policy')}
                  </Text>
                );
              }
              return part;
            })}
          </BodySmall>
        </CenteredColumn>

        {error && (
          <ErrorText style={{ marginTop: 16, textAlign: 'center' }}>
            {error}
          </ErrorText>
        )}
      </CenteredColumn>

      <Modal
        visible={legalModal !== null}
        animationType='slide'
        onRequestClose={() => setLegalModal(null)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <Row
            style={[
              styles.modalHeader,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <BodySmall style={{ flex: 1 }}>{legalModal?.title ?? ''}</BodySmall>
            <Pressable
              onPress={() => setLegalModal(null)}
              style={styles.closeButton}
            >
              <Ionicons name='close' size={24} color={theme.colors.text} />
            </Pressable>
          </Row>
          {legalModal && (
            <WebView
              source={{ uri: legalModal.url }}
              style={{ flex: 1 }}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    size='large'
                    color={theme.colors.primary}
                  />
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
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
