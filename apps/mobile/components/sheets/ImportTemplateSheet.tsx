import { forwardRef, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '@/theme/ThemeProvider';
import { SHEET_COLORS } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { BaseSheet } from './BaseSheet';
import { type Template, getTotalTaskCount } from '@/hooks/useSupabase';

interface ImportTemplateSheetProps {
  templates: Template[];
  onSelect: (templateId: string) => void;
  onClose?: () => void;
}

export const ImportTemplateSheet = forwardRef<
  BottomSheet,
  ImportTemplateSheetProps
>(({ templates, onSelect, onClose }, ref) => {
  const { t } = useTranslation();
  const { isDark } = useThemeMode();
  const colors = isDark ? SHEET_COLORS.dark : SHEET_COLORS.light;

  const closeSheet = useCallback(() => {
    if (ref && 'current' in ref && ref.current) {
      ref.current.close();
    }
  }, [ref]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      closeSheet();
    },
    [onSelect, closeSheet],
  );

  return (
    <BaseSheet
      ref={ref}
      title={t('Choose a Template')}
      enableDynamicSizing={false}
      snapPoints={['50%']}
      onClose={onClose}
    >
      <View style={localStyles.container}>
        {templates.map((template) => {
          const taskCount = template.todos
            ? getTotalTaskCount(template.todos)
            : 0;
          return (
            <Pressable
              key={template.id}
              style={[
                localStyles.templateCard,
                { borderColor: colors.border },
              ]}
              onPress={() => handleSelect(template.id)}
            >
              <View style={localStyles.cardContent}>
                <Ionicons
                  name='documents-outline'
                  size={20}
                  color={colors.primary}
                />
                <View style={localStyles.cardText}>
                  <Text
                    style={[localStyles.templateName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {template.name}
                  </Text>
                  <Text
                    style={[
                      localStyles.templateMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {taskCount} {t('tasks')}
                  </Text>
                </View>
                <Ionicons
                  name='chevron-forward'
                  size={16}
                  color={colors.textSecondary}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </BaseSheet>
  );
});

ImportTemplateSheet.displayName = 'ImportTemplateSheet';

const localStyles = StyleSheet.create({
  container: {
    gap: 8,
  },
  templateCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
  },
  templateMeta: {
    fontSize: 13,
  },
});
