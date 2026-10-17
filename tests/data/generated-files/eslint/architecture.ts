export const MODULE_CASES = [
    { level: 'recommended', declarations: 'none' } as const,
    { level: 'recommended', declarations: 'root' } as const,
    { level: 'recommended', declarations: 'scoped' } as const,
    { level: 'all', declarations: 'none' } as const,
    { level: 'all', declarations: 'root' } as const,
    { level: 'all', declarations: 'scoped' } as const,
] as const;

export const MODULE_TABLES = {
    none: `[[scope]]
path = "apps/api"
configurations = [ "typescript" ]
`,
    root: `[[architecture.module]]
name = "app"
paths = [ "app/**" ]
may_import = [ "app" ]

[[architecture.module]]
name = "storage"
paths = [ "storage/**" ]

[[scope]]
path = "apps/api"
configurations = [ "typescript" ]
`,
    scoped: `[[scope]]
path = "apps/api"
configurations = [ "typescript" ]

[[architecture.module]]
name = "app"
paths = [ "apps/api/app/**" ]
may_import = [ "app" ]

[[architecture.module]]
name = "storage"
paths = [ "apps/api/storage/**" ]
`,
} as const;

export const MODULE_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["app/**/*.ts","storage/**/*.ts"]}\n',
    'apps/api/tsconfig.json':
        '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["app/**/*.ts","storage/**/*.ts"]}\n',
    'app/source.ts': "import { value } from '../storage/value.js';\nexport const result = value;\n",
    'storage/value.ts': 'export const value = 1;\n',
    'app/value.ts': 'export const value = 2;\n',
    'apps/api/app/source.ts': "import { value } from '../storage/value.js';\nexport const result = value;\n",
    'apps/api/storage/value.ts': 'export const value = 1;\n',
    'apps/api/app/value.ts': 'export const value = 2;\n',
} as const;

export const FIXED_SOURCE = "import { value } from './value.js';\nexport const result = value;\n";

/** Production files cannot import test files; test files may import production files. */
export const ROLE_IMPORT_CASES = [
    { folder: 'src', source: "import { value } from '../tests/value.js';", rejected: true },
    { folder: 'src', source: "import type { Value } from '../tests/value.js';", rejected: true },
    { folder: 'src', source: "import { value } from '../other/value.test.js';", rejected: true },
    { folder: 'tests', source: "import { value } from '../src/value.js';", rejected: false },
    { folder: 'tests', source: "import type { Value } from '../src/value.js';", rejected: false },
] as const;

/** The fixed test-import rule applies in root and child scopes. */
export const TEST_IMPORT_TABLES = `[[scope]]
path = "app"
configurations = ["typescript"]
`;

export const ROLE_TSCONFIG =
    '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","baseUrl":".","paths":{"@/*":["./*"]},"types":[]},"include":["**/*.ts"]}';

export const ROLE_TARGETS = {
    'src/value.ts': 'export const value = 1;\nexport type Value = number;\n',
    'tests/value.ts': 'export const value = 1;\nexport type Value = number;\n',
    'other/value.test.ts': 'export const value = 1;\n',
} as const;

export const ENVIRONMENT_TABLES = `[architecture.roles]
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

export const ENVIRONMENT_CASES = [
    { source: 'const port = process.env.PORT;\n', rule: 'n/no-process-env' },
    { source: 'const port = Bun.env.PORT;\n', rule: 'no-restricted-properties' },
    { source: "const port = Deno.env.get('PORT');\n", rule: 'no-restricted-properties' },
    { source: 'const port = import.meta.env.PORT;\n', rule: 'no-restricted-syntax' },
] as const;

export const ENVIRONMENT_COMPOSED = "export * from './other.js';\nconst port = import.meta.env.PORT;\n";

// Authored test globs add to the defaults and scope exclusions; production imports stay checked.
export const QA_MODULE_TABLES = `test_files = ["app/qa/**"]

[[architecture.module]]
name = "app"
paths = ["app/**"]
may_import = ["app"]

[[architecture.module]]
name = "storage"
paths = ["storage/**"]

[[architecture.module]]
name = "api-app"
paths = ["apps/api/app/**"]
may_import = ["api-app"]

[[architecture.module]]
name = "api-storage"
paths = ["apps/api/storage/**"]

[[scope]]
path = "apps/api"
configurations = ["javascript"]
test_files = ["apps/api/app/verification/**", "apps/api/app/qa/**"]
`;

export const QA_IMPORT_CASES = [
    { path: 'app/source.js', importPath: '../storage/value.js', count: 1 },
    { path: 'app/qa/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'app/verification/check.js', importPath: '../../storage/value.js', count: 1 },
    { path: 'app/example.test.js', importPath: '../storage/value.js', count: 0 },
    { path: 'apps/api/app/source.js', importPath: '../storage/value.js', count: 1 },
    { path: 'apps/api/app/verification/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'apps/api/app/qa/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'apps/api/app/example.spec.js', importPath: '../storage/value.js', count: 0 },
] as const;
