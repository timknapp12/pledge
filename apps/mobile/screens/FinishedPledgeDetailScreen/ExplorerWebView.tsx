import { useState } from 'react';
import { ActivityIndicator, Pressable, View, StyleSheet, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { BodySmall, Row, Card } from '@/components';
import { CLUSTER } from '@/lib/anchor/connection';

const EXPLORER_BASE = 'https://explorer.solana.com/tx';

interface ExplorerWebViewProps {
  txSignature: string;
}

export const ExplorerWebView = ({ txSignature }: ExplorerWebViewProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const [visible, setVisible] = useState(false);

  const shortSig = `${txSignature.slice(0, 8)}...${txSignature.slice(-8)}`;
  const url = CLUSTER === 'mainnet-beta'
    ? `${EXPLORER_BASE}/${txSignature}`
    : `${EXPLORER_BASE}/${txSignature}?cluster=${CLUSTER}`;

  return (
    <>
      <Pressable onPress={() => setVisible(true)}>
        <Card style={styles.txCard}>
          <Row gap={8} align='center'>
            <Ionicons
              name='open-outline'
              size={18}
              color={theme.colors.primary}
            />
            <BodySmall
              style={{ color: theme.colors.primary, fontFamily: 'monospace' }}
            >
              {shortSig}
            </BodySmall>
          </Row>
          <BodySmall style={{ color: theme.colors.textSecondary }}>
            {t('View on Explorer')}
          </BodySmall>
        </Card>
      </Pressable>

      <Modal
        visible={visible}
        animationType='slide'
        onRequestClose={() => setVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <Row
            style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}
          >
            <BodySmall style={{ flex: 1 }}>{t('Solana Explorer')}</BodySmall>
            <Pressable onPress={() => setVisible(false)} style={styles.closeButton}>
              <Ionicons name='close' size={24} color={theme.colors.text} />
            </Pressable>
          </Row>
          <WebView
            source={{ uri: url }}
            style={{ flex: 1 }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size='large' color={theme.colors.primary} />
              </View>
            )}
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  txCard: {
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
