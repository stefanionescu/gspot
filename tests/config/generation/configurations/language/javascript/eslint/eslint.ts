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
    'jsdoc/require-jsdoc',
    'jsdoc/require-param',
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

export const JSDOC_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["typed.ts"]}\n',
    'jsconfig.json':
        '{"compilerOptions":{"strict":true,"noEmit":true,"checkJs":true,"allowJs":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["missing.js","malformed.js","capitalized.js","undefined.js"]}\n',
    'missing.js': `/**
 * Measure the input.
 * @param value The input text.
 * @returns The input length.
 */
export function measure(value) { return value.length; }
`,
    'malformed.js': `/**
 * Measure the input.
 * @param {string[} value The input text.
 * @returns {number} The input length.
 */
export function measure(value) { return value.length; }
`,
    'capitalized.js': `/**
 * Measure the input.
 * @param {String} value The input text.
 * @returns {number} The input length.
 */
export function measure(value) { return value.length; }
`,
    'undefined.js': `/**
 * Measure the input.
 * @param {MissingType} value The input text.
 * @returns {number} The input length.
 */
export function measure(value) { return value.length; }
`,
    'typed.ts': `/**
 * Measure the input.
 * @param value The input text.
 * @returns The input length.
 */
export function measure(value: string): number { return value.length; }
`,
} as const;

export const CORRECTED_JSDOC = `/**
 * Measure the input.
 * @param {string} value The input text.
 * @returns {number} The input length.
 */
export function measure(value) { return value.length; }
`;

export const JSDOC_RULES = [
    'jsdoc/require-param-type',
    'jsdoc/require-returns-type',
    'jsdoc/valid-types',
    'jsdoc/check-types',
    'jsdoc/no-undefined-types',
] as const;

export const JSDOC_FINDINGS = [
    {
        file: 'missing.js',
        findings: [
            { ruleId: 'jsdoc/require-param-type', line: 3 },
            { ruleId: 'jsdoc/require-returns-type', line: 4 },
        ],
    },
    { file: 'malformed.js', findings: [{ ruleId: 'jsdoc/valid-types', line: 3 }] },
    { file: 'capitalized.js', findings: [{ ruleId: 'jsdoc/check-types', line: 3 }] },
    { file: 'undefined.js', findings: [{ ruleId: 'jsdoc/no-undefined-types', line: 3 }] },
    { file: 'typed.ts', findings: [] },
] as const;

export const ROOT_PARAMETERS = `/**
 * Join a path to the folder.
 * @param root the folder to start from.
 * @param path the path inside it.
 * @returns both, joined with a slash.
 */
export function joinPath(root, path) { return \`\${root}/\${path}\`; }

/**
 * Read the name from the options.
 * @param root0 what to read from.
 * @param root0.name the value to give back.
 * @returns the value of that field.
 */
export function readName({ name }) { return name; }
`;

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

export const RUNTIME_CASES = [
    {
        runtime: 'browser',
        globals: ['window', 'document'],
        absent: ['process', 'Buffer', 'require', '__dirname', 'importScripts'],
    },
    {
        runtime: 'worker',
        globals: ['postMessage', 'DedicatedWorkerGlobalScope', 'importScripts'],
        absent: ['process', 'Buffer', 'require', '__dirname', 'clients'],
    },
    {
        runtime: 'react-native',
        globals: ['__DEV__', 'process', 'require'],
        absent: ['Buffer', '__dirname', '__filename', 'module'],
    },
] as const;

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

export const IMPORT_FILES = {
    'package.json': '{"private":true,"type":"module","imports":{"#owner":"./src/owner.ts","#lib/*":"./src/*"}}\n',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"noEmit":true,"module":"ESNext","moduleResolution":"Bundler","baseUrl":".","paths":{"@/*":["src/*"]}},"include":["src/**/*.ts","app/src/**/*.ts"]}\n',
    'src/source.ts': 'export const source = 1;\n',
    'src/owner.ts': 'export const value = 1;\n',
    'src/private/owner.ts': 'export const value = 1;\n',
    'src/index.ts': 'export const source = 1;\n',
    'app/src/source.ts': 'export const source = 1;\n',
    'app/src/owner.ts': 'export const value = 1;\n',
    'app/src/index.ts': 'export const source = 1;\n',
} as const;

export const IMPORT_CASES = [
    ['relative missing', 'import { value } from "./owner";\n', 'n/file-extension-in-import', 1],
    ['relative emitted suffix', 'import { value } from "./owner.js";\n', 'n/file-extension-in-import', 0],
    ['hash alias missing', 'import { value } from "#lib/owner";\n', 'no-restricted-syntax', 1],
    ['exact hash alias', 'import { value } from "#owner";\n', 'no-restricted-syntax', 0],
    ['at alias missing', 'import { value } from "@/owner";\n', 'no-restricted-syntax', 1],
    ['private alias suffix', 'import { value } from "@/private/owner.js";\n', 'no-restricted-syntax', 0],
    ['alias dynamic import', 'const owner = await import("#lib/owner");\n', 'no-restricted-syntax', 1],
] as const;

export const BARREL_CASES = [
    ['at threshold', 'export { value as a } from "./owner.js"; export { value as b } from "./owner.js";', 0],
    [
        'over threshold',
        'export { value as a } from "./owner.js"; export { value as b } from "./owner.js"; export * from "./owner.js";',
        1,
    ],
    ['one mixed export statement', 'export { value as a, value as b, value as c } from "./owner.js";', 1],
    ['declaration-heavy module', 'const a=1,b=2,c=3; export { a,b,c };', 0],
    ['type star', 'export type * from "./owner.js";', 0],
] as const;

export const LEVEL_REEXPORT_CASES = [
    ['basic', 'none'],
    ['basic', 'index-only'],
    ['all', 'none'],
    ['all', 'index-only'],
] as const;

export const ENTRYPOINT_TABLES = `[tools.knip]
entry = ["src/main.js"]

[[scope]]
path = "api"
configurations = ["javascript"]

tools.knip.entry = ["api/src/main.js"]
`;

export const TRIVIAL_RULES = ['gspot/no-trivial-files', 'gspot/no-trivial-functions'] as const;

export const TRIVIAL_ENTRYPOINT_FILES = ['api/src/main.js', 'api/src/task.js', 'src/main.js', 'src/task.js'] as const;

export const STARTER_SOURCE =
    'export function start() { const target = document.querySelector("#app"); if (!target) throw new Error("Missing application target"); target.textContent = "Started"; }\n';

export const ENTRYPOINT_SOURCE = "export { start } from './start.js';\n";

export const REEXPORT_CASES = [
    ['export * from "./owner.js";\n', 1],
    ['export { value } from "./owner.js";\n', 1],
    ['const value = 1; export { value };\n', 0],
] as const;
