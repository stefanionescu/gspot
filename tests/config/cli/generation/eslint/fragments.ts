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
