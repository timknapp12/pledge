import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import {
  Body,
  BodySmall,
  BodySmallSecondary,
  Card,
  Row,
} from '@/components';
import type { PointEvent } from '@/hooks/useSupabase';

const EVENT_CONFIG: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; labelKey: string }
> = {
  pledge_created: { icon: 'add-circle', labelKey: 'Pledge Created' },
  pledge_completed: { icon: 'checkmark-circle', labelKey: 'Pledge Completed' },
  streak_bonus: { icon: 'flame', labelKey: 'Streak Bonus' },
  referral_signup: { icon: 'people', labelKey: 'Referral Signup' },
  referral_earning: { icon: 'gift', labelKey: 'Referral Earning' },
};

const formatEventDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

interface PointEventItemProps {
  event: PointEvent;
}

export const PointEventItem = ({ event }: PointEventItemProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();

  const config = EVENT_CONFIG[event.event_type] ?? {
    icon: 'ellipse' as const,
    labelKey: event.event_type,
  };

  return (
    <Card style={localStyles.card}>
      <Row justify='space-between' width='100%'>
        <Row gap={12} style={{ flex: 1 }}>
          <View
            style={[
              localStyles.iconCircle,
              { backgroundColor: `${theme.colors.primary}20` },
            ]}
          >
            <Ionicons
              name={config.icon}
              size={18}
              color={theme.colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Body>{t(config.labelKey)}</Body>
            <BodySmallSecondary>
              {formatEventDate(event.created_at)}
            </BodySmallSecondary>
          </View>
        </Row>
        <BodySmall
          style={{
            color: theme.colors.statusCompleted,
            fontWeight: '600',
          }}
        >
          +{event.points}
        </BodySmall>
      </Row>
    </Card>
  );
};

const localStyles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
