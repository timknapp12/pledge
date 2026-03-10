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
