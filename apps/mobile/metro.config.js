// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// These warnings occur because @noble/hashes and rpc-websockets have ESM exports
// that don't perfectly align with React Native's module resolution.
// Metro successfully falls back to file-based resolution, so these are harmless warnings.
// The app functions correctly despite these warnings.

// Configure resolver to handle Solana dependencies better
config.resolver = {
  ...config.resolver,
  // Package exports are enabled by default in Expo SDK 54+
  // Configure condition names for better platform-specific resolution
  unstable_conditionNames: ['react-native', 'require', 'default'],
  unstable_conditionsByPlatform: {
    android: ['react-native', 'android', 'native', 'default'],
    ios: ['react-native', 'ios', 'native', 'default'],
    web: ['browser', 'default'],
  },
};

module.exports = config;
