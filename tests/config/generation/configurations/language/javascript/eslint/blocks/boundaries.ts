export const IMPORT_RULE_CASES = [
    { level: 'basic', declarations: 'none' },
    { level: 'basic', declarations: 'root' },
    { level: 'basic', declarations: 'scoped' },
    { level: 'all', declarations: 'none' },
    { level: 'all', declarations: 'root' },
    { level: 'all', declarations: 'scoped' },
] as const;

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

export const BOUNDARY_IMPORT_TABLES = `[[import_rule]]
name = "core"
paths = ["core/**"]

[[import_rule]]
name = "storage"
paths = ["storage/**"]

[[import_rule]]
name = "app"
paths = ["app/**"]
can_import = ["storage"]
`;

export const TEST_IMPORT_CASES = [
    { folder: 'src', source: "import { value } from '../tests/value.js';", rejected: true },
    { folder: 'src', source: "import type { Value } from '../tests/value.js';", rejected: true },
    { folder: 'src', source: "import { value } from '../other/value.test.js';", rejected: true },
    { folder: 'tests', source: "import { value } from '../src/value.js';", rejected: false },
    { folder: 'tests', source: "import type { Value } from '../src/value.js';", rejected: false },
] as const;

export const ENVIRONMENT_TABLES = `[structure]
environment_readers = { value = ["config/**", "app/src/env/**", "literal/config/**"], reason = "This test sets the allowed locations explicitly." }

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
test_files = ["apps/api/app/verification/**", "apps/api/app/qa/**"]
`;

export const TEST_IMPORT_RULE_CASES = [
    { path: 'app/source.js', importPath: '../storage/value.js', count: 1 },
    { path: 'app/qa/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'app/verification/check.js', importPath: '../../storage/value.js', count: 1 },
    { path: 'app/example.test.js', importPath: '../storage/value.js', count: 1 },
    { path: 'apps/api/app/source.js', importPath: '../storage/value.js', count: 1 },
    { path: 'apps/api/app/verification/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'apps/api/app/qa/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'apps/api/app/example.spec.js', importPath: '../storage/value.js', count: 1 },
] as const;

export const REFUSED_IMPORT_MESSAGES = [
    {
        line: 2,
        message:
            'Import rule "app" may import its own files and "storage", not ../core/value.js from import-rule:core. Move the code, move that rule above this one, or list the rules it may import in can_import.',
    },
] as const;

export const ENVIRONMENT_READER_PATHS = [
    'src/source.js',
    'config/env.js',
    'app/src/source.js',
    'app/src/env/source.js',
    'sibling/src/source.js',
    'app/deep/src/source.js',
    'literal/src/source.js',
    'literal/config/env.js',
] as const;

export const TEST_IMPORT_TSCONFIG =
    '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","baseUrl":".","paths":{"@/*":["./*"]},"types":[]},"include":["**/*.ts"]}';
