// Polyfills must be imported first
import '../lib/polyfills';

import 'react-native-reanimated';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '../contexts/AuthContext';
import { I18nProvider } from '../contexts/I18nContext';
import { ScrollProvider } from '@/contexts/ScrollContext';
import { ThemeProvider, useThemeMode } from '@/theme/ThemeProvider';
import { lightTheme, darkTheme } from '@/theme';
import { AlertProvider } from '@/components/common/Alert';
import { ToastProvider } from '@/components/common/Toast';
import { NotificationsProvider } from '@/hooks/useNotifications';
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext';
import { TxFlowProvider } from '@/contexts/TxFlowContext';
import { usePhantomListener } from '@/hooks/usePhantomListener';

const LightNavTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: lightTheme.colors.background },
};

const DarkNavTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: darkTheme.colors.background },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // iOS-only Phantom deep-link callback listener. No-op on Android.
  usePhantomListener();

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Iceberg: require('../assets/fonts/Iceberg-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <NotificationsProvider>
            <UserPreferencesProvider>
            <ThemeProvider>
              <AlertProvider>
                <ToastProvider>
                  <TxFlowProvider>
                    <ThemedNavigation />
                  </TxFlowProvider>
                </ToastProvider>
              </AlertProvider>
            </ThemeProvider>
            </UserPreferencesProvider>
          </NotificationsProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function ThemedNavigation() {
  const { isDark } = useThemeMode();

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        backgroundColor: isDark
          ? darkTheme.colors.background
          : lightTheme.colors.background,
      }}
    >
      <ScrollProvider>
        <NavigationThemeProvider value={isDark ? DarkNavTheme : LightNavTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name='(tabs)' />
          </Stack>
        </NavigationThemeProvider>
      </ScrollProvider>
    </GestureHandlerRootView>
  );
}
