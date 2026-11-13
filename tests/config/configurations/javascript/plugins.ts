// imports
export const HOST_MODULE = '../../scripts/app.js';
export const IMPORT_CASES = [
    ['relative missing', 'import { value } from "./owner";\n', 'n/file-extension-in-import', 1],
    ['relative emitted suffix', 'import { value } from "./owner.js";\n', 'n/file-extension-in-import', 0],
    ['hash alias missing', 'import { value } from "#lib/owner";\n', 'gspot/restricted-syntax', 1],
    ['exact hash alias', 'import { value } from "#owner";\n', 'gspot/restricted-syntax', 0],
    ['at alias missing', 'import { value } from "@/owner";\n', 'gspot/restricted-syntax', 1],
    ['private alias suffix', 'import { value } from "@/private/owner.js";\n', 'gspot/restricted-syntax', 0],
    ['alias dynamic import', 'const owner = await import("#lib/owner");\n', 'gspot/restricted-syntax', 1],
] as const;
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

// jsdoc
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

// local plugins
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

// trivial rules
export const INDEX_ONLY_REEXPORTS = '{ value = "index-only", reason = "The package exports its public index files." }';
export const LEVEL_REEXPORT_CASES = [
    ['basic', 'none'],
    ['all', 'none'],
    ['all', 'index-only'],
] as const;
export const REEXPORT_CASES = [
    ['export * from "./owner.js";\n', 1],
    ['export { value } from "./owner.js";\n', 1],
    ['const value = 1; export { value };\n', 0],
] as const;
