import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

// Flat config (ESLint 9). Replaces the legacy .eslintrc.cjs.
// NB: this repo's lint baseline is intentionally red (the build, not lint, is
// the CI gate) — `yarn lint` runs but is not currently wired to block.
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      // This toolkit consumes untyped Injective chain/tx data (the SDK returns
      // dynamic payloads), so the codebase intentionally uses `any` at those
      // boundaries. The type-aware "unsafe-*" family + no-explicit-any therefore
      // fire thousands of non-actionable violations. They're turned off here;
      // every other recommendedTypeChecked rule (no-floating-promises,
      // no-misused-promises, etc.) stays on to catch real issues.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // react-hooks v6's set-state-in-effect flags the standard "reset/sync
      // state when a dependency changes" idiom used throughout these views
      // (e.g. reset page on token switch, invalidate computed lists on input
      // change, value-change animations). Refactoring ~50 effects on the live
      // auto-deploying app is real behavior risk for no functional gain, so
      // this specific rule is off. Other react-hooks rules stay on.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
);
