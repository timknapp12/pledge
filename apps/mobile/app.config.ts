// Pledge App Configuration
// Supports: development, preview, production environments
// Android only

// Helius API Key (works for both devnet and mainnet)
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

// Solana Network Configuration
const DEVNET_RPC = HELIUS_API_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.devnet.solana.com';

const MAINNET_RPC = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

// USDC Mint Addresses
const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet USDC
const MAINNET_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Mainnet USDC

// Program IDs
const DEVNET_PROGRAM_ID =
  process.env.EXPO_PUBLIC_PROGRAM_ID || 'YOUR_DEVNET_PROGRAM_ID';
const MAINNET_PROGRAM_ID = 'YOUR_MAINNET_PROGRAM_ID'; // TODO: Deploy to mainnet

// Supabase Configuration (dev/preview share one project, production uses another)
const DEV_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://ejgcfgjkwlkblwrqtqbr.supabase.co';
const DEV_SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const PROD_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_PROD_SUPABASE_URL';
const PROD_SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// Default (development) settings
let name = 'Pledge Dev';
const slug = 'pledge';
const owner = 'timknapp12';
let version = '0.0.1';
const easProjectId = 'd01efb8d-0437-42d9-b4d4-971d2207ab66';
let icon = './assets/images/icon.png';
let androidIcon = './assets/images/adaptive-icon.png';
let packageName = 'com.pledge.dev';
let scheme = 'pledgedev';
let env = 'development';
let solanaNetwork = 'devnet';
let solanaRpcUrl = DEVNET_RPC;
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
  solanaRpcUrl = MAINNET_RPC;
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
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      softwareKeyboardLayoutMode: 'resize',
      package: packageName,
    },
    plugins: [
      'expo-router',
      'expo-localization',
      'expo-secure-store',
      '@react-native-community/datetimepicker',
      [
        '@react-native-firebase/app',
        {
          android: { googleServicesFile },
        },
      ],
      '@react-native-firebase/analytics',
      '@react-native-firebase/crashlytics',
      [
        'expo-notifications',
        {
          // Note: Create a proper notification icon (96x96 white on transparent)
          // For now, using adaptive-icon as placeholder
          icon: './assets/images/adaptive-icon.png',
          color: '#6366f1',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26, // Required for MWA
            enableProguardInReleaseBuilds: true,
          },
        },
      ],
    ],
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
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
