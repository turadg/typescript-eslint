import { RuleTester } from '@typescript-eslint/rule-tester';
import type { TSESLint } from '@typescript-eslint/utils';

import rule from '../../src/rules/exports-satisfy';
import { getFixturesRootDir } from '../RuleTester';

const rootDir = getFixturesRootDir();
const ruleTester = new RuleTester({
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    tsconfigRootDir: rootDir,
    project: './tsconfig.json',
  },
});

ruleTester.run('exports-satisfy', rule, {
  valid: [
    {
      code: `
        export type StartFn = (name: string) => void;
        export const start: StartFn = (name: string) => {
          console.log(\`Hello, \${name}\`);
        };
        export type MyType = { name: string };
        export const other: MyType = null;
      `,
      options: [{ start: 'StartFn', '*': 'MyType' }],
    },
  ],
  invalid: [
    {
      code: `
        export const okExport = 'ok';
      `,
      options: [{ '*': 'UndefinedType' }],
      errors: [
        {
          messageId: 'unresolvedType',
          data: { exportName: 'invalidExport', typeName: 'UndefinedType' },
        },
      ],
    },
    {
      code: `
        export const start: StartFn = (name: string) => {
          console.log(\`Hello, \${name}\`);
        };
        `,
      options: [{ '*': 'number' }],
      errors: [
        {
          messageId: 'unresolvedType',
          data: { exportName: 'invalidExport', typeName: 'StartFn' },
        },
      ],
    },
    {
      code: `
        export type StartFn = (name: string) => void;
        export const start = (num: number) => {
        };
        `,
      options: [{ '*': 'StartFn' }],
      errors: [
        {
          messageId: 'invalidExportType',
          data: { exportName: 'start', typeName: 'StartFn' },
        },
      ],
    },
  ],
});
