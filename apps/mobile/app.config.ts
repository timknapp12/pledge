// Pledge App Configuration
// Supports: development, preview, production environments

// Solana Network Configuration
const DEVNET_RPC = 'https://api.devnet.solana.com';
const MAINNET_RPC =
  process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

// USDC Mint Addresses
const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet USDC
const MAINNET_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Mainnet USDC

// Program IDs
const DEVNET_PROGRAM_ID =
  process.env.EXPO_PUBLIC_PROGRAM_ID || 'YOUR_DEVNET_PROGRAM_ID';
const MAINNET_PROGRAM_ID = 'YOUR_MAINNET_PROGRAM_ID'; // TODO: Deploy to mainnet

// Supabase Configuration
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://ejgcfgjkwlkblwrqtqbr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// Default (development) settings
let name = 'Pledge Dev';
let slug = 'pledge';
let owner = 'timknapp12';
let version = '0.0.1';
let easProjectId = 'd01efb8d-0437-42d9-b4d4-971d2207ab66';
let icon = './assets/images/icon.png';
let androidIcon = './assets/images/adaptive-icon.png';
let packageName = 'com.pledge.dev';
let bundleIdentifier = 'com.pledge.dev';
let scheme = 'pledgedev';
let env = 'development';
let solanaNetwork = 'devnet';
let solanaRpcUrl = DEVNET_RPC;
let usdcMint = DEVNET_USDC;
let programId = DEVNET_PROGRAM_ID;

// Preview settings (still uses devnet but separate app install)
if (process.env.DEPLOY_ENVIRONMENT === 'preview') {
  name = 'Pledge Preview';
  version = '0.0.1';
  icon = './assets/images/icon.png';
  androidIcon = './assets/images/adaptive-icon.png';
  packageName = 'com.pledge.preview';
  bundleIdentifier = 'com.pledge.preview';
  scheme = 'pledgepreview';
  env = 'preview';
  solanaNetwork = 'devnet';
  solanaRpcUrl = DEVNET_RPC;
  usdcMint = DEVNET_USDC;
  programId = DEVNET_PROGRAM_ID;
}

// Production settings
if (process.env.DEPLOY_ENVIRONMENT === 'production') {
  name = 'Pledge';
  version = '1.0.0';
  icon = './assets/images/icon.png';
  androidIcon = './assets/images/adaptive-icon.png';
  packageName = 'com.pledge.app';
  bundleIdentifier = 'com.pledge.app';
  scheme = 'pledge';
  env = 'production';
  solanaNetwork = 'mainnet-beta';
  solanaRpcUrl = MAINNET_RPC;
  usdcMint = MAINNET_USDC;
  programId = MAINNET_PROGRAM_ID;
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
    ios: {
      supportsTablet: false,
      bundleIdentifier,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // Wallet deep links for MWA
        LSApplicationQueriesSchemes: [
          'solflare',
          'phantom',
          'backpack',
          'exodus',
          'trust',
          'coinbase',
        ],
      },
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
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-localization',
      'expo-secure-store',
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
      supabaseUrl: SUPABASE_URL,
      supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
      experienceId: `@${owner}/${slug}`,
    },
  },
};
