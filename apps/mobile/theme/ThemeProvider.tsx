import { useColorScheme } from 'react-native';
import { ThemeProvider as StyledThemeProvider } from 'styled-components/native';
import { lightTheme, darkTheme } from './index';

interface Props {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: Props) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return <StyledThemeProvider theme={theme}>{children}</StyledThemeProvider>;
}
