const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  ...expoConfig,
  {
    rules: {
      // Unused imports/vars: warn (yellow squiggle). _-prefixed ignored.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Allow default + named imports (common pattern for styled-components)
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      // Resolver often fails on React Native, path aliases (@/), native bindings.
      // TypeScript + Metro already validate imports.
      'import/no-unresolved': 'off',
      'import/namespace': 'off',
      'import/no-duplicates': 'off',
    },
  },
]);
