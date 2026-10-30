export const SORT_RULES = [
    'perfectionist/sort-imports',
    'perfectionist/sort-named-imports',
    'perfectionist/sort-exports',
    'perfectionist/sort-named-exports',
] as const;

export const SORT_CASES = [
    { source: "import { bbb, a, cc } from 'x';\n", fixed: "import { a, cc, bbb } from 'x';\n" },
    { source: 'export { bbb, a, cc };\n', fixed: 'export { a, cc, bbb };\n' },
    {
        source: `// File header
import { bb } from 'bb';
import { aa } from 'aa';
`,
        fixed: `// File header
import { aa } from 'aa';
import { bb } from 'bb';
`,
    },
] as const;

export const SCOPE_PLUGIN_TABLES = `[[tools.eslint.plugins]]
name = "local"
path = "tools/lint/plugin.mjs"
rules = { "no-forbidden" = [] }

[[scope]]
path = "app"
configurations = ["javascript"]
[[scope.tools.eslint.plugins]]
name = "scoped"
path = "tools/lint/plugin.mjs"
rules = { "no-forbidden" = [] }
[[scope]]
path = "app/nested"
configurations = ["javascript"]
`;

export const LOCAL_PLUGIN = `export default {
    rules: {
        'no-forbidden': {
            meta: { type: 'problem', schema: [] },
            create(context) {
                return {
                    Identifier(node) {
                        if (node.name === 'forbidden') context.report({ node, message: 'Use the current API.' });
                    },
                };
            },
        },
    },
};
`;

export const SCOPE_PLUGIN_FILES = {
    '.gitignore': 'node_modules/\n',
    'package.json': '{"private":true,"type":"module"}\n',
    'tools/lint/plugin.mjs': LOCAL_PLUGIN,
    'source.js': 'export const forbidden = 1;\n',
    'outside/source.js': 'export const forbidden = 1;\n',
    'app/package.json': '{"private":true,"type":"module"}\n',
    'app/source.js': 'export const forbidden = 1;\n',
    'app/nested/package.json': '{"private":true,"type":"module"}\n',
    'app/nested/source.js': 'export const forbidden = 1;\n',
};

export const SCOPE_PLUGIN_FINDINGS = [
    { file: 'app/nested/source.js', rule: 'local/no-forbidden', line: 1 },
    { file: 'app/nested/source.js', rule: 'scoped/no-forbidden', line: 1 },
    { file: 'app/source.js', rule: 'local/no-forbidden', line: 1 },
    { file: 'app/source.js', rule: 'scoped/no-forbidden', line: 1 },
    { file: 'outside/source.js', rule: 'local/no-forbidden', line: 1 },
    { file: 'source.js', rule: 'local/no-forbidden', line: 1 },
];

export const CONFLICTING_LOCAL_PLUGIN_TABLES = `[[scope]]
path = "first"
configurations = ["javascript"]
[[scope.tools.eslint.plugins]]
name = "local"
path = "tools/lint/first.mjs"
rules = { "no-forbidden" = [] }
[[scope]]
path = "second"
configurations = ["javascript"]
[[scope.tools.eslint.plugins]]
name = "local"
path = "tools/lint/second.mjs"
rules = { "no-forbidden" = [] }
`;

export const CONFLICTING_LOCAL_PLUGIN_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'first/package.json': '{"private":true,"type":"module"}\n',
    'second/package.json': '{"private":true,"type":"module"}\n',
    'tools/lint/first.mjs': LOCAL_PLUGIN,
    'tools/lint/second.mjs': LOCAL_PLUGIN,
};

export const DUPLICATE_PLUGIN_ERROR = {
    name: 'GspotError',
    code: 'settings',
    message:
        'tools.eslint.plugins: local names two modules, tools/lint/first.mjs and tools/lint/second.mjs. Give each its own prefix.',
} as const;

export const LOCAL_PLUGIN_TABLES = `[[tools.eslint.plugins]]
name = "local"
path = "tools/lint/plugin.mjs"
rules = { "no-forbidden" = [] }
`;

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
    'cart.js':
        "import { useStore } from 'zustand';\nimport { cartStore, useCartStore } from './store.js';\nexport function readCart() {\n    const whole = useCartStore();\n    const all = useStore(cartStore);\n    return [whole, all];\n}\n",
    'form.js':
        "import { useForm } from 'react-hook-form';\nconst options = { resolver: schema };\nexport function useSignup() { return useForm(options); }\n",
    'router.js':
        'const byId = publicProcedure.input(schema);\nexport const appRouter = router({\n    item: byId.query(resolve),\n    order: publicProcedure.input(schema).query(({ input }) => pool.query(sql)),\n});\n',
} as const;

export const FRAMEWORK_SELECTOR_CASES = [
    {
        configuration: 'nestjs',
        language: 'typescript',
        file: 'source.ts',
        source: 'import { Res, Response, forwardRef } from "@nestjs/common";\nexport class Controller {\n    first(@Res() response: unknown) { return response; }\n    second(@Response({ passthrough: true }) response: unknown) { return response; }\n}\nforwardRef(() => Controller);\n',
        basic: [3],
        all: [3, 6],
    },
    {
        configuration: 'react-native',
        language: 'javascript',
        file: 'source.jsx',
        source: 'import { TouchableOpacity, Pressable } from "react-native";\nAsyncStorage.setItem("accessToken", value);\nAsyncStorage.setItem("theme", value);\nexport const button = <Pressable />;\n',
        basic: [2],
        all: [1, 2],
    },
] as const;

export const DUPLICATE_RULE_CASES = [
    {
        file: 'empty-regex.js',
        source: 'export const pattern = /[]/;\n',
        kept: 'regexp/no-empty-character-class',
        rules: ['no-empty-character-class', 'regexp/no-empty-character-class', 'sonarjs/no-empty-character-class'],
    },
    {
        file: 'catch.js',
        source: "export function run() { try { console.log('ready'); } catch (error) { throw error; } }\n",
        kept: 'no-useless-catch',
        rules: ['no-useless-catch', 'sonarjs/no-useless-catch'],
    },
    {
        file: 'nested-if.js',
        source: "export function run() { if (Date.now()) { if (Math.random()) { console.log('ready'); } } }\n",
        kept: 'sonarjs/no-collapsible-if',
        rules: ['unicorn/no-lonely-if', 'sonarjs/no-collapsible-if'],
    },
    {
        file: 'unused.ts',
        source: 'export function run() { const unused = 1; return 2; }\n',
        kept: '@typescript-eslint/no-unused-vars',
        rules: [
            'no-unused-vars',
            '@typescript-eslint/no-unused-vars',
            'sonarjs/no-unused-vars',
            'sonarjs/unused-import',
        ],
    },
    {
        file: 'eval.js',
        source: 'export const result = eval(process.env.SCRIPT);\n',
        kept: 'sonarjs/code-eval',
        rules: ['security/detect-eval-with-expression', 'sonarjs/code-eval'],
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
        rules: ['regexp/no-super-linear-backtracking', 'sonarjs/slow-regex', 'security/detect-unsafe-regex'],
    },
    {
        file: 'deprecated.ts',
        source: "import { legacy } from './api.js';\nexport const result = legacy();\n",
        kept: '@typescript-eslint/no-deprecated',
        rules: ['@typescript-eslint/no-deprecated', 'sonarjs/deprecation'],
    },
] as const;

export const DUPLICATE_RULE_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"target":"ESNext","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["*.ts"]}\n',
    'api.ts': '/** @deprecated Use current instead. */\nexport function legacy() { return 1; }\n',
} as const;
