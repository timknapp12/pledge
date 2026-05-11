// USDC Mint Addresses
const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet USDC
const MAINNET_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Mainnet USDC

// Program IDs
const DEVNET_PROGRAM_ID =
  process.env.EXPO_PUBLIC_PROGRAM_ID || 'YOUR_DEVNET_PROGRAM_ID';
const MAINNET_PROGRAM_ID = 'PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp';

// Supabase URL + publishable key are set per build profile in the EAS dashboard
// (dev/preview point at the dev project, production points at the prod project).
// Fail loudly only during an actual build — non-build EAS commands like
// `eas device:create` evaluate this config without loading the local .env.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const isBuilding = process.env.EAS_BUILD === 'true';
if (isBuilding && (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY)) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ' +
      'in EAS build env. Set them in the EAS build profile.',
  );
}

// Firebase config files live as EAS file env vars per environment (uploaded
// via the dashboard). At build time EAS materializes them to disk and exposes
// the absolute path via these env vars. Locally they're unset, so we fall back
// to gitignored copies under firebase/{dev,preview,prod}/.
const ANDROID_FIREBASE_ENV = process.env.GOOGLE_SERVICES_JSON;
const IOS_FIREBASE_ENV = process.env.GOOGLE_SERVICES_PLIST;
if (isBuilding && (!ANDROID_FIREBASE_ENV || !IOS_FIREBASE_ENV)) {
  throw new Error(
    'Missing GOOGLE_SERVICES_JSON or GOOGLE_SERVICES_PLIST in EAS build env. ' +
      'Upload google-services.json and GoogleService-Info.plist as file env ' +
      'vars in the EAS dashboard for this environment.',
  );
}

// Default (development) settings
let name = 'Pledge Dev';
const slug = 'pledge';
const owner = 'timknapp12';
let version = '0.0.1';
const easProjectId = 'd01efb8d-0437-42d9-b4d4-971d2207ab66';
let icon = './assets/images/p-white-bg-purple-1024.png';
let androidIcon = './assets/images/P-white-1024.png';
let packageName = 'com.pledge.dev';
let iosBundleId = 'com.pledge.dev';
let scheme = 'pledgedev';
let env = 'development';
let solanaNetwork = 'devnet';
let solanaRpcUrl = `${SUPABASE_URL}/functions/v1/rpc-proxy`;
let usdcMint = DEVNET_USDC;
let programId = DEVNET_PROGRAM_ID;
let googleServicesFile =
  ANDROID_FIREBASE_ENV ?? './firebase/dev/google-services.json';
let iosGoogleServicesFile =
  IOS_FIREBASE_ENV ?? './firebase/dev/GoogleService-Info.plist';

// Preview settings (still uses devnet but separate app install)
if (process.env.DEPLOY_ENVIRONMENT === 'preview') {
  name = 'Pledge Preview';
  packageName = 'com.pledge.preview';
  iosBundleId = 'com.pledge.preview';
  scheme = 'pledgepreview';
  env = 'preview';
  googleServicesFile =
    ANDROID_FIREBASE_ENV ?? './firebase/preview/google-services.json';
  iosGoogleServicesFile =
    IOS_FIREBASE_ENV ?? './firebase/preview/GoogleService-Info.plist';
}

// Production settings
if (process.env.DEPLOY_ENVIRONMENT === 'production') {
  name = 'Pledge';
  version = '1.0.1';
  packageName = 'com.pledgeapp.app';
  iosBundleId = 'com.pledgeapp.app';
  scheme = 'pledge';
  env = 'production';
  solanaNetwork = 'mainnet-beta';
  solanaRpcUrl = `${SUPABASE_URL}/functions/v1/rpc-proxy`;
  usdcMint = MAINNET_USDC;
  programId = MAINNET_PROGRAM_ID;
  googleServicesFile =
    ANDROID_FIREBASE_ENV ?? './firebase/prod/google-services.json';
  iosGoogleServicesFile =
    IOS_FIREBASE_ENV ?? './firebase/prod/GoogleService-Info.plist';
}

module.exports = {
  expo: {
    name,
    slug,
    owner,
    version,
    orientation: 'portrait',
    icon,
    scheme,
    platforms: ['ios', 'android'],
    userInterfaceStyle: 'automatic',
    updates: {
      url: `https://u.expo.dev/${easProjectId}`,
    },
    runtimeVersion: {
      policy: 'sdkVersion',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: androidIcon,
        backgroundColor: '#6366F1',
      },
      softwareKeyboardLayoutMode: 'resize',
      package: packageName,
      googleServicesFile,
    },
    ios: {
      bundleIdentifier: iosBundleId,
      supportsTablet: false,
      googleServicesFile: iosGoogleServicesFile,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-web-browser',
      'expo-localization',
      'expo-secure-store',
      '@react-native-community/datetimepicker',
      '@react-native-firebase/app',
      '@react-native-firebase/crashlytics',
      '@react-native-firebase/app-check',
      [
        'expo-notifications',
        {
          // Note: Create a proper notification icon (96x96 white on transparent)
          // For now, using adaptive-icon as placeholder
          icon: './assets/images/P-white-96.png',
          color: '#6366F1',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26, // Required for MWA
            enableProguardInReleaseBuilds: false,
          },
          ios: {
            // @react-native-firebase/* transitive pods don't declare clang
            // modules, which breaks module-aware builds. Opt these three
            // pods into modular headers instead of globally forcing
            // `useFrameworks: 'static'` (which would break Reanimated v4
            // and the New Architecture).
            extraPods: [
              { name: 'GoogleUtilities', modular_headers: true },
              { name: 'GoogleDataTransport', modular_headers: true },
              { name: 'nanopb', modular_headers: true },
            ],
          },
        },
      ],
    ],
    splash: {
      image: './assets/images/pledge-white.png',
      resizeMode: 'contain',
      backgroundColor: '#6366F1',
    },
    experiments: {
      // Disabled: SDK 55 upstream version skew between @expo/router-server@55.0.15
      // (in @expo/cli@55.0.26) and expo-router@55.0.13. The router-server requires
      // expo-router/internal/routing, which the latest stable expo-router does not
      // export. Re-enable once Expo ships matching versions.
      typedRoutes: false,
    },
    extra: {
      router: {},
      eas: {
        projectId: easProjectId,
      },
      env,
      solanaNetwork,
      solanaRpcUrl,
      usdcMint,
      programId,
      supabaseUrl: SUPABASE_URL,
      supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
      experienceId: `@${owner}/${slug}`,
    },
  },
};
