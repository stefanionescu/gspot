import { CLEAN_BASH_SCRIPT } from '#tests/config/samples.ts';

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

export const NPM_PACK_FLAGS = ['--ignore-scripts', '--json'] as const;

export const UPSTREAM_REGISTRY = 'https://registry.npmjs.org/';

export const GSPOT_PACKAGE_SCOPE = '@gspothq/';

export const PACKED_PUBLISH_TIME = '2025-01-01T00:00:00.000Z';

export const SANDBOX_PACKAGE_JSON = {
    name: 'example',
    version: '1.0.0',
    private: true,
    description: 'A sandbox.',
    type: 'module',
} as const;

export const SANDBOX_GITIGNORE = 'node_modules\n';

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
    'data-files/yamllint',
    'security/semgrep',
    'security/semgrep-registry',
    'format/editorconfig-checker',
    'python/basedpyright',
    'python/pydoclint',
    'python/deptry',
] as const;

export const PYTHON_INDEX_NAME = 'gspot-test';

export const LFS_ATTRIBUTES = '*.bin filter=lfs diff=lfs merge=lfs -text\n';

export const NESTED_SCOPE_FILES = {
    'outside.txt': 'repository context',
    'nested settings/source.txt': 'committed',
} as const;

export const BASH_SANDBOX = {
    cleanSource: CLEAN_BASH_SCRIPT,
    configurations: ['bash', 'javascript'],
    files: {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'scripts/b.sh': CLEAN_BASH_SCRIPT,
        'scripts/build.sh': CLEAN_BASH_SCRIPT,
        'package.json': '{"private":true}\n',
    },
} as const;

export const BASH_SYNTAX_CHECK = String.raw`[[command_check]]
id = "project/bash-syntax"
command = ["bash", "-n", "{file}"]
paths = ["**/*.sh"]
stage = "commit"
output = { format = "regex", pattern = "^.*: line (?<line>\\d+): (?<message>.*)$" }
`;
