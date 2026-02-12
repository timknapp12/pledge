import { View, ViewProps, StyleSheet } from 'react-native';
import { useAppTheme } from '@/theme/ThemeProvider';
import { cardBorderRadius } from '@/theme';

interface GapViewProps extends ViewProps {
  gap?: number;
  padding?: number;
  width?: string;
}

export function ScreenContainer({ style, ...props }: ViewProps) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.screenContainer,
        { backgroundColor: theme.colors.background },
        style,
      ]}
      {...props}
    />
  );
}

export function Column({ gap, padding, width, style, ...props }: GapViewProps) {
  return (
    <View
      style={[
        styles.column,
        gap !== undefined && { gap },
        padding !== undefined && { padding },
        width !== undefined && { width: width as any },
        style,
      ]}
      {...props}
    />
  );
}

export function CenteredColumn({
  gap,
  padding,
  width,
  style,
  ...props
}: GapViewProps) {
  return (
    <View
      style={[
        styles.centeredColumn,
        gap !== undefined && { gap },
        padding !== undefined && { padding },
        width !== undefined && { width: width as any },
        style,
      ]}
      {...props}
    />
  );
}

type FlexAlign = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
type FlexJustify =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

interface RowProps extends GapViewProps {
  justify?: FlexJustify;
  align?: FlexAlign;
}

export function Row({
  gap = 12,
  padding,
  width,
  justify = 'center',
  align = 'center',
  style,
  ...props
}: RowProps) {
  return (
    <View
      style={[
        styles.row,
        { justifyContent: justify, alignItems: align },
        gap !== undefined && { gap },
        padding !== undefined && { padding },
        width !== undefined && { width: width as any },
        style,
      ]}
      {...props}
    />
  );
}

export function Separator({ style, ...props }: ViewProps) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.separator,
        { backgroundColor: theme.colors.separator },
        style,
      ]}
      {...props}
    />
  );
}

export function Card({ style, ...props }: ViewProps) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.cardBackground },
        style,
      ]}
      {...props}
    />
  );
}

export function Gap({ gap = 12, style, ...props }: GapViewProps) {
  return <View style={[{ height: gap }, style]} {...props} />;
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    width: '100%',
    height: '100%',
    marginTop: 48,
  },
  column: {
    flexDirection: 'column',
  },
  centeredColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
  },
  separator: {
    marginVertical: 30,
    height: 2,
    width: '80%',
  },
  card: {
    ...cardBorderRadius,
    padding: 16,
    width: '100%',
  },
});
