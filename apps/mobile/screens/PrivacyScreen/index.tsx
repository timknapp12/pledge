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

export const PrivacyScreen = () => {
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
          <Title1>Privacy Policy</Title1>
        </Row>

        <TrackedScrollView showsVerticalScrollIndicator={false}>
          <Column gap={20}>
            <Body>Last updated: March 2026</Body>

            <Column gap={8}>
              <Title3>1. What We Collect</Title3>
              <Body>
                Pledge collects the following data when you use the app:{'\n\n'}
                • Wallet address: Your Solana wallet public key, used to
                identify your account and interact with the blockchain.{'\n'}•
                Usage data: Pledges you create, tasks you check off, completion
                reports, and general app usage patterns.{'\n'}• Device timezone
                and language: Detected automatically to provide localized dates
                and content.{'\n'}• Push notification token: Only if you opt in
                to notifications. Used to send reminders about your pledges.
                {'\n'}• Preferences: Your chosen language and personality
                setting (carrot/stick).
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>2. How We Store Your Data</Title3>
              <Body>
                Your data is stored securely in a Supabase database with
                row-level security enabled. Each user can only access their own
                data. Authentication is handled through Sign In With Solana
                (SIWS) — we never have access to your private keys or seed
                phrase.
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>3. We Do NOT Sell Your Data</Title3>
              <Body>
                Pledge does not sell, rent, or share your personal data with
                third parties for marketing or advertising purposes. Your data
                is used solely to operate the app and provide you with the
                Pledge experience.
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>4. On-Chain Data</Title3>
              <Body>
                {`Pledge stakes and settlements occur on the Solana blockchain. On-chain transactions are public by nature — anyone can view your wallet's transaction history on a block explorer. This is inherent to blockchain technology and not controlled by Pledge.`}
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>5. Push Notifications</Title3>
              <Body>
                {`If you enable push notifications, we store your device's push token to send reminders about your pledges (daily reminders, deadline alerts). You can disable notifications at any time in your device settings or in the app, and we will stop sending them and delete your push token.`}
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>6. Data Deletion</Title3>
              <Body>
                You can request deletion of your account and all associated data
                at any time by contacting us. Upon request, we will delete your
                user record, pledge history, daily progress, preferences, and
                push notification tokens from our database. Note that on-chain
                transactions cannot be deleted as they are permanently recorded
                on the Solana blockchain.
              </Body>
            </Column>

            <Column gap={8}>
              <Title3>7. Changes</Title3>
              <Body>
                We may update this privacy policy as the app evolves. Continued
                use of the app after changes constitutes acceptance. We will
                notify users of material changes through the app.
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
