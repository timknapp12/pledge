import { ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '@/theme/ThemeProvider';
import {
  usePledge,
  useDailyProgress,
  getEffectiveStatus,
  calculateCompletionPercentage,
} from '@/hooks/useSupabase';
import { ScreenContainer } from '@/components';
import { PledgeDetailScreen } from '@/screens/PledgeDetailScreen';
import { FinishedPledgeDetailScreen } from '@/screens/FinishedPledgeDetailScreen';

const PledgeDetail = () => {
  const { theme } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: pledge, isLoading } = usePledge(id);
  // Progress is only needed to distinguish AwaitingClaim from Expired
  // when the DB status is still Active. Fetch unconditionally — useDailyProgress
  // is a no-op until pledgeId resolves.
  const { data: progressRows, isLoading: progressLoading } = useDailyProgress(
    pledge?.status === 'Active' ? id : null,
  );

  if (isLoading || !pledge || progressLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size='large' color={theme.colors.primary} />
      </ScreenContainer>
    );
  }

  const completionPct =
    pledge.status === 'Active'
      ? calculateCompletionPercentage(
          pledge.todos,
          pledge.goals_completed,
          progressRows ?? [],
          new Date(pledge.start_date),
          new Date(pledge.end_date),
        )
      : pledge.completion_percentage ?? 0;

  const status = getEffectiveStatus(pledge, completionPct);
  const isFinished =
    status === 'Completed' || status === 'Forfeited' || status === 'Expired';

  if (isFinished) {
    return <FinishedPledgeDetailScreen />;
  }

  return <PledgeDetailScreen />;
};

export default PledgeDetail;
