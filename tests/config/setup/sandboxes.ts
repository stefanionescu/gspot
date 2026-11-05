import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';

export const SYNCPACK_PACKAGE_FILES = {
    'package.json': '{"name":"root","private":true,"dependencies":{"shared-library":"1.0.0"}}\n',
    'packages/app/package.json': '{"name":"app","private":true,"dependencies":{"shared-library":"2.0.0"}}\n',
} as const;

export const SQL_COMMAND_CHECK = { id: 'project/read-sql', paths: ['**/*.sql'], stage: 'commit' };

export const SQL_SEARCH_ARGUMENTS = [
    '--text',
    'CREATE FUNCTION',
    '--report',
    'message',
    '--message',
    'Replace the sample function.',
    '--',
    '{files}',
];

export const SETTING_REASON = 'The project contract requires this reviewed exception.';

export const HOOKS_SETTINGS = '[hooks]\nenabled = true\n';

const REPLACED_CONFIGS = {
    'typos.toml': `[default.extend-words]
# The device identifier API name.
udid = "udid"
`,
    '.shellcheckrc': 'disable=SC2086,SC2034\n',
    '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
    '.eslintrc.json': '{ "rules": { "eqeqeq": "error" } }\n',
    '.prettierrc': '{ "semi": false }\n',
} as const;

export const INIT_FILES = {
    ...REPLACED_CONFIGS,
    'scripts/a.sh': CLEAN_BASH_SCRIPT,
    'src/a.js': 'export const a = 1;\n',
    'README.md': '# test\n',
    'quality/lint.sh': CLEAN_BASH_SCRIPT,
} as const;

export const CANCELED_CHECK_NOTE = 'The check was canceled.';

export const GIT_ISOLATION_ENVIRONMENT = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '',
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'maintenance.auto',
    GIT_CONFIG_VALUE_0: 'false',
    GIT_CONFIG_KEY_1: 'gc.auto',
    GIT_CONFIG_VALUE_1: '0',
} as const;

export const RULE_TESTER_ROOT = '/repo';

export const RULE_TESTER_PARSER_OPTIONS = {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
} as const;

export const TYPED_RULE_FOLDER_PREFIX = 'typed-rules-';

export const TYPED_RULE_FILES = ['file.ts', 'react.tsx'] as const;

export const TYPED_RULE_TSCONFIG = JSON.stringify({
    compilerOptions: { strict: true, target: 'esnext', module: 'nodenext', lib: ['esnext', 'dom'], jsx: 'preserve' },
    include: ['*.ts', '*.tsx'],
});

export const TOOL_PATHS_FILE = 'tool-paths.txt';

export const GSPOT_LAUNCHER_PATH = 'bin/gspot';

export const TOOL_PINS_FILE = 'mise.toml';

export const TOOL_INSTALL_FOLDER = 'tools';

export const MISE_TRUST = ['mise', 'trust'] as const;

export const GSPOT_PACKAGE_SCOPE = '@gspothq/';

export const NPM_PACK_FLAGS = ['--ignore-scripts', '--json'] as const;

export const PACKED_PUBLISH_TIME = '2025-01-01T00:00:00.000Z';

export const UPSTREAM_REGISTRY = 'https://registry.npmjs.org/';

export const PACKED_PACKAGES_FILE = 'packages.json';

export const TEST_TIMEOUT_MILLISECONDS = 360_000;

export const CHILD_WAIT_MILLISECONDS = 15_000;

export const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required';

export const LINE_BREAK = /\r?\n/u;

export const MISSING_TEST_RUN_FOLDER = 'Set TEST_RUN_FOLDER before running the test suite.';

export const CACHE_FOLDER = 'cache';

export const TEMPORARY_FOLDER = 'temporary';

export const CONFIG_FOLDER = 'config';

export const NPM_INSTALL_FLAGS = ['--ignore-scripts', '--no-audit', '--no-fund'] as const;

export const PNPM_WORKSPACE = 'packages:\n  - "**"\n';

export const PUSH_CONTENT = {
    base: 'echo base\n',
    reviewed: 'echo reviewed\n',
    broken: 'if then\n',
    working: 'echo repaired only in the working tree\n',
    settings: 'invalid working policy',
} as const;

export const REGISTRY_HOST = '127.0.0.1';

export const NPM_REGISTRY_TOKEN = 'synthetic-package-install-token';

export const SANDBOX_PACKAGE_JSON = {
    name: 'example',
    version: '1.0.0',
    private: true,
    description: 'A sandbox.',
    type: 'module',
} as const;

export const SANDBOX_GITIGNORE = 'node_modules\n';

export const SANDBOX_PACKAGES = {
    '@nestjs/common': '11.2.3',
    '@nestjs/core': '11.2.3',
    '@types/react': '19.1.13',
    '@vitest/coverage-v8': '4.1.12',
    astro: '7.3.8',
    bats: '1.13.0',
    jest: '30.2.0',
    next: '16.4.1',
    pnpm: '10.34.6',
    react: '19.1.1',
    'react-dom': '19.1.1',
    'reflect-metadata': '0.2.2',
    rxjs: '7.8.2',
    supabase: '2.118.0',
    svelte: '5.57.0',
    vitest: '4.1.12',
    vue: '3.5.42',
    wrangler: '4.151.1',
    yarn: '1.22.22',
} as const;

export const NPM_PROJECT_FILES = {
    'other/package.json': '{"private":true,"packageManager":"npm@99.0.0"}',
    'source.js': 'export const greeting="hello";',
    'node_modules/authored.txt': 'keep project dependencies',
} as const;

export const NPM_PROJECT_IGNORES = [
    'data-files/v8r',
    'javascript/eslint',
    'javascript/tsc',
    'javascript/knip',
] as const;

export const NPM_PROJECT_ROOT_PACKAGE = {
    private: true,
    devDependencies: { eslint: '0.0.0-authored' },
    scripts: { test: 'authored-command' },
    workspaces: ['**'],
} as const;

export const YARN_VERSION_THRESHOLD = 2;

export const PYTHON_PROJECT_FILES = {
    'pyproject.toml': `[project]
name = "authored"
version = "1.0.0"
dependencies = ["authored-dependency"]
`,
    '.venv/authored.txt': 'keep the project environment',
    'source.py': 'import os\n',
} as const;

export const UV_PROJECT_VARIABLES = ['UV_PROJECT', 'UV_WORKING_DIR', 'UV_PROJECT_ENVIRONMENT'] as const;

export const PYTHON_PROJECT_IGNORES = [
    'data-files/v8r',
    'security/semgrep',
    'format/editorconfig-checker',
    'python/basedpyright',
    'python/pydoclint',
    'python/deptry',
    'python/vulture',
] as const;

export const PYTHON_INDEX_NAME = 'gspot-test';

export const LFS_ATTRIBUTES = '*.bin filter=lfs diff=lfs merge=lfs -text\n';

export const NESTED_SCOPE_FILES = {
    'outside.txt': 'repository context',
    'nested settings/source.txt': 'committed',
} as const;

const BASH_SYNTAX_COMMAND = `[[command_check]]
id = "project/bash-syntax"
command = ["bash", "-n", "{file}"]
paths = ["**/*.sh"]
`;

const BASH_SYNTAX_OUTPUT = String.raw`output = { format = "regex", pattern = "^.*: line (?<line>\\d+): (?<message>.*)$" }
`;

export const BASH_SYNTAX_CHECK = `${BASH_SYNTAX_COMMAND}stage = "commit"\n${BASH_SYNTAX_OUTPUT}`;

export const BASH_SYNTAX_PUSH_CHECK = `${BASH_SYNTAX_COMMAND}stage = "push"\n${BASH_SYNTAX_OUTPUT}`;

export const TEAMS_TABLE_SQL = 'CREATE TABLE teams (id integer PRIMARY KEY);\n';

export const TEAMS_MIGRATION_PATH = 'migrations/20240201_teams.sql';

export const IGNORE_ALL_PATTERN = '*\n';

export const CHANGED_CONTEXT = 'changed context';

export const EMPTY_TOOL_INSTALL = { installed: [], missing: [], notes: [], steps: [] };

export const SANDBOX_REMOVAL_REASON = 'The sandbox exercises selected checks without this configuration.';
