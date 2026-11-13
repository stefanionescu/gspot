// block calls
export const ESCAPED_SCOPE_CONFIGURATIONS = ['javascript', 'react'] as const;

// rule options
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
export const IGNORE_CASES = [
    { name: 'without an ignore', ignored: false },
    { name: 'with an ignore', ignored: true },
];
export const RESTRICTED_IMPORT_FINDINGS = [
    { file: 'app/deep/source.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'app/source.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'sibling/source.js', rule: 'no-restricted-imports', line: 2 },
    { file: 'source.js', rule: 'no-restricted-imports', line: 2 },
    { file: 'state/store.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'state/widget.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'state/widget.js', rule: 'no-restricted-imports', line: 3 },
] as const;
const RESTRICTED_IMPORT_SOURCE = `import { readFile } from 'node:fs';
import { join } from 'node:path';
export const files = [readFile, join];
`;
const RESTRICTED_ZUSTAND_SOURCE = `import { readFile } from 'node:fs';
import { join } from 'node:path';
import { create } from 'zustand';
export const store = create(() => ({ readFile, join }));
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

// runtimes
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
export const PROCESS_UNDEFINED_MESSAGE = "'process' is not defined.";
export const RUNTIME_OVERRIDE_SETTINGS = {
    rules: true,
    tables: '[[tools.eslint.override]]\npaths = [ "native/src/browser.js" ]\nruntime = "browser"\n\n[[tools.eslint.override]]\npaths = [ "native/scripts/worker.js" ]\nruntime = "worker"\n\n[[tools.eslint.override]]\npaths = [ "native/server/**/*" ]\nruntime = "node"\n',
    scopes: [
        { path: 'native', configurations: ['react-native'] },
        { path: 'web', configurations: ['react'] },
        { path: 'native/server', configurations: ['javascript'] },
    ],
} as const;
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
export const WINDOW_UNDEFINED_MESSAGE = "'window' is not defined.";
