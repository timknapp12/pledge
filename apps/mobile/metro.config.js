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

const rpcWebsocketsBrowser = path.join(
  monorepoRoot,
  'node_modules/rpc-websockets/dist/index.browser.cjs',
);
const nobleHashesCrypto = path.join(
  monorepoRoot,
  'node_modules/@noble/hashes/crypto.js',
);

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
  resolveRequest(context, moduleName, platform) {
    // rpc-websockets only exports "browser" and "node"; React Native gets no match → noisy WARN.
    if (moduleName === 'rpc-websockets') {
      return { type: 'sourceFile', filePath: rpcWebsocketsBrowser };
    }
    // Package exports use "./crypto" but resolution can still probe "./crypto.js" → WARN.
    if (
      moduleName === '@noble/hashes/crypto' ||
      moduleName === '@noble/hashes/crypto.js' ||
      moduleName.endsWith('/@noble/hashes/crypto.js')
    ) {
      return { type: 'sourceFile', filePath: nobleHashesCrypto };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
