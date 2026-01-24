import { useRef, useEffect } from 'react';
import { Animated, Pressable, LayoutChangeEvent } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import styled, { useTheme } from 'styled-components/native';
import { useThemeMode, ThemeMode } from '../../theme/ThemeProvider';

const OPTIONS: { mode: ThemeMode; icon: 'sun-o' | 'moon-o' | 'cog' }[] = [
  { mode: 'light', icon: 'sun-o' },
  { mode: 'dark', icon: 'moon-o' },
  { mode: 'system', icon: 'cog' },
];

export function ThemeSelector() {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const segmentWidth = useRef(0);

  const selectedIndex = OPTIONS.findIndex((o) => o.mode === mode);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedIndex * segmentWidth.current,
      useNativeDriver: true,
      damping: 15,
      stiffness: 150,
    }).start();
  }, [selectedIndex, slideAnim]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    segmentWidth.current = width / OPTIONS.length;
    // Set initial position without animation
    slideAnim.setValue(selectedIndex * segmentWidth.current);
  };

  return (
    <Container onLayout={handleLayout}>
      <Pill
        style={{
          transform: [{ translateX: slideAnim }],
          width: `${100 / OPTIONS.length}%`,
        }}
      />
      {OPTIONS.map((option) => (
        <Segment key={option.mode} onPress={() => setMode(option.mode)}>
          <FontAwesome
            name={option.icon}
            size={20}
            color={
              mode === option.mode
                ? theme.colors.background
                : theme.colors.textSecondary
            }
          />
        </Segment>
      ))}
    </Container>
  );
}

const Container = styled.View`
  flex-direction: row;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-bottom-right-radius: 20px;
  border-top-left-radius: 4px;
  border-top-right-radius: 20px;
  border-bottom-left-radius: 4px;
  padding: 4px;
  position: relative;
`;

const PillBase = styled.View`
  position: absolute;
  top: 4px;
  left: 4px;
  bottom: 4px;
  background-color: ${(props) => props.theme.colors.primary};
  border-bottom-right-radius: 16px;
  border-top-left-radius: 2px;
  border-top-right-radius: 16px;
  border-bottom-left-radius: 2px;
`;

const Pill = Animated.createAnimatedComponent(PillBase);

const Segment = styled(Pressable)`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  z-index: 1;
`;
