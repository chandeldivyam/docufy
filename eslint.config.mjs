import config from '@docufy/eslint-config';

export default [
  ...config,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/.git/**',
      '**/public/**',
      '**/*.d.ts',
    ],
  },
];
