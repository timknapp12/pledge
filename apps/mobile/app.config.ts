// Pledge App Configuration
// Supports: development, preview, production environments
// Android only

// RPC URLs - proxied through Supabase Edge Functions to keep Helius API key server-side
// The rpc-proxy edge function forwards JSON-RPC requests to Helius
// Fallback to public RPCs if Supabase URL is not configured

// USDC Mint Addresses
const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet USDC
const MAINNET_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Mainnet USDC

// Program IDs
const DEVNET_PROGRAM_ID =
  process.env.EXPO_PUBLIC_PROGRAM_ID || 'YOUR_DEVNET_PROGRAM_ID';
const MAINNET_PROGRAM_ID = 'PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp';

// Supabase Configuration (dev/preview share one project, production uses another)
const DEV_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://ejgcfgjkwlkblwrqtqbr.supabase.co';
const DEV_SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const PROD_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xbltaxjcpthidsglslxf.supabase.co';
const PROD_SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// Default (development) settings
let name = 'Pledge Dev';
const slug = 'pledge';
const owner = 'timknapp12';
let version = '0.0.1';
const easProjectId = 'd01efb8d-0437-42d9-b4d4-971d2207ab66';
let icon = './assets/images/P-white-1024.png';
let androidIcon = './assets/images/P-white-1024.png';
let packageName = 'com.pledge.dev';
let scheme = 'pledgedev';
let env = 'development';
let solanaNetwork = 'devnet';
let solanaRpcUrl = `${DEV_SUPABASE_URL}/functions/v1/rpc-proxy`;
let usdcMint = DEVNET_USDC;
let programId = DEVNET_PROGRAM_ID;
let supabaseUrl = DEV_SUPABASE_URL;
let supabasePublishableKey = DEV_SUPABASE_PUBLISHABLE_KEY;
let googleServicesFile = './firebase/dev/google-services.json';

// Preview settings (still uses devnet but separate app install)
if (process.env.DEPLOY_ENVIRONMENT === 'preview') {
  name = 'Pledge Preview';
  packageName = 'com.pledge.preview';
  scheme = 'pledgepreview';
  env = 'preview';
  googleServicesFile = './firebase/preview/google-services.json';
}

// Production settings
if (process.env.DEPLOY_ENVIRONMENT === 'production') {
  name = 'Pledge';
  version = '1.0.0';
  packageName = 'com.pledge.app';
  scheme = 'pledge';
  env = 'production';
  solanaNetwork = 'mainnet-beta';
  solanaRpcUrl = `${PROD_SUPABASE_URL}/functions/v1/rpc-proxy`;
  usdcMint = MAINNET_USDC;
  programId = MAINNET_PROGRAM_ID;
  supabaseUrl = PROD_SUPABASE_URL;
  supabasePublishableKey = PROD_SUPABASE_PUBLISHABLE_KEY;
  googleServicesFile = './firebase/prod/google-services.json';
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
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
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
      edgeToEdgeEnabled: true,
      softwareKeyboardLayoutMode: 'resize',
      package: packageName,
      googleServicesFile,
    },
    plugins: [
      'expo-router',
      'expo-localization',
      'expo-secure-store',
      '@react-native-community/datetimepicker',
      '@react-native-firebase/app',
      '@react-native-firebase/crashlytics',
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
        },
      ],
    ],
    splash: {
      image: './assets/images/pledge-white.png',
      resizeMode: 'contain',
      backgroundColor: '#6366F1',
    },
    experiments: {
      typedRoutes: true,
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
      supabaseUrl,
      supabasePublishableKey,
      experienceId: `@${owner}/${slug}`,
    },
  },
};
