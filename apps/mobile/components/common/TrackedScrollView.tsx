import { useRef, useCallback } from 'react';
import { ScrollView, ScrollViewProps, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useScrollContext } from '../../contexts/ScrollContext';

interface TrackedScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
}

export function TrackedScrollView({
  children,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  ...props
}: TrackedScrollViewProps) {
  const { setScrolling } = useScrollContext();
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScrollBeginDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      setScrolling(true);
      onScrollBeginDrag?.(e);
    },
    [setScrolling, onScrollBeginDrag],
  );

  const handleScrollEnd = useCallback(() => {
    // Small delay to prevent flickering when momentum continues
    scrollTimeout.current = setTimeout(() => {
      setScrolling(false);
    }, 0);
  }, [setScrolling]);

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // If no momentum, end immediately
      if (!e.nativeEvent.velocity || (e.nativeEvent.velocity.y === 0 && e.nativeEvent.velocity.x === 0)) {
        handleScrollEnd();
      }
      onScrollEndDrag?.(e);
    },
    [handleScrollEnd, onScrollEndDrag],
  );

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScrollEnd();
      onMomentumScrollEnd?.(e);
    },
    [handleScrollEnd, onMomentumScrollEnd],
  );

  return (
    <ScrollView
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      scrollEventThrottle={16}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
