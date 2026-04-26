import appCheck from '@react-native-firebase/app-check';
import Constants from 'expo-constants';

const isProd = Constants.expoConfig?.extra?.env === 'production';

const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
provider.configure({
  android: {
    provider: isProd ? 'playIntegrity' : 'debug',
  },
  apple: {
    provider: isProd ? 'appAttest' : 'debug',
  },
});

appCheck().initializeAppCheck({
  provider,
  isTokenAutoRefreshEnabled: true,
});
