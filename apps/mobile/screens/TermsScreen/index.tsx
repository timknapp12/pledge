import { Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Title1,
  Title3,
  Body,
  ScreenContainer,
  Column,
  Row,
  TrackedScrollView,
} from '@/components';

export const TermsScreen = () => {
  const { theme } = useAppTheme();
  const router = useRouter();

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Column flex={1} gap={24} width='100%'>
        <Row align='center' justify='flex-start'>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backButton,
              { backgroundColor: theme.colors.cardBackground },
            ]}
          >
            <Ionicons name='arrow-back' size={24} color={theme.colors.text} />
          </Pressable>
          <Title1>Terms & Conditions</Title1>
        </Row>

        <TrackedScrollView showsVerticalScrollIndicator={false}>
          <Column gap={20}>
            <Body>Last updated: March 2026</Body>

            <Column gap={8}>
              <Title3>1. Overview</Title3>
              <Body>
                Pledge is an open-source goal accountability app built on the
                Solana blockchain. By using Pledge, you agree to stake USDC
                tokens on your personal goals. The app holds your stake in an
                on-chain vault and returns it based on your self-reported
                completion.
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>2. How It Works</Title3>
              <Body>
                When you create a pledge, your USDC is transferred to a
                program-controlled vault on the Solana blockchain. You set a
                deadline, define your tasks or goals, and track your daily
                progress. After your deadline, you report your completion
                percentage and the program settles your stake accordingly.
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>3. Fee Structure</Title3>
              <Body>
                • 100% completion: You receive your full stake back with zero
                fees.{'\n'}• Partial completion: You receive a proportional
                refund minus a 1% fee. For example, 50% completion on a $10
                stake returns $4.95.{'\n'}• 0% completion: Your entire stake is
                forfeited.{'\n\n'}
                Forfeited and fee amounts are split between the Pledge treasury
                and a charity wallet as configured by the program.
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>4. Automatic Processing</Title3>
              <Body>
                If you do not report your completion before the deadline plus a
                24-hour grace period, an automated crank service will process
                your pledge. The crank calculates your completion based on the
                daily tasks you checked off during the pledge period. You should
                report manually for the most accurate result.
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>5. Editing a Pledge</Title3>
              <Body>
                You may edit an active pledge before its deadline. Editing
                incurs a 10% penalty on your staked amount, which is distributed
                to the treasury and charity wallets.
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>6. Open Source & No Audit</Title3>
              <Body>
                Pledge is open-source software. The smart contracts and app code
                are publicly available for review. However, the Solana program
                has NOT been formally audited by a third-party security firm.
                You use Pledge entirely at your own risk.
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>7. No Guarantees</Title3>
              <Body>
                {`Pledge is provided "as is" without warranties of any kind. We do not guarantee the security of funds, the availability of the service, or the correctness of the smart contract logic. Blockchain transactions are irreversible — once your stake is forfeited or settled, it cannot be undone.`}
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>8. Use at Your Own Risk</Title3>
              <Body>
                By using Pledge, you acknowledge that you understand the risks
                of interacting with blockchain-based applications, including but
                not limited to: loss of funds due to bugs, network issues, or
                wallet compromise. You are solely responsible for safeguarding
                your wallet and private keys.
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>9. Changes</Title3>
              <Body>
                We may update these terms at any time. Continued use of the app
                after changes constitutes acceptance of the updated terms.
                Material changes will be communicated through the app.
              </Body>
            </Column>
          </Column>
        </TrackedScrollView>
      </Column>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
