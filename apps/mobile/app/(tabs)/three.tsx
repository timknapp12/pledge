import { useTranslation } from 'react-i18next';
import { Title2, ScreenContainer } from '@/components';

export default function TabThreeScreen() {
  const { t } = useTranslation();

  return (
    <ScreenContainer>
      <Title2>{t('Profile')}</Title2>
    </ScreenContainer>
  );
}
