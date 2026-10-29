export const CRLF_PACKAGE_FILES = {
    'package.json': '{\n    "name": "crlf"\n}\n',
    'bun.lock': '{}\n',
    '.gitignore': 'node_modules/\n',
    'node_modules/example/index.js': 'export const value = 1;',
} as const;

export const LOCKED_NPM_PROJECT_FILES = {
    '.gitignore': 'node_modules/\n',
    'package.json': '{"name":"sample","version":"1.0.0"}\n',
    'package-lock.json': '{"name":"sample","lockfileVersion":3,"packages":{}}\n',
    'source.js': 'export const value = 1;\n',
    'node_modules/item-0/value.js': 'export const value = 2;\n',
} as const;

export const TOOL_PROJECT_FILES = {
    'project/.gspot/package.json': '{}',
    'project/.gspot/bun.lock': '{}',
    'project/.gspot/node_modules/example/index.js': 'export const value = 1;',
    '.gitignore': 'node_modules/\n.gspot/state/\n',
} as const;

export const EXTERNAL_DEPENDENCY_FILES = {
    'package.json': '{}',
    'bun.lock': '{}',
    '.gitignore': 'node_modules/\n',
    'node_modules/example/index.js': 'export const value = 1;',
} as const;

export const BIN_WORKSPACE_FILES = {
    'package.json': '{"workspaces":["packages/*"]}',
    'bun.lock': '{}',
    'packages/cli/package.json': '{"name":"cli","bin":{"cli":"dist/cli.js"}}',
    'packages/cli/dist/cli.js': 'console.log(1);',
    '.gitignore': 'node_modules/\ndist/\n',
} as const;

export const WORKSPACE_LOCK_FILES = {
    'package.json': '{"workspaces":["packages/*"]}',
    'bun.lock': '{}',
    'packages/one/package.json': '{"name":"one"}',
    'packages/two/package.json': '{"name":"two"}',
    'node_modules/root/value.js': 'export const value = 1;',
    'packages/two/node_modules/owned/value.js': 'export const value = 2;',
    '.gitignore': 'node_modules/\n',
} as const;

export const VALUE_ONE_LINE = 'export const value = 1;';

export const DECLARATION_COPY_FILES = {
    'project/.gitignore': 'types/generated.d.ts\n',
    'project/tsconfig.json': '{"include":["src/**/*.ts","types/*.d.ts","../outside.d.ts"]}',
    'project/src/main.ts': 'export const value = 1;\n',
    'project/types/generated.d.ts': 'declare const generated: string;\n',
    'project/types/kept.d.ts': 'declare const kept: number;\n',
    'outside.d.ts': 'declare const outside: boolean;\n',
};
