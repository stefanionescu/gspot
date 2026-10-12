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
        source: `import { Injectable } from '@nestjs/common';
@Injectable()
export class CounterService { count = 1; }
`,
        file: 'src/service.ts',
    },
] as const;

/** Native declarations remain distinguishable from import-shaped comment and string text. */
export const IMPORT_FRAGMENT_SOURCE = `// Keep this side-effect explanation.
import 'native-side-effect'; // Native trailing explanation.
import type { NativeType } from 'native-types';
import { type OtherType, nativeValue as renamed } from 'native-names';
const text = "import shadow from 'a string';";
// import shadow from 'a comment';
[{ files: ['**/*.js'], rules: { native: 'error' } }],
`;

export const APP_JEST = `level = "all"
configurations = [ "javascript" ]

[rules]
enabled = false

[[scope]]
path = "app"
configurations = [ "jest" ]
`;

// Authored restrictions and the store convention exercise the same native ESLint rule.
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
[architecture.roles]
stores = ["**/store.js"]
`;

/** Typed Query APIs isolate the plugin's query-function and callback-order contracts. */
export const QUERY_FILES = {
    'package.json':
        '{"name":"query-rules","private":true,"type":"module","dependencies":{"@tanstack/react-query":"5.91.2"}}',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}',
    'src/query.d.ts': `declare module '@tanstack/react-query' {
    export function useQuery(options: { queryKey: string[]; queryFn: () => unknown }): unknown;
    export function useMutation(options: { onMutate: () => number; onError: () => void }): unknown;
}
`,
    'src/neighbor.ts': `import { useQuery } from "@tanstack/react-query";
useQuery({ queryKey: ["neighbor"], queryFn: () => 2 });
`,
} as const;

export const QUERY_SAMPLE = `import { useQuery, useMutation } from "@tanstack/react-query";
useQuery({ queryKey: ["users"], queryFn: () => {} });
useMutation({ onError: () => {}, onMutate: () => 1 });
`;

export const QUERY_FIXED = `import { useQuery, useMutation } from "@tanstack/react-query";
useQuery({ queryKey: ["users"], queryFn: () => 1 });
useMutation({ onMutate: () => 1, onError: () => {} });
`;

export const TYPESCRIPT_FILES = {
    'package.json': '{"name":"typescript-rules","private":true,"type":"module"}',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"baseUrl":".","paths":{"@app/*":["src/*"]}},"include":["src/**/*.ts"]}',
} as const;

export const VITEST_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tests/unit/example.test.js': '',
} as const;
