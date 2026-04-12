import { Pressable, StyleSheet, Linking } from 'react-native';
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
  Body,
} from '@/components';
import { FAQItem } from './FAQItem';

const FAQ_ITEMS = [
  {
    question: 'What happens to my USDC when I create a pledge?',
    answer:
      'Your USDC is transferred to a secure vault on the Solana blockchain. It stays there until you report your completion or the deadline passes. If you complete 100%, you get it all back with no fees.',
  },
  {
    question: 'What if I only partially complete my goal?',
    answer:
      'You get back a proportional amount minus a 1% fee. For example, if you staked $10 and completed 50%, you get back $4.95 (50% minus 1% fee). The rest goes to the treasury and charity split.',
  },
  {
    question: 'What happens if I forget to report?',
    answer:
      'We give you a 24-hour grace period to report your daily tasks — so if you forget today, you can still do it tomorrow. Once your pledge deadline is reached, you also get a 24-hour grace period to report your final results and claim your tokens.',
  },
  {
    question:
      'How long do I have to claim my tokens after the pledge deadline?',
    answer:
      "You can settle anytime, though early settling may cost you points and tokens if you have unfinished tasks. If your pledge is 100% complete, you have up to 6 months to claim your tokens. If it's less than 100%, Pledge will automatically settle for you 24 hours after the deadline.",
  },
  {
    question: 'What are daily tasks vs one-time tasks?',
    answer:
      'Daily tasks repeat on your chosen schedule — every day, weekdays, weekends, or custom days. One-time tasks (goals) are things you check off just once during your pledge period. You can mix both types in a single pledge.',
  },
  {
    question: 'Can I edit a pledge after creating it?',
    answer:
      'Yes, you can edit your pledge name, tasks, and schedule before the deadline with no penalty. However, you cannot change the stake amount or deadline once the pledge is created on-chain.',
  },
  {
    question:
      "If it is self-reporting, can't I just cheat and always get all my tokens back?",
    answer:
      'Yes, the purpose of Pledge is not to force you to be honest with yourself. It is to be a reliable companion that reminds you and holds you accountable for reporting your own goals.',
  },
  {
    question: 'Where do forfeited funds go?',
    answer: 'forfeited_funds_answer', // Will be replaced in component
  },
  {
    question: 'Is Pledge safe to use?',
    answer:
      'Pledge is open-source software — all code is publicly available for review. However, the smart contracts have NOT been formally audited by a third-party security firm. You use Pledge at your own risk. Never stake more than you can afford to lose.',
  },
  {
    question:
      "This app is stupid. I don't need to use this to complete my goals.",
    answer:
      'First of all, that was not a question. Second of all, no one is forcing you to use it. So feel free to not use Pledge and go do 1,000 push-ups, David Goggins.',
  },
  {
    question: 'Are these really the most frequently asked questions?',
    answer:
      'Absolutely not! We made these before we had any users! So let us know your questions and we can update these.',
  },
  {
    question: 'How can I contact the team?',
    answer: 'contact_team_answer', // Will be replaced in component
  },
];

export const FAQScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();

  const forfeitedAnswerJSX = (
    <Column gap={4}>
      <Body style={{ color: theme.colors.textSecondary, lineHeight: 22 }}>
        Forfeited funds are split between the Pledge treasury and a charity
        wallet. 30% of all forfeited funds go to a non-profit organization. The
        split is configured on-chain and fully transparent.
      </Body>
      <Pressable
        onPress={() => Linking.openURL('https://lighthouse-lodge.com')}
        style={{ marginTop: 8 }}
      >
        <Body
          style={{
            color: theme.colors.primary,
            textDecorationLine: 'underline',
          }}
        >
          {t('Learn more about the charity')}
        </Body>
      </Pressable>
    </Column>
  );

  const contactTeamAnswerJSX = (
    <Column gap={4}>
      <Body style={{ color: theme.colors.textSecondary, lineHeight: 22 }}>
        {t(
          'You can reach us through our Telegram community or follow us on X (Twitter).',
        )}
      </Body>
      <Column gap={8} style={{ marginTop: 8 }}>
        <Pressable
          onPress={() => Linking.openURL('https://t.me/pledgesolanacommunity')}
        >
          <Body
            style={{
              color: theme.colors.primary,
              textDecorationLine: 'underline',
            }}
          >
            {t('Join on Telegram')}
          </Body>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL('https://x.com/pledgesolana')}
        >
          <Body
            style={{
              color: theme.colors.primary,
              textDecorationLine: 'underline',
            }}
          >
            {t('Follow on X')}
          </Body>
        </Pressable>
      </Column>
    </Column>
  );

  const itemsWithForfeiture = FAQ_ITEMS.map((item) =>
    item.question === 'Where do forfeited funds go?'
      ? { ...item, answer: forfeitedAnswerJSX }
      : item.question === 'How can I contact the team?'
      ? { ...item, answer: contactTeamAnswerJSX }
      : item,
  );

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
            {itemsWithForfeiture.map((item) => (
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
