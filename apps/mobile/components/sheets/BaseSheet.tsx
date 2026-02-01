import { forwardRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useThemeMode } from '@/theme/ThemeProvider';

interface BaseSheetProps {
  title?: string;
  snapPoints?: (string | number)[];
  children: React.ReactNode;
  onClose?: () => void;
}

// Colors outside of styled-components context (for Portal)
const COLORS = {
  light: {
    background: '#F5F5F5',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E0E0E0',
  },
  dark: {
    background: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
  },
};

export const BaseSheet = forwardRef<BottomSheet, BaseSheetProps>(
  ({ title, snapPoints = ['50%'], children, onClose }, ref) => {
    const { isDark } = useThemeMode();
    const colors = isDark ? COLORS.dark : COLORS.light;

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
          pressBehavior="close"
        />
      ),
      [],
    );

    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index === -1 && onClose) {
          onClose();
        }
      },
      [onClose],
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        onChange={handleSheetChanges}
        backgroundStyle={{
          backgroundColor: colors.background,
        }}
        handleIndicatorStyle={{
          backgroundColor: colors.textSecondary,
          width: 40,
        }}
      >
        <BottomSheetView style={[styles.content, { backgroundColor: colors.background }]}>
          {title && (
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            </View>
          )}
          {children}
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

BaseSheet.displayName = 'BaseSheet';

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 0,
  },
  header: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
});
