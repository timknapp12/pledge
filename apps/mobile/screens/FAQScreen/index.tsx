import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Title1,
  ScreenContainer,
  Column,
  Row,
  TrackedScrollView,
} from '@/components';
import { FAQItem } from './FAQItem';

const FAQ_ITEMS = [
  {
    question: 'What happens to my USDC when I create a pledge?',
    answer: 'Your USDC is transferred to a secure vault on the Solana blockchain. It stays there until you report your completion or the deadline passes. If you complete 100%, you get it all back with no fees.',
  },
  {
    question: 'What if I only partially complete my goal?',
    answer: 'You get back a proportional amount minus a 1% fee. For example, if you staked $10 and completed 50%, you get back $4.95 (50% minus 1% fee). The rest goes to the treasury and charity split.',
  },
  {
    question: 'What happens if I forget to report?',
    answer: 'After your deadline plus a 24-hour grace period, our crank service will automatically process your pledge based on the tasks you checked off. So make sure to check off your tasks daily!',
  },
  {
    question: 'What are daily tasks vs one-time tasks?',
    answer: 'Daily tasks repeat on your chosen schedule — every day, weekdays, weekends, or custom days. One-time tasks (goals) are things you complete once during your pledge period. You can mix both types in a single pledge.',
  },
  {
    question: 'Can I edit a pledge after creating it?',
    answer: 'Yes, you can edit your pledge name, tasks, and schedule before the deadline with no penalty. However, you cannot change the stake amount or deadline once the pledge is created on-chain.',
  },
  {
    question: 'What is the grace period?',
    answer: 'After your deadline passes, you have a 24-hour grace period to self-report your completion percentage. This gives you the most accurate result. After the grace period, the crank service settles your pledge automatically based on checked-off tasks.',
  },
  {
    question: 'Where do forfeited funds go?',
    answer: 'Forfeited funds are split between the Pledge treasury and a charity wallet. 30% of all forfeited funds go to a non-profit organization. The split is configured on-chain and fully transparent.',
  },
  {
    question: 'Is Pledge safe to use?',
    answer: 'Pledge is open-source software — all code is publicly available for review. However, the smart contracts have NOT been formally audited by a third-party security firm. You use Pledge at your own risk. Never stake more than you can afford to lose.',
  },
  {
    question: 'Which wallets work with Pledge?',
    answer: 'Pledge uses Mobile Wallet Adapter (MWA) for Solana. Compatible wallets include Phantom and Solflare on Android. You need a wallet that supports MWA to connect and sign transactions.',
  },
  {
    question: 'How can I contact the team?',
    answer: 'You can reach us through our Telegram community or follow us on X (Twitter). Links are available in the Terms & Conditions and Privacy Policy screens in Settings.',
  },
];

export const FAQScreen = () => {
  const { t } = useTranslation();
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
          <Title1>{t('FAQs')}</Title1>
        </Row>

        <TrackedScrollView showsVerticalScrollIndicator={false}>
          <Column gap={12}>
            {FAQ_ITEMS.map((item) => (
              <FAQItem
                key={item.question}
                question={item.question}
                answer={item.answer}
              />
            ))}
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
