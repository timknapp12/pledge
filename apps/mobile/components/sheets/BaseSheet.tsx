import {
  forwardRef,
  useCallback,
  useRef,
  useImperativeHandle,
  type RefObject,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetFooter,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import { useThemeMode } from '@/theme/ThemeProvider';
import { SHEET_COLORS } from '@/theme/colors';

interface BaseSheetProps {
  title?: string;
  /** When true (default), sheet height follows content. When false, use snapPoints for fixed height. */
  enableDynamicSizing?: boolean;
  snapPoints?: (string | number)[];
  children: React.ReactNode;
  onClose?: () => void;
  /** Called when sheet opens (index >= 0). Use to defer mounting heavy/picker content and avoid Android auto-open. */
  onOpen?: () => void;
  style?: StyleProp<ViewStyle>;
  /** When true, uses BottomSheetScrollView as direct child of BottomSheet (required for scrollable content with fixed snap points). */
  scrollable?: boolean;
  /** Render a sticky footer at the bottom of the sheet (e.g. a Save button). Only works with scrollable sheets. */
  renderFooter?: () => React.ReactNode;
  /** Ref to the inner BottomSheetScrollView (only available when scrollable=true). */
  scrollViewRef?: RefObject<BottomSheetScrollViewMethods | null>;
}

export const BaseSheet = forwardRef<BottomSheet, BaseSheetProps>(
  (
    {
      title,
      enableDynamicSizing = true,
      snapPoints = ['50%'],
      children,
      onClose,
      onOpen,
      style,
      scrollable = false,
      renderFooter,
      scrollViewRef,
    },
    ref,
  ) => {
    const { isDark } = useThemeMode();
    const { height: windowHeight } = useWindowDimensions();
    const colors = isDark ? SHEET_COLORS.dark : SHEET_COLORS.light;

    const innerRef = useRef<BottomSheet>(null);
    const userTriggered = useRef(false);

    // Wrap the ref so we can track user-initiated opens vs Android auto-opens.
    // Only expand/snapToIndex called via the ref set the flag; spurious opens
    // from the library (common on Android re-renders) get force-closed.
    useImperativeHandle(
      ref,
      () =>
        ({
          expand: () => {
            userTriggered.current = true;
            innerRef.current?.expand();
          },
          snapToIndex: (index: number) => {
            userTriggered.current = true;
            innerRef.current?.snapToIndex(index);
          },
          close: () => {
            innerRef.current?.close();
          },
          collapse: () => {
            innerRef.current?.collapse();
          },
          forceClose: () => {
            innerRef.current?.forceClose();
          },
        } as unknown as BottomSheet),
    );

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
      [],
    );

    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index >= 0 && !userTriggered.current) {
          // Spurious auto-open (Android bug) — force close
          innerRef.current?.close();
          return;
        }
        if (index === -1) {
          userTriggered.current = false;
          onClose?.();
        } else if (index >= 0) {
          onOpen?.();
        }
      },
      [onClose, onOpen],
    );

    const footerComponent = renderFooter
      ? (props: any) => (
          <BottomSheetFooter {...props}>
            <View
              style={[
                styles.footerContainer,
                { backgroundColor: colors.background },
              ]}
            >
              {renderFooter()}
            </View>
          </BottomSheetFooter>
        )
      : undefined;

    const titleElement = title ? (
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
    ) : null;

    return (
      <BottomSheet
        ref={innerRef}
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
        footerComponent={footerComponent}
      >
        {scrollable ? (
          <>
            <View
              style={[
                styles.scrollHeader,
                { backgroundColor: colors.background },
              ]}
            >
              {titleElement}
            </View>
            <BottomSheetScrollView
              ref={scrollViewRef}
              style={[{ backgroundColor: colors.background }, style]}
              contentContainerStyle={[
                styles.scrollContent,
                renderFooter && styles.scrollContentWithFooter,
              ]}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </BottomSheetScrollView>
          </>
        ) : (
          <BottomSheetView
            style={[
              styles.content,
              { backgroundColor: colors.background },
              enableDynamicSizing && styles.contentDynamic,
              style,
            ]}
          >
            {titleElement}
            {children}
          </BottomSheetView>
        )}
      </BottomSheet>
    );
  },
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
  scrollHeader: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  scrollContentWithFooter: {
    paddingBottom: 80,
  },
  footerContainer: {
    padding: 20,
    paddingTop: 12,
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
