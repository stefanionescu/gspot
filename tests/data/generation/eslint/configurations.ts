export const BLOCK_SCOPE_CASES = [
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
        source: `import { Injectable } from '@nestjs/common';
@Injectable()
export class CounterService { count = 1; }
`,
        file: 'src/service.ts',
    },
] as const;

export const APP_JEST = `[[scope]]
path = "app"
configurations = [ "jest" ]
`;

// Authored import restrictions and the store convention both use the same ESLint rule.
export const ZUSTAND_FILES = {
    'package.json': '{"name":"restricted-imports","private":true,"type":"module","dependencies":{"zustand":"5.0.8"}}',
    'src/widget.js': `import { create } from "zustand";
import { readFile } from "node:fs";
export const widget = create(() => ({ readFile }));
`,
    'src/store.js': `import { create } from "zustand";
import { readFile } from "node:fs";
export const store = create(() => ({ readFile }));
`,
} as const;

export const RESTRICTION_TABLES = `[tools.eslint]
restricted_imports = [{ name = "node:fs", message = "Use the storage service." }]
[zustand]
store_files = ["**/store.js"]
`;

export const VITEST_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tests/unit/example.test.js': '',
} as const;

/** Matching nested TypeScript scopes and one scope with distinct test selectors. */
export const MATCHING_SCOPE_FILES = {
    'package.json': '{"private":true,"type":"module"}',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src","same","different"]}',
    'src/root.ts': 'export const root = 1;\n',
    'same/src/sample.ts': 'export const same = 1;\n',
    'same/deep/src/sample.ts': 'export const deep = 1;\n',
    'same/sample.test.ts': 'export const testValue = 1;\n',
    'different/src/sample.ts': 'export const different = 1;\n',
    'different/custom/sample.ts': 'export const custom = 1;\n',
} as const;

export const MATCHING_SCOPE_SETTINGS = `[[scope]]
path = "same"
configurations = []
[[scope]]
path = "same/deep"
configurations = []
[[scope]]
path = "different"
configurations = []
test_files = ["different/custom/**"]
`;
