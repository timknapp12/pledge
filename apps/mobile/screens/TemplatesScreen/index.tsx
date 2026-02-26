import { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useTemplates,
  useDeleteTemplate,
  getTotalTaskCount,
} from '@/hooks/useSupabase';
import {
  Title1,
  Title3,
  Body,
  BodySecondary,
  BodySmall,
  ScreenContainer,
  CenteredColumn,
  Column,
  Row,
  Card,
  TrackedScrollView,
  useAlert,
} from '@/components';

const DURATION_LABELS: Record<string, string> = {
  '1day': '1 Day',
  '1week': '1 Week',
  '1month': '1 Month',
};

export const TemplatesScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();
  const { alert } = useAlert();
  const { data: templates, isLoading } = useTemplates();
  const deleteTemplate = useDeleteTemplate();

  const handleUseTemplate = useCallback(
    (templateId: string) => {
      router.push(`/create-pledge?templateId=${templateId}`);
    },
    [router]
  );

  const handleDelete = useCallback(
    (templateId: string, templateName: string) => {
      alert({
        title: t('Delete Template'),
        message: `${t('Delete')} "${templateName}"?`,
        buttons: [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Delete'),
            style: 'destructive',
            onPress: () => deleteTemplate.mutate(templateId),
          },
        ],
      });
    },
    [t, deleteTemplate, alert]
  );

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Column
        style={{ justifyContent: 'space-between', flex: 1, width: '100%' }}
      >
        <CenteredColumn flex={1} gap={24}>
          {/* Header */}
          <Row gap={16} width='100%' justify='flex-start'>
            <Pressable
              onPress={() => router.back()}
              style={[
                localStyles.backButton,
                { backgroundColor: theme.colors.cardBackground },
              ]}
            >
              <Ionicons name='arrow-back' size={24} color={theme.colors.text} />
            </Pressable>
            <Title1>{t('Templates')}</Title1>
          </Row>

          {isLoading ? (
            <CenteredColumn flex={1} justify='center'>
              <BodySecondary>{t('Loading...')}</BodySecondary>
            </CenteredColumn>
          ) : !templates || templates.length === 0 ? (
            <CenteredColumn
              flex={1}
              gap={12}
              style={{ justifyContent: 'center' }}
            >
              <Ionicons
                name='documents-outline'
                size={48}
                color={theme.colors.textSecondary}
              />
              <Body style={{ color: theme.colors.textSecondary }}>
                {t('No templates yet')}
              </Body>
              <BodySecondary style={{ textAlign: 'center' }}>
                {t('Save a template when creating a pledge to reuse it later')}
              </BodySecondary>
            </CenteredColumn>
          ) : (
            <TrackedScrollView showsVerticalScrollIndicator={false}>
              <Column gap={12} flex={1}>
                {templates.map((template) => (
                  <Card key={template.id}>
                    <Pressable
                      style={localStyles.templateRow}
                      onPress={() => handleUseTemplate(template.id)}
                    >
                      <Column flex={1} gap={4} width='auto'>
                        <Title3 numberOfLines={1}>{template.name}</Title3>
                        <Row gap={8} width='auto'>
                          <BodySmall
                            style={{ color: theme.colors.textSecondary }}
                          >
                            {getTotalTaskCount(template.todos)}{' '}
                            {t('tasks')}
                          </BodySmall>
                          <BodySmall
                            style={{ color: theme.colors.textSecondary }}
                          >
                            ·
                          </BodySmall>
                          <BodySmall
                            style={{ color: theme.colors.textSecondary }}
                          >
                            {t(
                              DURATION_LABELS[template.default_timeframe] ??
                                template.default_timeframe
                            )}
                          </BodySmall>
                        </Row>
                      </Column>
                      <Row gap={12} width='auto'>
                        <Pressable
                          onPress={() =>
                            handleDelete(template.id, template.name)
                          }
                          hitSlop={8}
                        >
                          <Ionicons
                            name='trash-outline'
                            size={18}
                            color={theme.colors.error}
                          />
                        </Pressable>
                        <Ionicons
                          name='chevron-forward'
                          size={16}
                          color={theme.colors.textSecondary}
                        />
                      </Row>
                    </Pressable>
                  </Card>
                ))}
              </Column>
            </TrackedScrollView>
          )}
        </CenteredColumn>
      </Column>
    </ScreenContainer>
  );
};

const localStyles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
