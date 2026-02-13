// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Monorepo root (packages are hoisted here)
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

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
  // Polyfill Node.js built-ins for React Native (from monorepo root)
  extraNodeModules: {
    assert: path.resolve(monorepoRoot, 'node_modules/assert'),
    stream: path.resolve(monorepoRoot, 'node_modules/stream-browserify'),
    util: path.resolve(monorepoRoot, 'node_modules/util'),
  },
};

module.exports = config;
