/** A Bun project whose package.json has CRLF line ends. */
export const CRLF_PACKAGE_FILES = {
    'package.json': '{\n    "name": "crlf"\n}\n',
    'bun.lock': '{}\n',
    '.gitignore': 'node_modules/\n',
    'node_modules/example/index.js': 'export const value = 1;',
} as const;

/** An npm project with a lockfile. */
export const LOCKED_NPM_PROJECT_FILES = {
    '.gitignore': 'node_modules/\n',
    'package.json': '{"name":"fixture","version":"1.0.0"}\n',
    'package-lock.json': '{"name":"fixture","lockfileVersion":3,"packages":{}}\n',
    'source.js': 'export const value = 1;\n',
    'node_modules/item-0/value.js': 'export const value = 2;\n',
} as const;

/** A gspot tool project with installed packages. */
export const TOOL_PROJECT_FILES = {
    'project/.gspot/package.json': '{}',
    'project/.gspot/bun.lock': '{}',
    'project/.gspot/node_modules/example/index.js': 'export const value = 1;',
    '.gitignore': 'node_modules/\n.gspot/state/\n',
} as const;

/** A project with external dependencies. */
export const EXTERNAL_DEPENDENCY_FILES = {
    'package.json': '{}',
    'bun.lock': '{}',
    '.gitignore': 'node_modules/\n',
    'node_modules/example/index.js': 'export const value = 1;',
} as const;

/** A Bun workspace whose package has a bin. */
export const BIN_WORKSPACE_FILES = {
    'package.json': '{"workspaces":["packages/*"]}',
    'bun.lock': '{}',
    'packages/cli/package.json': '{"name":"cli","bin":{"cli":"dist/cli.js"}}',
    'packages/cli/dist/cli.js': 'console.log(1);',
    '.gitignore': 'node_modules/\ndist/\n',
} as const;

/** A Bun workspace with two packages. */
export const WORKSPACE_LOCK_FILES = {
    'package.json': '{"workspaces":["packages/*"]}',
    'bun.lock': '{}',
    'packages/one/package.json': '{"name":"one"}',
    'packages/two/package.json': '{"name":"two"}',
    'node_modules/root/value.js': 'export const value = 1;',
    'packages/two/node_modules/owned/value.js': 'export const value = 2;',
    '.gitignore': 'node_modules/\n',
} as const;
