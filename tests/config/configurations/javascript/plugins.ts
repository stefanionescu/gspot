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
    'app/tools/lint/plugin.mjs': LOCAL_PLUGIN,
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
    'first/tools/lint/first.mjs': LOCAL_PLUGIN,
    'second/tools/lint/second.mjs': LOCAL_PLUGIN,
};

export const DUPLICATE_PLUGIN_ERROR = {
    name: 'GspotError',
    code: 'settings',
    message:
        'tools.eslint.plugins: local names two modules, first/tools/lint/first.mjs and second/tools/lint/second.mjs. Give each its own prefix.',
} as const;

export const LOCAL_PLUGIN_TABLES = `[[tools.eslint.plugins]]
name = "local"
path = "tools/lint/plugin.mjs"
rules = { "no-forbidden" = [] }
`;

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

export const MEMBER_FUNCTIONS = `export const command = {
    run: (value) => value.length,
    trim(value) { return value.trim(); },
    check: function (value) { return value === ''; },
};

export const measure = (value) => value.length;

export const check = function (value) { return value === ''; };
`;

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
    ['hash alias missing', 'import { value } from "#lib/owner";\n', 'gspot/restricted-syntax', 1],
    ['exact hash alias', 'import { value } from "#owner";\n', 'gspot/restricted-syntax', 0],
    ['at alias missing', 'import { value } from "@/owner";\n', 'gspot/restricted-syntax', 1],
    ['private alias suffix', 'import { value } from "@/private/owner.js";\n', 'gspot/restricted-syntax', 0],
    ['alias dynamic import', 'const owner = await import("#lib/owner");\n', 'gspot/restricted-syntax', 1],
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
    ['all', 'none'],
    ['all', 'index-only'],
] as const;

export const ENTRYPOINT_TABLES = `[javascript]
entry_files = ["src/main.js"]

[[scope]]
path = "api"
configurations = ["javascript"]

javascript.entry_files = ["src/main.js"]
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
