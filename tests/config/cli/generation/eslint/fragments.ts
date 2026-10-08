export const FRAGMENT_SCOPE_CASES = [
    {
        configuration: 'jest',
        rule: 'jest/no-focused-tests',
        source: "import { test, expect } from '@jest/globals';\ntest.only('counts', () => { expect(1).toBe(1); });\n",
        file: 'unit/counter.js',
    },
    {
        configuration: 'vitest',
        rule: 'vitest/no-focused-tests',
        source: "import { test, expect } from 'vitest';\ntest.only('counts', () => { expect(1).toBe(1); });\n",
        file: 'unit/counter.js',
    },
    {
        configuration: 'nestjs',
        rule: '@darraghor/nestjs-typed/injectable-should-be-provided',
        source: 'export const count = 1;\n',
        file: 'src/service.ts',
    },
];

/** Native declarations remain distinguishable from import-shaped comment and string text. */
export const IMPORT_FRAGMENT_SOURCE = `// Keep this side-effect explanation.
import 'native-side-effect'; // Native trailing explanation.
import type { NativeType } from 'native-types';
import { type OtherType, nativeValue as renamed } from 'native-names';
const text = "import shadow from 'a string';";
// import shadow from 'a comment';
[{ files: ['**/*.js'], rules: { native: 'error' } }],
`;
