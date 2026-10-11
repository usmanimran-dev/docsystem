// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      'dist/**',
      '.angular/**',
      'coverage/**',
      'node_modules/**',
      'public/tesseract/**',
    ],
  },

  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],

      // --- Pre-existing debt ------------------------------------------
      // These all have violations in code that predates this config. They
      // are warnings so that CI is green from day one and the count is
      // visible; promote each to 'error' once its count reaches zero.
      // Current counts are listed in CONTRIBUTING.md.

      // Finding 1 in the audit: postData() logs its request body, and login
      // goes through it, so credentials reach the browser console.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Almost all of these are escapes inside the 37 extraction regexes in
      // field-extraction.service.ts. Applying --fix there would rewrite
      // patterns that are verified against a 132-document corpus, so this
      // stays advisory and any change must be re-verified against it.
      'no-useless-escape': 'warn',

      '@typescript-eslint/array-type': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@angular-eslint/no-empty-lifecycle-method': 'warn',
      '@angular-eslint/component-class-suffix': 'warn',
    },
  },

  // core/ holds the services and the layout shell; pages/ holds the screens.
  // Pages import from core, never the other way round.
  {
    files: ['src/app/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/pages/**'],
              message:
                'core/ is the lower layer. A screen imports from core, not the reverse.',
            },
          ],
        },
      ],
    },
  },

  // Tests may reach anywhere they need to.
  {
    files: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // Accessibility debt in existing templates: visible, not blocking.
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
    },
  },
);
