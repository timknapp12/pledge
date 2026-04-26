// Postinstall fix for npm hoisting that breaks sibling-resolution in this monorepo.
//
// Two unrelated packages are affected; both fixes have the same shape (move from
// root node_modules into apps/mobile/node_modules so their sibling deps resolve):
//
// 1. @react-native-firebase/{app, app-check}
//    - analytics/crashlytics expect `app` as a sibling because their gradle and
//      podspec scripts use relative paths (../app/...). npm hoists `app` and
//      `app-check` to root while leaving the others nested in apps/mobile.
//
// 2. babel-preset-expo
//    - Contains expoRouterBabelPlugin, gated on require.resolve('expo-router')
//      being reachable from babel-preset-expo's own location. npm hoists
//      babel-preset-expo to root but leaves expo-router nested in apps/mobile,
//      so the plugin is silently skipped and EXPO_ROUTER_APP_ROOT never inlines.
//      Symptom: Metro fails with "Invalid call at line 2: process.env.EXPO_ROUTER_APP_ROOT".
//      apps/mobile/babel.config.js is also required so babel resolves the
//      colocated copy and not whatever's left at root.

import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function colocate({ rootDir, targetDir, packages, label }) {
  if (!existsSync(rootDir)) return;

  mkdirSync(targetDir, { recursive: true });

  for (const pkg of packages) {
    const src = join(rootDir, pkg);
    const dest = join(targetDir, pkg);

    if (!existsSync(src)) continue;

    if (existsSync(dest)) {
      rmSync(src, { recursive: true, force: true });
      console.log(`[${label}] removed duplicate root copy of ${pkg}`);
      continue;
    }

    renameSync(src, dest);
    console.log(`[${label}] moved ${pkg} to apps/mobile`);
  }
}

colocate({
  rootDir: join(ROOT, 'node_modules/@react-native-firebase'),
  targetDir: join(ROOT, 'apps/mobile/node_modules/@react-native-firebase'),
  packages: ['app', 'app-check'],
  label: 'colocate-rnfirebase',
});

colocate({
  rootDir: join(ROOT, 'node_modules'),
  targetDir: join(ROOT, 'apps/mobile/node_modules'),
  packages: ['babel-preset-expo'],
  label: 'colocate-babel-preset-expo',
});
