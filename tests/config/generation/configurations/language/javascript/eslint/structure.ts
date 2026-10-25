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
    ['recommended', 'none'],
    ['recommended', 'index-only'],
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

export const ENTRYPOINT_FOLDERS = ['src', 'api/src'] as const;

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
