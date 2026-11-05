export const ESCAPED_SCOPE_CONFIGURATIONS = ['javascript', 'react'] as const;

export const NESTED_ESLINT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'app/package.json':
        '{"name":"nested-app","version":"0.0.0-test","type":"module","devDependencies":{"zod":"0.0.0-test"}}\n',
    'app/spec/read.js':
        'import { z } from "zod";\nexport function read(value) { return z.string().parse(value); }\nconsole.log("test");\n',
    'app/scripts/build.js': 'console.log("script");\nprocess.exit(0);\n',
    'app/.mise/tasks/build.js': 'console.log("task");\nprocess.exit(0);\n',
    'app/source.js': 'console.log("source");\nprocess.exit(0);\n',
} as const;

export const NESTED_ESLINT_PATHS = [
    'app/spec/read.js',
    'app/scripts/build.js',
    'app/.mise/tasks/build.js',
    'app/source.js',
] as const;

export const NESTED_ESLINT_RULES = [
    'n/no-unpublished-import',
    'n/no-process-exit',
    'unicorn/no-process-exit',
    'no-console',
] as const;

export const WILDCARD_ESLINT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'app/read.js': 'console.log("test");\n',
    'app/build.js': 'console.log("script");\n',
    'sibling/read.js': 'console.log("source");\n',
    'sibling/build.js': 'console.log("source");\n',
} as const;

export const COALESCING_SOURCE = `export function fallback(value) {
    const alternate = value || {};
    return alternate ?? {};
}
export const known = (value) => value ?? { known: true };
`;

export const COALESCING_CORRECTED = `export function fallback(value) {
    if (value === undefined) return;
    return value;
}
export const known = (value) => value ?? { known: true };
`;

export const CONFIGURATION_RULE_OPTIONS = {
    tables: '[tools.eslint.rules]\n"@typescript-eslint/no-floating-promises" = [{ ignoreVoid = true }]\n',
    files: {
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["source.ts"]}\n',
        'source.ts': 'void Promise.resolve();\nPromise.resolve();\n',
    },
} as const;

export const DOCUMENTED_PRICE_SOURCE = `/**
Add the two prices.
@param {number} first the first price.
@param {number} second the second price.
@returns {number} the total.
*/
export function addPrices(first, second) {
    return first + second;
}
`;

export const RUNTIME_CASES = [{ runtime: 'browser' }, { runtime: 'worker' }, { runtime: 'react-native' }] as const;

export const FRAMEWORK_RUNTIME_CASES = [
    {
        configuration: 'vue',
        path: 'src/Worker.vue',
        source: '<script setup>postMessage("value"); window.alert("value"); process.exit(0);</script><template><p>worker</p></template>\n',
    },
    {
        configuration: 'svelte',
        path: 'src/Worker.svelte',
        source: '<script>postMessage("value"); window.alert("value"); process.exit(0);</script><p>worker</p>\n',
    },
] as const;

export const RUNTIME_OVERRIDE_TABLES = {
    tools: {
        eslint: {
            override: [
                { paths: ['**/*.js'], runtime: 'browser' },
                { paths: ['worker.js'], runtime: 'worker' },
            ],
        },
    },
} as const;

export const RUNTIME_OVERRIDE_SETTINGS = {
    rules: true,
    tables: '[[tools.eslint.override]]\npaths = [ "native/src/browser.js" ]\nruntime = "browser"\n\n[[tools.eslint.override]]\npaths = [ "native/scripts/worker.js" ]\nruntime = "worker"\n\n[[tools.eslint.override]]\npaths = [ "native/server/**/*" ]\nruntime = "node"\n',
    scopes: [
        { path: 'native', configurations: ['react-native'] },
        { path: 'web', configurations: ['react'] },
        { path: 'native/server', configurations: ['javascript'] },
    ],
} as const;

export const RUNTIME_GLOBAL_FINDINGS = [
    { file: 'server.js', messages: [] },
    { file: 'native/src/source.js', messages: [{ ruleId: 'no-undef', line: 2, message: "'Buffer' is not defined." }] },
    {
        file: 'native/src/browser.js',
        messages: [
            { ruleId: 'no-undef', line: 2, message: "'__DEV__' is not defined." },
            { ruleId: 'no-undef', line: 3, message: "'process' is not defined." },
        ],
    },
    { file: 'web/source.js', messages: [{ ruleId: 'no-undef', line: 2, message: "'process' is not defined." }] },
    { file: 'native/scripts/build.js', messages: [] },
    { file: 'native/server/source.js', messages: [] },
    { file: 'web/scripts/build.js', messages: [] },
    {
        file: 'native/scripts/worker.js',
        messages: [{ ruleId: 'no-undef', line: 2, message: "'Buffer' is not defined." }],
    },
];

export const WINDOW_UNDEFINED_MESSAGE = "'window' is not defined.";

export const PROCESS_UNDEFINED_MESSAGE = "'process' is not defined.";

const RESTRICTED_IMPORT_SOURCE = `import { readFile } from 'node:fs';
import { join } from 'node:path';
export const files = [readFile, join];
`;

const RESTRICTED_ZUSTAND_SOURCE = `import { readFile } from 'node:fs';
import { join } from 'node:path';
import { create } from 'zustand';
export const store = create(() => ({ readFile, join }));
`;

export const ESLINT_OVERRIDES_SETTINGS = `configurations = [ "javascript" ]

[rule_files]
enabled = false

[tools.eslint.rules]
eqeqeq = [ "smart" ]

[[tools.eslint.override]]
paths = [ "tests" ]

[tools.eslint.override.rules]
eqeqeq = [ "always" ]

[[tools.eslint.override]]
paths = [ "tests/exempt.js" ]

[tools.eslint.override.rules]
eqeqeq = [ "smart" ]

[[tools.eslint.override]]
paths = [ "apps/web/**", "!apps/web/exempt.js" ]

[tools.eslint.override.rules]
eqeqeq = [ "smart" ]

[[tools.eslint.override]]
paths = [ "apps/web/admin/**" ]

[tools.eslint.override.rules]
eqeqeq = [ "always" ]

[[scope]]
path = "apps/web"

[scope.tools.eslint.rules]
eqeqeq = [ "always" ]

[[scope]]
path = "apps/web/admin"
`;

export const SCOPE_IMPORT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'source.js': RESTRICTED_IMPORT_SOURCE,
    'sibling/source.js': RESTRICTED_IMPORT_SOURCE,
    'app/source.js': RESTRICTED_IMPORT_SOURCE,
    'app/deep/source.js': RESTRICTED_IMPORT_SOURCE,
    'app/clear/source.js': RESTRICTED_IMPORT_SOURCE,
    'state/widget.js': RESTRICTED_ZUSTAND_SOURCE,
    'state/store.js': RESTRICTED_ZUSTAND_SOURCE,
} as const;

export const SCOPE_IMPORT_TABLES = `[javascript]
banned_imports = [{ name = "node:path", message = "Use the path service." }]

[[scope]]
path = "app"
[scope.javascript]
banned_imports = [{ name = "node:fs", message = "Use the storage service." }]

[[scope]]
path = "app/deep"

[[scope]]
path = "app/clear"
[scope.javascript]
banned_imports = []

[[scope]]
path = "state"
configurations = ["zustand"]
[scope.javascript]
banned_imports = [{ name = "node:fs", message = "Use the storage service." }]
[scope.zustand]
store_files = { value = ["store.js"], reason = "This test sets the allowed locations explicitly." }
`;

export const RESTRICTED_IMPORT_FINDINGS = [
    { file: 'app/deep/source.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'app/source.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'sibling/source.js', rule: 'no-restricted-imports', line: 2 },
    { file: 'source.js', rule: 'no-restricted-imports', line: 2 },
    { file: 'state/store.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'state/widget.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'state/widget.js', rule: 'no-restricted-imports', line: 3 },
] as const;

export const IGNORE_CASES = [
    { name: 'without an ignore', ignored: false },
    { name: 'with an ignore', ignored: true },
];
