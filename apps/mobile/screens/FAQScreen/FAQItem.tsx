import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Body, Row, Card } from '@/components';

interface FAQItemProps {
  question: string;
  answer: string;
}

export const FAQItem = ({ question, answer }: FAQItemProps) => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);

  const progress = useDerivedValue(() =>
    withTiming(isOpen ? 1 : 0, { duration: 300 }),
  );

  const bodyStyle = useAnimatedStyle(() => ({
    height: progress.value * contentHeight,
    opacity: progress.value,
    overflow: 'hidden' as const,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <Pressable onPress={() => setIsOpen((o) => !o)}>
      <Card style={styles.card}>
        <Row align='center' style={{ justifyContent: 'space-between' }}>
          <Body style={{ flex: 1, marginRight: 12, fontWeight: '600' }}>
            {t(question)}
          </Body>
          <Animated.View style={chevronStyle}>
            <Ionicons
              name='chevron-down'
              size={20}
              color={theme.colors.textSecondary}
            />
          </Animated.View>
        </Row>
        <Animated.View style={bodyStyle}>
          <Body
            style={{
              color: theme.colors.textSecondary,
              paddingTop: 12,
              lineHeight: 22,
            }}
          >
            {t(answer)}
          </Body>
        </Animated.View>
        {/* Hidden measurer — renders off-screen to capture content height */}
        <View style={styles.measurer} pointerEvents='none'>
          <Body
            onLayout={(e) => setContentHeight(e.nativeEvent.layout.height + 12)}
            style={{ lineHeight: 22, paddingTop: 12 }}
          >
            {t(answer)}
          </Body>
        </View>
      </Card>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  measurer: {
    position: 'absolute',
    opacity: 0,
    left: 16,
    right: 16,
  },
});
