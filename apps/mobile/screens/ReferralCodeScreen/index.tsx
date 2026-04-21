import { useState } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Title1,
  Body,
  BodySecondary,
  BodySmallSecondary,
  ScreenContainer,
  CenteredColumn,
  Column,
  Card,
  Gap,
  PrimaryButton,
  SecondaryButton,
  useAlert,
} from '@/components';
import { useSubmitReferralCode } from '@/hooks/useSupabase';

export const ReferralCodeScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();
  const { alert } = useAlert();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const submitReferral = useSubmitReferralCode();

  const handleTextChange = (text: string) => {
    setCode(text);
    if (error) setError('');
  };

  const handleSubmit = async () => {
    if (!code.trim()) return;

    try {
      await submitReferral.mutateAsync(code);
      alert({
        title: t('Success'),
        message: t('Referral code applied! You both earned 25 points.'),
        buttons: [
          {
            text: t('OK'),
            onPress: () => router.back(),
          },
        ],
      });
    } catch (err) {
      console.error('Referral code error:', err);
      const raw = err instanceof Error ? err.message : '';
      // Map known referral errors to user-friendly messages
      let message: string;
      if (raw.includes('already used') || raw.includes('already_used')) {
        message = t('You have already used a referral code.');
      } else if (raw.includes('own code') || raw.includes('own_code') || raw.includes('self')) {
        message = t("You can't use your own referral code.");
      } else if (raw.includes('not found') || raw.includes('invalid')) {
        message = t('Invalid referral code. Please check and try again.');
      } else {
        message = t('Something went wrong. Please try again.');
      }
      setError(message);
    }
  };

  const handleSkip = () => {
    router.back();
  };

  return (
    <ScreenContainer>
      <CenteredColumn
        flex={1}
        gap={24}
        style={{
          justifyContent: 'space-between',
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        <Ionicons name='people' size={64} color={theme.colors.primary} />

        <Title1 style={{ textAlign: 'center' }}>
          {t('Have a Referral Code?')}
        </Title1>

        <BodySecondary style={{ textAlign: 'center' }}>
          {t(
            "Enter a friend's referral code and you'll both earn bonus points!",
          )}
        </BodySecondary>

        <Card style={{ width: '100%' }}>
          <Column gap={16}>
            <Body>{t('Referral Code')}</Body>
            <TextInput
              style={[
                localStyles.input,
                {
                  color: theme.colors.text,
                  borderColor: error
                    ? theme.colors.error
                    : theme.colors.border,
                  backgroundColor: theme.colors.cardBackground,
                },
              ]}
              value={code}
              onChangeText={handleTextChange}
              placeholder={t('Enter code')}
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize='none'
              autoCorrect={false}
              maxLength={6}
            />
            {error ? (
              <BodySmallSecondary
                style={{ textAlign: 'center', color: theme.colors.error }}
              >
                {t(error)}
              </BodySmallSecondary>
            ) : (
              <BodySmallSecondary style={{ textAlign: 'center' }}>
                {t('You can only use one referral code')}
              </BodySmallSecondary>
            )}
          </Column>
        </Card>

        <Gap gap={8} />

        <Column gap={12} style={{ width: '100%' }}>
          <PrimaryButton
            onPress={handleSubmit}
            disabled={!code.trim() || submitReferral.isPending}
          >
            {submitReferral.isPending ? t('Submitting...') : t('Apply Code')}
          </PrimaryButton>
          <SecondaryButton onPress={handleSkip}>{t('Skip')}</SecondaryButton>
        </Column>
      </CenteredColumn>
    </ScreenContainer>
  );
};

const localStyles = StyleSheet.create({
  input: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
    fontFamily: 'SpaceMono',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
});
