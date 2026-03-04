import { useRef, useCallback, useEffect } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { BodySmall } from './texts';
import { toLocalDateStr } from '@/hooks/useSupabase';

type DateCarouselProps = {
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (date: string) => void;
  style?: ViewStyle;
};

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    dates.push(toLocalDateStr(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function formatPillLabel(dateStr: string, t: (key: string) => string): string {
  const today = toLocalDateStr(new Date());
  if (dateStr === today) return t('Today');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === toLocalDateStr(yesterday)) return t('Yesterday');

  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${month} ${day}`;
}

export const DateCarousel = ({
  startDate,
  endDate,
  selectedDate,
  onSelectDate,
  style,
}: DateCarouselProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const listRef = useRef<FlatList>(null);

  const dates = generateDateRange(startDate, endDate);

  // Scroll to selected date on mount
  useEffect(() => {
    const index = dates.indexOf(selectedDate);
    if (index >= 0 && listRef.current) {
      // Small delay to ensure layout is ready
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0.5,
        });
      }, 100);
    }
  }, [selectedDate, dates]);

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      const isSelected = item === selectedDate;
      return (
        <Pressable
          onPress={() => onSelectDate(item)}
          style={[
            styles.pill,
            {
              backgroundColor: isSelected
                ? theme.colors.primary
                : theme.colors.cardBackground,
              borderColor: isSelected
                ? theme.colors.primary
                : theme.colors.border,
            },
          ]}
        >
          <BodySmall
            style={{
              color: isSelected
                ? theme.colors.buttonPrimaryText
                : theme.colors.textSecondary,
              fontWeight: isSelected ? '700' : '500',
            }}
          >
            {formatPillLabel(item, t)}
          </BodySmall>
        </Pressable>
      );
    },
    [selectedDate, onSelectDate, theme, t],
  );

  if (dates.length === 0) return null;

  return (
    <View style={style}>
      <FlatList
        ref={listRef}
        data={dates}
        renderItem={renderItem}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScrollToIndexFailed={() => {
          listRef.current?.scrollToEnd({ animated: false });
        }}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  listContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
