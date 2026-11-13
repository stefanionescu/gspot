// bash syntax check
const BASH_SYNTAX_COMMAND = `[[command_check]]
id = "project/bash-syntax"
command = ["bash", "-n", "{file}"]
paths = ["**/*.sh"]
`;
const BASH_SYNTAX_OUTPUT = String.raw`output = { format = "regex", pattern = "^.*: line (?<line>\\d+): (?<message>.*)$" }
`;
export const BASH_SYNTAX_CHECK = `${BASH_SYNTAX_COMMAND}stage = "commit"\n${BASH_SYNTAX_OUTPUT}`;
export const BASH_SYNTAX_PUSH_CHECK = `${BASH_SYNTAX_COMMAND}stage = "push"\n${BASH_SYNTAX_OUTPUT}`;

// node modules
export const IGNORE_ALL_PATTERN = '*\n';

// project sandboxes
export const NPM_INSTALL_FLAGS = ['--ignore-scripts', '--no-audit', '--no-fund'] as const;
export const PNPM_WORKSPACE = 'packages:\n  - "**"\n';
export const PYTHON_INDEX_NAME = 'gspot-test';
export const PYTHON_PROJECT_FILES = {
    'pyproject.toml': `[project]
name = "authored"
version = "1.0.0"
dependencies = ["authored-dependency"]
`,
    '.venv/authored.txt': 'keep the project environment',
    'source.py': 'import os\n',
} as const;
export const PYTHON_PROJECT_IGNORES = [
    'json/v8r',
    'security/semgrep',
    'format/editorconfig-checker',
    'python/basedpyright',
    'python/pydoclint',
    'python/deptry',
    'python/vulture',
] as const;
export const SANDBOX_PACKAGES = {
    '@nestjs/common': '11.2.3',
    '@types/react': '19.1.13',
    '@vitest/coverage-v8': '4.1.12',
    astro: '7.3.8',
    jest: '30.2.0',
    next: '16.4.1',
    pnpm: '10.34.6',
    react: '19.1.1',
    'react-dom': '19.1.1',
    svelte: '5.57.0',
    vitest: '4.1.12',
    vue: '3.5.42',
    wrangler: '4.151.1',
} as const;
export const UV_PROJECT_VARIABLES = ['UV_PROJECT', 'UV_WORKING_DIR', 'UV_PROJECT_ENVIRONMENT'] as const;

// repository sandboxes
export const CHANGED_CONTEXT = 'changed context';
export const LFS_ATTRIBUTES = '*.bin filter=lfs diff=lfs merge=lfs -text\n';
export const NESTED_SCOPE_FILES = {
    'outside.txt': 'repository context',
    'nested settings/source.txt': 'committed',
} as const;
export const PUSH_CONTENT = {
    base: 'echo base\n',
    reviewed: 'echo reviewed\n',
    broken: 'if then\n',
    working: 'echo repaired only in the working tree\n',
    settings: 'invalid working policy',
} as const;
export const PUSH_WORKING_TREE = { settings: PUSH_CONTENT.settings, changed: PUSH_CONTENT.working } as const;
export const TEAMS_MIGRATION_PATH = 'migrations/20240201_teams.sql';
export const TEAMS_TABLE_SQL = 'CREATE TABLE teams (id integer PRIMARY KEY);\n';

// rule tester
export const RULE_TESTER_PARSER_OPTIONS = {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
} as const;
export const RULE_TESTER_ROOT = '/repo';
export const TYPED_RULE_FILES = ['file.ts', 'react.tsx'] as const;
export const TYPED_RULE_FOLDER_PREFIX = 'typed-rules-';
export const TYPED_RULE_TSCONFIG = JSON.stringify({
    compilerOptions: { strict: true, target: 'esnext', module: 'nodenext', lib: ['esnext', 'dom'], jsx: 'preserve' },
    include: ['*.ts', '*.tsx'],
});

// sandbox creation
export const SANDBOX_GITIGNORE = 'node_modules\n';
export const SANDBOX_PACKAGE_JSON = {
    name: 'example',
    version: '1.0.0',
    private: true,
    description: 'A sandbox.',
    type: 'module',
} as const;
export const SANDBOX_REMOVAL_REASON = 'The sandbox exercises selected checks without this configuration.';

// settings text
export const APP_SCOPE_SETTINGS = `[[scope]]
path = "app"
configurations = ["typescript"]
`;
export const BUN_SCANNER_SETTINGS = 'dependencies.bun_scanner = "@socketsecurity/bun-security-scanner"\n';
export const HOOKS_SETTINGS = '[hooks]\nenabled = true\n';
export const SETTING_REASON = 'The project contract requires this reviewed exception.';

// tool install
export const EMPTY_TOOL_INSTALL = { installed: [], missing: [], notes: [], steps: [] };
