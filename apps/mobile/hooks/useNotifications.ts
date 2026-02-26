import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';
import React from 'react';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationsContextValue {
  expoPushToken: string | null;
  permissionStatus: Notifications.PermissionStatus | null;
  /** Whether notifications are enabled at the app level (DB flag). */
  isEnabled: boolean;
  isRegistering: boolean;
  registerForPushNotifications: () => Promise<string | null>;
  requestPermission: () => Promise<boolean>;
  disableNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export const useNotifications = (): NotificationsContextValue => {
  const ctx = useContext(NotificationsContext);
  if (!ctx)
    throw new Error(
      'useNotifications must be used inside NotificationsProvider',
    );
  return ctx;
};

export const NotificationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { supabase, user, walletAddress } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const appState = useRef(AppState.currentState);

  // Check current permission status on mount
  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPermissionStatus(status);
    });
  }, []);

  // Load app-level enabled state from DB
  useEffect(() => {
    if (!user) return;
    supabase
      .from('users')
      .select('notifications_enabled')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setIsEnabled(data?.notifications_enabled ?? false);
      });
  }, [user, supabase]);

  // Sync permission status when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active' &&
        user
      ) {
        const { status } = await Notifications.getPermissionsAsync();

        // Permission was revoked in system settings
        if (status !== 'granted' && permissionStatus === 'granted') {
          await supabase
            .from('users')
            .update({ notifications_enabled: false })
            .eq('id', user.id);
          setIsEnabled(false);
        }

        setPermissionStatus(status);
      }
      appState.current = nextState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [user, supabase, permissionStatus]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') {
      setPermissionStatus(Notifications.PermissionStatus.GRANTED);
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionStatus(status);

    return status === 'granted';
  }, []);

  const registerForPushNotifications = useCallback(async (): Promise<
    string | null
  > => {
    if (!user || !walletAddress) {
      console.log('Cannot register push token: user not authenticated');
      return null;
    }

    setIsRegistering(true);

    try {
      // Check/request permission
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        return null;
      }

      // Get the project ID from app config
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error('Missing EAS project ID for push notifications');
        return null;
      }

      // Get the Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const token = tokenData.data;
      setExpoPushToken(token);

      // Store in Supabase
      const { error } = await supabase
        .from('users')
        .update({
          push_token: token,
          notifications_enabled: true,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to store push token:', error);
        // Don't throw - the token is still valid locally
      } else {
        setIsEnabled(true);
      }

      // Set up Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B6B',
        });

        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          description: 'Daily reminders and deadline alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4A5568',
        });
      }

      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    } finally {
      setIsRegistering(false);
    }
  }, [user, walletAddress, supabase, requestPermission]);

  const disableNotifications = useCallback(async () => {
    if (!user) return;

    // Clear token and disable in DB
    const { error } = await supabase
      .from('users')
      .update({ notifications_enabled: false, push_token: null })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to disable notifications:', error);
      return;
    }

    // Cancel all pending notifications for this user
    await supabase
      .from('notifications')
      .update({ status: 'cancelled' })
      .eq('user_id', user.id)
      .eq('status', 'pending');

    setExpoPushToken(null);
    setIsEnabled(false);
  }, [user, supabase]);

  const value: NotificationsContextValue = {
    expoPushToken,
    permissionStatus,
    isEnabled,
    isRegistering,
    registerForPushNotifications,
    requestPermission,
    disableNotifications,
  };

  return React.createElement(
    NotificationsContext.Provider,
    { value },
    children,
  );
};

// Helper to schedule a local notification (for testing)
export const scheduleTestNotification = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Notification',
      body: 'This is a test from Pledge!',
      data: { type: 'test' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
    },
  });
};
