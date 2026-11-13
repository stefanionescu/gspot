import { STRICT_COMPILER_OPTIONS } from '#tests/config/setup/languages.ts';

// boundaries
export const COMPONENT_IMPORT_CASES = [
    {
        configuration: 'vue',
        file: 'Card.vue',
        opening: '<script lang="ts">',
        closing: '</script><template><p>{{ result }}</p></template>',
    },
    {
        configuration: 'svelte',
        file: 'Card.svelte',
        opening: '<script lang="ts">',
        closing: '</script><p>{result}</p>',
    },
    { configuration: 'astro', file: 'Card.astro', opening: '---', closing: '---\n<p>{result}</p>' },
] as const;
export const IMPORT_RULE_CASES = [
    { level: 'basic', declarations: 'none' },
    { level: 'basic', declarations: 'root' },
    { level: 'basic', declarations: 'scoped' },
    { level: 'all', declarations: 'none' },
] as const;
const MODULE_TSCONFIG =
    '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["app/**/*.ts","storage/**/*.ts"]}\n';
export const IMPORT_RULE_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json': MODULE_TSCONFIG,
    'apps/api/tsconfig.json': MODULE_TSCONFIG,
    'app/source.ts': "import { value } from '../storage/value.js';\nexport const result = value;\n",
    'storage/value.ts': 'export const value = 1;\n',
    'app/value.ts': 'export const value = 2;\n',
    'apps/api/app/source.ts': "import { value } from '../storage/value.js';\nexport const result = value;\n",
    'apps/api/storage/value.ts': 'export const value = 1;\n',
    'apps/api/app/value.ts': 'export const value = 2;\n',
} as const;
export const IMPORT_RULE_TABLES = {
    none: `[[scope]]
path = "apps/api"
configurations = [ "typescript" ]
`,
    root: `[[import_rule]]
name = "app"
paths = [ "app/**" ]

[[import_rule]]
name = "storage"
paths = [ "storage/**" ]

[[scope]]
path = "apps/api"
configurations = [ "typescript" ]
`,
    scoped: `[[scope]]
path = "apps/api"
configurations = [ "typescript" ]

[[import_rule]]
name = "app"
paths = [ "apps/api/app/**" ]

[[import_rule]]
name = "storage"
paths = [ "apps/api/storage/**" ]
`,
} as const;
export const STYLESHEET_IMPORT_CASES = [
    {
        name: 'css-owned-below',
        glob: '**',
        findings: [{ file: 'app/source.ts', rule: 'boundaries/dependencies', line: 1 }],
    },
    { name: 'css-code-globs', glob: '**/*.ts', findings: [] },
] as const;
export const TEST_IMPORT_CASES = [
    { folder: 'src', source: "import { value } from '../tests/value.js';", rejected: true },
    { folder: 'src', source: "import type { Value } from '../tests/value.js';", rejected: true },
    { folder: 'src', source: "import { value } from '../other/value.test.js';", rejected: true },
    { folder: 'tests', source: "import { value } from '../src/value.js';", rejected: false },
] as const;
export const TEST_IMPORT_RULE_TABLES = `test_files = ["app/qa/**"]

[[import_rule]]
name = "app"
paths = ["app/**"]

[[import_rule]]
name = "storage"
paths = ["storage/**"]

[[import_rule]]
name = "api-app"
paths = ["apps/api/app/**"]

[[import_rule]]
name = "api-storage"
paths = ["apps/api/storage/**"]

[[scope]]
path = "apps/api"
configurations = ["javascript"]
test_files = ["app/verification/**", "app/qa/**"]
`;
export const TRPC_IMPORTS = [
    { source: 'import { router } from "./private/router.js";', line: 2 },
    { source: 'import {\n router\n} from "./private/router.js";', line: 4 },
    { source: 'export { router } from "./private/router.js";', line: 2 },
    { source: 'const router = require("./private/router.js");', line: 2 },
    { source: 'const router = import("./private/router.js");', line: 2 },
    { source: 'import { router } from "#private/router";', line: 2 },
    { source: 'import { router } from "@private/router";', line: 2 },
    { source: 'import { type router as Router, router } from "./private/router.js";', line: 2 },
    { source: 'import router from "./private/router.js";', line: 2 },
    { source: 'import * as router from "./private/router.js";', line: 2 },
    { source: 'import "./private/router.js";', line: 2 },
    { source: 'export { type router as Router, router } from "./private/router.js";', line: 2 },
    { source: 'export * from "./private/router.js";', line: 2 },
] as const;
export const TRPC_MODULES = `[trpc]
server_files = ["private/**", "app/api/trpc/**", "app/private/**", "app/child/private/**", "flat/router.ts"]

[[import_rule]]
name = "server"
paths = ["private/**", "app/api/trpc/**", "app/private/**", "app/child/private/**", "flat/router.ts"]
[[import_rule]]
name = "client"
paths = ["client/**"]
[[import_rule]]
name = "storage"
paths = ["storage/**"]
`;
export const TRPC_TYPES = `import type { router } from "./private/router.js";
import { type router as Router } from "./private/router.js";
export type { router as RouterExport } from "./private/router.js";
export { type router as SpecifierExport } from "./private/router.js";
export type * from "./private/router.js";
`;

// configuration blocks
export const MATCHING_SCOPE_SETTINGS = `[[scope]]
path = "same"
configurations = []
[[scope]]
path = "same/deep"
configurations = []
[[scope]]
path = "different"
configurations = []
test_files = ["custom/**"]
`;

// drizzle
export const DRIZZLE_SCOPE_SETTINGS = {
    level: 'all',
    rules: true,
    scopes: [{ path: 'app', configurations: ['drizzle'] }],
    tables: '[scope.drizzle]\nclient_names = ["connection"]\n',
} as const;

// environment readers
export const ENVIRONMENT_CASES = [
    { source: 'const port = process.env.PORT;\n', rule: 'n/no-process-env' },
    { source: 'const port = Bun.env.PORT;\n', rule: 'no-restricted-properties' },
    { source: "const port = Deno.env.get('PORT');\n", rule: 'no-restricted-properties' },
    { source: 'const port = import.meta.env.PORT;\n', rule: 'gspot/restricted-syntax' },
] as const;
export const ENVIRONMENT_TABLES = `[structure]
environment_readers = ["config/**", "app/src/env/**", "literal/config/**"]

[[scope]]
path = "app"
configurations = ["typescript"]

[[scope]]
path = "sibling"
configurations = ["typescript"]

[[scope]]
path = "app/deep"
configurations = ["typescript"]

[[scope]]
path = "literal"
configurations = ["typescript"]
`;

// imports
export const HOST_MODULE = '../../scripts/app.js';

// rule tables
export const DUPLICATE_RULE_CASES = [
    {
        file: 'empty-regex.js',
        source: 'export const pattern = /[]/;\n',
        kept: 'regexp/no-empty-character-class',
        rules: ['no-empty-character-class', 'regexp/no-empty-character-class'],
    },
    {
        file: 'unused.ts',
        source: 'export function run() { const unused = 1; return 2; }\n',
        kept: '@typescript-eslint/no-unused-vars',
        rules: ['no-unused-vars', '@typescript-eslint/no-unused-vars'],
    },
    {
        file: 'empty.test.js',
        source: "import { test } from '@jest/globals';\n\ntest('counts the rows', () => {});\n",
        kept: 'jest/expect-expect',
        rules: ['gspot/require-test-assertions', 'jest/expect-expect'],
    },
] as const;

// trivial rules
export const INDEX_ONLY_REEXPORTS = '{ value = "index-only", reason = "The package exports its public index files." }';

// typed rules
const PORT_SOURCE =
    '// The port the service listens on.\n\n/** The port, read once. */\nexport const port = Number("8080") as number;\n';
export const TYPED_RULE_PROJECTS = [
    {
        name: 'a root TypeScript project',
        configurations: ['typescript'],
        tables: '',
        files: {
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}\n',
            'source.ts': PORT_SOURCE,
        },
        file: 'source.ts',
    },
    {
        name: 'a TypeScript scope under a root without TypeScript',
        configurations: [],
        tables: '[[scope]]\npath = "api"\nconfigurations = [ "typescript" ]\n',
        files: {
            'package.json': '{"name":"example","private":true,"type":"module","workspaces":["api"]}\n',
            'api/package.json': '{"name":"api","private":true,"type":"module"}\n',
            'api/tsconfig.json': JSON.stringify({ compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] }) + '\n',
            'api/src/port.ts': PORT_SOURCE,
        },
        file: 'api/src/port.ts',
    },
] as const;
