import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/coverage/',
    '**/src/generated/',
    'e2e/.output/',
    'frontend/src/components/ui/',
    'docs/',
    'openspec/',
  ]),
  js.configs.recommended,
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['backend/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^\\$(queryRawUnsafe|executeRawUnsafe)$/]',
          message: 'Unsafe raw SQL is banned. Use $queryRaw or $executeRaw as tagged templates.',
        },
        {
          selector: 'MemberExpression[property.value=/^\\$(queryRawUnsafe|executeRawUnsafe)$/]',
          message: 'Unsafe raw SQL is banned. Use $queryRaw or $executeRaw as tagged templates.',
        },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/generated/prisma/**', '@prisma/client', '@prisma/adapter-pg'],
              allowTypeImports: true,
              message: 'Only repositories and src/common/db touch Prisma (ADR-0001).',
            },
            {
              group: ['**/common/db/**'],
              message: 'Only server.ts and repositories may import the database module.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'backend/src/**/*.repository.ts',
      'backend/src/common/db/**',
      'backend/src/server.ts',
      'backend/prisma.config.ts',
      'backend/src/**/*.test.ts',
      'backend/tests/**',
    ],
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
