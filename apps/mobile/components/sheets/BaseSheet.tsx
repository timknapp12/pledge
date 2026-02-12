import { forwardRef, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useThemeMode } from '@/theme/ThemeProvider';
import { SHEET_COLORS } from '@/theme/colors';

interface BaseSheetProps {
  title?: string;
  /** When true (default), sheet height follows content. When false, use snapPoints for fixed height. */
  enableDynamicSizing?: boolean;
  snapPoints?: (string | number)[];
  children: React.ReactNode;
  onClose?: () => void;
}

export const BaseSheet = forwardRef<BottomSheet, BaseSheetProps>(
  (
    {
      title,
      enableDynamicSizing = true,
      snapPoints = ['50%'],
      children,
      onClose,
    },
    ref
  ) => {
    const { isDark } = useThemeMode();
    const { height: windowHeight } = useWindowDimensions();
    const colors = isDark ? SHEET_COLORS.dark : SHEET_COLORS.light;

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
          pressBehavior='close'
        />
      ),
      []
    );

    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index === -1 && onClose) {
          onClose();
        }
      },
      [onClose]
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={enableDynamicSizing ? undefined : snapPoints}
        enablePanDownToClose
        enableDynamicSizing={enableDynamicSizing}
        maxDynamicContentSize={
          enableDynamicSizing ? windowHeight * 0.9 : undefined
        }
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
        <BottomSheetView
          style={[
            styles.content,
            { backgroundColor: colors.background },
            enableDynamicSizing && styles.contentDynamic,
          ]}
        >
          {title && (
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>
                {title}
              </Text>
            </View>
          )}
          {children}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

BaseSheet.displayName = 'BaseSheet';

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 40,
    paddingTop: 0,
  },
  contentDynamic: {
    flex: 0,
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
