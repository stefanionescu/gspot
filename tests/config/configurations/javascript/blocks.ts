export const SELECTOR_FILES = {
    'native/App.jsx':
        'const list = <FlatList data={items} />;\nconst scroll = <ScrollView>{items.map(renderItem)}</ScrollView>;\n',
    'forms/Fields.jsx': `const checkbox = <input type="checkbox" value="a" {...register("choice")} />;
const radio = <input type="radio" value="a" {...register("choice")} />;
const text = <input type="text" value="a" {...register("choice")} />;
const memberCheckbox = <input type="checkbox" value="a" {...form.register("choice")} />;
const memberRadio = <input type="radio" value="a" {...form.register("choice")} />;
const memberText = <input type="text" value="a" {...form.register("choice")} />;
`,
} as const;

export const SELECTOR_LIBRARY_FILES = {
    'counter.js':
        "import { useStore } from './store.js';\nexport function readCount() {\n    return useStore((state) => state.count);\n}\n",
    'cart.js':
        "import { useStore } from 'zustand';\nimport { cartStore, useCartStore } from './store.js';\nexport function readCart() {\n    const whole = useCartStore();\n    return [whole];\n}\n",
    'router.js':
        'const byId = publicProcedure.input(schema);\nexport const appRouter = router({\n    order: publicProcedure.input(schema).query(({ input }) => pool.query(sql)),\n});\n',
} as const;

export const FRAMEWORK_SELECTOR_CASES = [
    {
        configuration: 'nestjs',
        language: 'typescript',
        file: 'source.ts',
        source: 'import { Res, Response, forwardRef } from "@nestjs/common";\nexport class Controller {\n    first(@Res() response: unknown) { return response; }\n    second(@Response({ passthrough: true }) response: unknown) { return response; }\n}\nforwardRef(() => Controller);\n',
        lines: [3, 6],
    },
    {
        configuration: 'react-native',
        language: 'javascript',
        file: 'source.jsx',
        source: 'import { TouchableOpacity, Pressable } from "react-native";\nAsyncStorage.setItem("accessToken", value);\nAsyncStorage.setItem("theme", value);\nexport const button = <Pressable />;\n',
        lines: [1, 2],
    },
] as const;

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
        file: 'eval.js',
        source: 'export const result = eval(process.env.SCRIPT);\n',
        kept: 'gspot/no-code-eval',
        rules: ['security/detect-eval-with-expression', 'gspot/no-code-eval'],
    },
    {
        file: 'buffer.js',
        source: 'export const result = new Buffer(8);\n',
        kept: 'n/no-deprecated-api',
        rules: ['security/detect-new-buffer', 'n/no-deprecated-api'],
    },
    {
        file: 'slow-regex.js',
        source: 'export const pattern = /^(a+)+$/;\n',
        kept: 'regexp/no-super-linear-backtracking',
        rules: ['regexp/no-super-linear-backtracking', 'security/detect-unsafe-regex'],
    },
] as const;

export const DUPLICATE_RULE_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"target":"ESNext","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["*.ts"]}\n',
} as const;

export const IMPORT_RULE_CASES = [
    { level: 'basic', declarations: 'none' },
    { level: 'basic', declarations: 'root' },
    { level: 'basic', declarations: 'scoped' },
    { level: 'all', declarations: 'none' },
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

export const TEST_IMPORT_CASES = [
    { folder: 'src', source: "import { value } from '../tests/value.js';", rejected: true },
    { folder: 'src', source: "import type { Value } from '../tests/value.js';", rejected: true },
    { folder: 'src', source: "import { value } from '../other/value.test.js';", rejected: true },
    { folder: 'tests', source: "import { value } from '../src/value.js';", rejected: false },
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

export const ENVIRONMENT_CASES = [
    { source: 'const port = process.env.PORT;\n', rule: 'n/no-process-env' },
    { source: 'const port = Bun.env.PORT;\n', rule: 'no-restricted-properties' },
    { source: "const port = Deno.env.get('PORT');\n", rule: 'no-restricted-properties' },
    { source: 'const port = import.meta.env.PORT;\n', rule: 'gspot/restricted-syntax' },
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

export const TEST_IMPORT_RULE_CASES = [
    { path: 'app/source.js', importPath: '../storage/value.js', count: 1 },
    { path: 'app/qa/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'app/verification/check.js', importPath: '../../storage/value.js', count: 1 },
    { path: 'app/example.test.js', importPath: '../storage/value.js', count: 1 },
    { path: 'apps/api/app/source.js', importPath: '../storage/value.js', count: 1 },
    { path: 'apps/api/app/verification/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'apps/api/app/example.spec.js', importPath: '../storage/value.js', count: 1 },
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

export const HOST_MODULE = '../../scripts/app.js';
