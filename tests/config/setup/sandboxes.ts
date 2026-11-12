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

export const MISE_TRUST = ['mise', 'trust'] as const;

export const PACKED_PACKAGES_FILE = 'packages.json';

export const CHILD_WAIT_MILLISECONDS = 15_000;

export const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required';

export const NPM_INSTALL_FLAGS = ['--ignore-scripts', '--no-audit', '--no-fund'] as const;

export const PNPM_WORKSPACE = 'packages:\n  - "**"\n';

export const REGISTRY_HOST = '127.0.0.1';

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

export const PYTHON_PROJECT_IGNORES = [
    'json/v8r',
    'security/semgrep',
    'format/editorconfig-checker',
    'python/basedpyright',
    'python/pydoclint',
    'python/deptry',
    'python/vulture',
] as const;

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

export const CHANGED_CONTEXT = 'changed context';

export const EMPTY_TOOL_INSTALL = { installed: [], missing: [], notes: [], steps: [] };
