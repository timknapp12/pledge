import { forwardRef, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Keyboard } from 'react-native';
import BottomSheet, { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '@/theme/ThemeProvider';
import { SHEET_COLORS } from '@/theme/colors';
import { BaseSheet } from './BaseSheet';
import { RoundButton, Row } from '../common';

interface SaveTemplateSheetProps {
  defaultName?: string;
  onSave: (name: string) => void;
  onClose?: () => void;
}

export const SaveTemplateSheet = forwardRef<BottomSheet, SaveTemplateSheetProps>(
  ({ defaultName = '', onSave, onClose }, ref) => {
    const { t } = useTranslation();
    const { isDark } = useThemeMode();
    const colors = isDark ? SHEET_COLORS.dark : SHEET_COLORS.light;

    const [name, setName] = useState(defaultName);
    const [hasBeenOpened, setHasBeenOpened] = useState(false);
    const isOpen = useRef(false);

    useEffect(() => {
      setName(defaultName);
    }, [defaultName]);

    // Snap sheet back to original position when keyboard dismisses,
    // but only if this sheet is actually open.
    useEffect(() => {
      const sub = Keyboard.addListener('keyboardDidHide', () => {
        if (isOpen.current && ref && 'current' in ref && ref.current) {
          ref.current.snapToIndex(0);
        }
      });
      return () => sub.remove();
    }, [ref]);

    const closeSheet = useCallback(() => {
      isOpen.current = false;
      Keyboard.dismiss();
      if (ref && 'current' in ref && ref.current) {
        ref.current.close();
      }
    }, [ref]);

    const handleSave = useCallback(() => {
      const trimmed = name.trim();
      if (!trimmed) return;
      onSave(trimmed);
      closeSheet();
    }, [name, onSave, closeSheet]);

    return (
      <BaseSheet
        ref={ref}
        title={t('Save Template')}
        enableDynamicSizing={false}
        snapPoints={['35%']}
        onClose={() => {
          isOpen.current = false;
          setName('');
          Keyboard.dismiss();
          onClose?.();
        }}
        onOpen={() => {
          isOpen.current = true;
          setHasBeenOpened(true);
        }}
      >
        {hasBeenOpened && (
          <View style={localStyles.container}>
            <View
              style={[localStyles.inputRow, { borderColor: colors.border }]}
            >
              <BottomSheetTextInput
                style={[localStyles.input, { color: colors.text }]}
                value={name}
                onChangeText={setName}
                placeholder={t('Template name')}
                placeholderTextColor={colors.textSecondary}
                selectionColor={colors.primary}
                autoFocus
              />
            </View>

            <Text style={[localStyles.hint, { color: colors.textSecondary }]}>
              {t('Save your tasks and schedule as a reusable template')}
            </Text>

            <Row>
              <RoundButton
                variant='secondary'
                icon='close'
                onPress={closeSheet}
              />
              <RoundButton
                icon='checkmark'
                onPress={handleSave}
                disabled={!name.trim()}
              />
            </Row>
          </View>
        )}
      </BaseSheet>
    );
  }
);

SaveTemplateSheet.displayName = 'SaveTemplateSheet';

const localStyles = StyleSheet.create({
  container: {
    gap: 16,
  },
  inputRow: {
    borderBottomWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  input: {
    fontSize: 18,
    fontWeight: '500',
    padding: 0,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
  },
});
