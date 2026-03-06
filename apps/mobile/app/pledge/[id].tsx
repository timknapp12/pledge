import { ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '@/theme/ThemeProvider';
import { usePledge, getEffectiveStatus } from '@/hooks/useSupabase';
import { ScreenContainer } from '@/components';
import { PledgeDetailScreen } from '@/screens/PledgeDetailScreen';
import { FinishedPledgeDetailScreen } from '@/screens/FinishedPledgeDetailScreen';

const PledgeDetail = () => {
  const { theme } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: pledge, isLoading } = usePledge(id);

  if (isLoading || !pledge) {
    return (
      <ScreenContainer>
        <ActivityIndicator size='large' color={theme.colors.primary} />
      </ScreenContainer>
    );
  }

  const status = getEffectiveStatus(pledge);
  const isFinished = status === 'Completed' || status === 'Forfeited' || status === 'Expired';

  if (isFinished) {
    return <FinishedPledgeDetailScreen />;
  }

  return <PledgeDetailScreen />;
};

export default PledgeDetail;
