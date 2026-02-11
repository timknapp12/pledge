import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';

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

interface UseNotificationsReturn {
  expoPushToken: string | null;
  permissionStatus: Notifications.PermissionStatus | null;
  isRegistering: boolean;
  registerForPushNotifications: () => Promise<string | null>;
  requestPermission: () => Promise<boolean>;
}

export function useNotifications(): UseNotificationsReturn {
  const { supabase, user, walletAddress } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const hasRegisteredRef = useRef(false);

  // Check current permission status on mount
  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPermissionStatus(status);
    });
  }, []);

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
        console.log('Push token registered:', token.substring(0, 20) + '...');
        hasRegisteredRef.current = true;
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

  // Register for push notifications when user logs in (if already permitted)
  useEffect(() => {
    if (
      user &&
      walletAddress &&
      permissionStatus === 'granted' &&
      !hasRegisteredRef.current
    ) {
      registerForPushNotifications();
    }
  }, [user, walletAddress, permissionStatus, registerForPushNotifications]);

  return {
    expoPushToken,
    permissionStatus,
    isRegistering,
    registerForPushNotifications,
    requestPermission,
  };
}

// Helper to schedule a local notification (for testing)
export async function scheduleTestNotification() {
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
}
