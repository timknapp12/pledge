import { Text, TextProps, StyleSheet } from 'react-native';
import { useAppTheme } from '@/theme/ThemeProvider';

export function Title1({ style, ...props }: TextProps) {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[styles.title1, { color: theme.colors.primary }, style]}
      {...props}
    />
  );
}

export function Title2({ style, ...props }: TextProps) {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[styles.title2, { color: theme.colors.text }, style]}
      {...props}
    />
  );
}

export function Title3({ style, ...props }: TextProps) {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[styles.title3, { color: theme.colors.text }, style]}
      {...props}
    />
  );
}

export function Body({ style, ...props }: TextProps) {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[styles.body, { color: theme.colors.text }, style]}
      {...props}
    />
  );
}

export function BodySecondary({ style, ...props }: TextProps) {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[styles.bodySecondary, { color: theme.colors.textSecondary }, style]}
      {...props}
    />
  );
}

export function BodySmall({ style, ...props }: TextProps) {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[styles.bodySmall, { color: theme.colors.text }, style]}
      {...props}
    />
  );
}

export function BodySmallSecondary({ style, ...props }: TextProps) {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[styles.bodySmallSecondary, { color: theme.colors.textSecondary }, style]}
      {...props}
    />
  );
}

export function ErrorText({ style, ...props }: TextProps) {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[styles.errorText, { color: theme.colors.error }, style]}
      {...props}
    />
  );
}

export function SuccessText({ style, ...props }: TextProps) {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[styles.successText, { color: theme.colors.accent }, style]}
      {...props}
    />
  );
}

export function MonoText({ style, ...props }: TextProps) {
  const { theme } = useAppTheme();
  return (
    <Text
      style={[styles.monoText, { color: theme.colors.text }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  title1: {
    fontSize: 32,
    fontFamily: 'Iceberg',
  },
  title2: {
    fontSize: 24,
    fontFamily: 'Iceberg',
  },
  title3: {
    fontSize: 20,
    fontFamily: 'Iceberg',
  },
  body: {
    fontSize: 16,
  },
  bodySecondary: {
    fontSize: 16,
    opacity: 0.8,
  },
  bodySmall: {
    fontSize: 14,
  },
  bodySmallSecondary: {
    fontSize: 14,
    opacity: 0.6,
  },
  errorText: {
    fontSize: 14,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
  },
  monoText: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
});
