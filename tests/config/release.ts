// The literal values support/release reads: names, patterns, limits, and tables.

export const RELEASE_TIMEOUT_MS = 180_000;

export const OFFLINE_ENVIRONMENT = {
    HTTP_PROXY: 'http://127.0.0.1:1',
    HTTPS_PROXY: 'http://127.0.0.1:1',
    ALL_PROXY: 'http://127.0.0.1:1',
    NO_PROXY: '',
    http_proxy: undefined,
    https_proxy: undefined,
    all_proxy: undefined,
    no_proxy: undefined,
};

export const BUILD_CHECKOUT_PATHS = [
    'packages/cli',
    'packages/npm',
    'package.json',
    'bun.lock',
    'bunfig.toml',
    'tsconfig.json',
    'LICENSE.md',
    'docs/package.json',
    'packages/eslint-plugin/package.json',
];

export const EMBEDDED_PARSER_SOURCES = {
    'task.sh': 'shell_command=1\n',
    'task.py': 'shell_command = 1\n',
    'Task.swift': 'let shellCommand = 1\n',
    'task.js': 'export const shellCommand = 1;\n',
    'task.ts': 'export const shellCommand: number = 1;\n',
    'task.tsx': 'export const shellCommand = <div />;\n',
    'task.sql': 'CREATE TABLE shell_table (id integer);\n',
};

export const EMBEDDED_INIT_ARGS = [
    'init',
    '--yes',
    '--configurations',
    'formatting',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-install',
    '--json',
];
