export const ARCHITECTURE_CASES = [
    { level: 'recommended', declarations: 'none' } as const,
    { level: 'recommended', declarations: 'root' } as const,
    { level: 'recommended', declarations: 'scoped' } as const,
    { level: 'all', declarations: 'none' } as const,
    { level: 'all', declarations: 'root' } as const,
    { level: 'all', declarations: 'scoped' } as const,
];

export const ARCHITECTURE_POLICIES = {
    none: '[scope."apps/api"]\nconfigurations = ["typescript"]\n',
    root: '[[architecture.modules]]\nname = "app"\npaths = ["app/**"]\nmay_import = ["app"]\n[[architecture.modules]]\nname = "storage"\npaths = ["storage/**"]\n[scope."apps/api"]\nconfigurations = ["typescript"]\n',
    scoped: '[scope."apps/api"]\nconfigurations = ["typescript"]\n[[scope."apps/api".architecture.modules]]\nname = "app"\npaths = ["app/**"]\nmay_import = ["app"]\n[[scope."apps/api".architecture.modules]]\nname = "storage"\npaths = ["storage/**"]\n',
};

export const ARCHITECTURE_PROJECT = {
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
};

export const ARCHITECTURE_CORRECTION = "import { value } from './value.js';\nexport const result = value;\n";

/** Native directions include per-specifier types, aliases, overlapping roles, and public contracts. */
export const ROLE_IMPORT_CASES = [
    { folder: 'unrelated', source: "import { value } from '../tests/value.js';", rejected: false },
    { folder: 'runtime', source: "import { value } from '../other/value.test.js';", rejected: true },
    { folder: 'types', source: "import { value } from '../runtime/value.js';", rejected: true },
    { folder: 'types', source: "import type { Value } from '../runtime/value.js';", rejected: false },
    { folder: 'types', source: "import { type Value } from '@/runtime/value.js';", rejected: false },
    { folder: 'types', source: "import { type Value, value } from '@/runtime/value.js';", rejected: true },
    { folder: 'types', source: "export { type Value } from '../runtime/value.js';", rejected: false },
    { folder: 'types', source: "import { value } from '../types/value.js';", rejected: false },
    { folder: 'runtime', source: "import { value } from '../tests/value.js';", rejected: true },
    { folder: 'runtime', source: "import type { Value } from '../tests/value.js';", rejected: true },
    { folder: 'runtime', source: "import { value } from '../support/value.js';", rejected: true },
    { folder: 'tests', source: "import { value } from '../runtime/value.js';", rejected: true },
    { folder: 'support', source: "import { value } from '../runtime/value.js';", rejected: true },
    { folder: 'tests', source: "import { value } from '../runtime/public.js';", rejected: false },
    { folder: 'support', source: "import { value } from '../runtime/contracts.js';", rejected: false },
    { folder: 'tests', source: "import type { Value } from '../runtime/value.js';", rejected: false },
    { folder: 'config', source: "import { value } from '../runtime/value.js';", rejected: true },
    { folder: 'env', source: "import { value } from '@/runtime/value.js';", rejected: true },
    { folder: 'config', source: "import type { Value } from '../runtime/value.js';", rejected: false },
    { folder: 'other', source: "import { value } from '../runtime/value.js';", rejected: false },
];

/** Both scopes retain authored role paths. Runtime and test patterns can overlap. */
export const ROLE_TABLES = `[[architecture.modules]]
name = "role:runtime"
paths = ["unrelated/**"]
may_import = ["role:runtime"]
[architecture.roles]
types = "types/**"
tests = ["tests/**", "**/*.test.*"]
test_harness = "support"
config = "config/**"
env = "env/**"
runtime = ["runtime/**", "types/**", "tests/**", "support/**", "config/**", "env/**"]
[scope.app]
configurations = ["typescript"]
[scope.app.architecture.roles]
types = "types/**"
tests = ["tests/**", "**/*.test.*"]
test_harness = "support"
config = "config/**"
env = "env/**"
runtime = ["runtime/**", "types/**", "tests/**", "support/**", "config/**", "env/**"]
`;

export const ROLE_TSCONFIG =
    '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","baseUrl":".","paths":{"@/*":["./*"]},"types":[]},"include":["**/*.ts"]}';

export const ROLE_TARGETS = {
    'unrelated/value.ts': 'export const value = 1;\n',
    'runtime/value.ts': 'export const value = 1;\nexport type Value = number;\n',
    'types/value.ts': 'export const value = 1;\nexport type Value = number;\n',
    'tests/value.ts': 'export const value = 1;\nexport type Value = number;\n',
    'support/value.ts': 'export const value = 1;\nexport type Value = number;\n',
    'config/value.ts': 'export const value = 1;\nexport type Value = number;\n',
    'env/value.ts': 'export const value = 1;\nexport type Value = number;\n',
    'other/value.ts': 'export const value = 1;\nexport type Value = number;\n',
    'other/value.test.ts': 'export const value = 1;\n',
    'runtime/public.ts': 'export const value = 1;\n',
    'runtime/contracts.ts': 'export const value = 1;\n',
};

export const ENVIRONMENT_TABLES = `[[architecture.modules]]
name = "environment"
paths = ["config/**"]
[architecture.roles]
env = "environment"
[scope."app"]
configurations = ["typescript"]
[[scope."app".architecture.modules]]
name = "environment"
paths = ["src/env/**"]
[scope."app".architecture.roles]
env = "environment"
[scope."sibling"]
configurations = ["typescript"]
[scope."app/deep"]
configurations = ["typescript"]
[scope."literal"]
configurations = ["typescript"]
[scope."literal".architecture.roles]
env = ["config/**"]
[scope."empty"]
configurations = ["typescript"]
[scope."empty".architecture.roles]
env = []
`;

export const ENVIRONMENT_CASES = [
    { source: 'const port = process.env.PORT;\n', rule: 'n/no-process-env' },
    { source: 'const port = Bun.env.PORT;\n', rule: 'no-restricted-properties' },
    { source: "const port = Deno.env.get('PORT');\n", rule: 'no-restricted-properties' },
    { source: 'const port = import.meta.env.PORT;\n', rule: 'no-restricted-syntax' },
];

export const ENVIRONMENT_COMPOSED = "export * from './other.js';\nconst port = import.meta.env.PORT;\n";
