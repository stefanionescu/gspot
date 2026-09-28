// The literal values acceptance/source/cli/cli reads: names, patterns, limits, and tables.
import type { Retention, AuthoredState } from '#tests/types/acceptance/source/cli.ts';

export const PRETTIER_CARRY_SOURCE = 'const greeting="hello";if(greeting){console.log(greeting);}';
export const SCOPES_SOURCE =
    '// The port the service listens on.\n\n/** The port, read once. */\nexport const port = Number("8080") as number;\n';
export const PRETTIER_IGNORE_SOURCE = 'export const greeting="hello";\n';
export const ESLINT_PRESERVATION_SOURCE = 'alert(left == right);\n';
export const ESLINT_CARRY_SOURCE = 'export const isEmpty = (value) => value == null;\n';
export const PRETTIER_CARRY_FILES = [
    'source.js',
    'src/nested/source.js',
    'tests/[draft].js',
    'tests/café note.js',
    'server/source.js',
    'components/source.js',
];
export const EDITORCONFIG_CARRY_FILES = [
    'source.js',
    'src/nested/source.js',
    'src/[draft].js',
    'tests/source.js',
    'server/source.js',
    'components/source.js',
];
export const PRETTIER_IGNORE_FILES = ['source.js', 'generated/authored.js', 'generated/skipped.js', 'space name.js'];
export const ESLINT_CARRY_FILES = [
    'source.js',
    'tests/[draft].js',
    'tests/café note.js',
    'server/source.js',
    'components/source.js',
];
export const PRETTIER_CARRY_CONFIG = {
    tabWidth: 2,
    singleQuote: false,
    overrides: [
        { files: 'tests/**', options: { tabWidth: 8, singleQuote: true } },
        { files: '**/*.js', excludeFiles: 'server/**', options: { semi: false } },
    ],
};
export const ESLINT_PRESERVATION_CONFIG = [
    { files: ['**/*.js'], rules: { eqeqeq: 'error' } },
    { files: ['tests/**'], rules: { eqeqeq: 'off', 'no-alert': 'warn' } },
];
export const ESLINT_CARRY_CONFIG = [
    { files: ['**/*.js'], rules: { eqeqeq: ['error', 'smart'] } },
    { files: ['tests/**'], rules: { eqeqeq: ['error', 'always'] } },
    { files: ['server/**'], rules: { eqeqeq: ['warn', 'always'] } },
    { files: ['components/**'], rules: { eqeqeq: 'off' } },
];
export const AUTHORED: Record<AuthoredState['state'], Partial<AuthoredState>> = {
    kept: { state: 'kept', mode: 0o640 },
    rewritten: { state: 'rewritten' },
    removed: { state: 'removed' },
};
export const YAML =
    'tabWidth: 2\nsingleQuote: false\noverrides:\n  - files: "tests/**"\n    options:\n      tabWidth: 8\n      singleQuote: true\n  - files: "**/*.js"\n    excludeFiles: "server/**"\n    options:\n      semi: false\n';
export const CONFIGURATION_ARRIVAL_INIT = [
    'init',
    '--yes',
    '--kits',
    'typescript',
    '--without',
    'naming',
    'spelling',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-guides',
    '--no-install',
];
export const SELECTION_INIT = ['init', '--yes', '--dry-run', '--json', '--without', 'naming', 'spelling'];
export const COMMITS_INIT = [
    'init',
    '--yes',
    '--kits',
    'commits',
    '--no-runner',
    '--no-ci',
    '--no-guides',
    '--no-install',
];
export const TYPED_TABLES_INIT = [
    'init',
    '--yes',
    '--kits',
    'markdown',
    'docs',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-guides',
    '--no-install',
];
export const CONFIGURATION_ARRIVAL_PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module"\n}\n';
export const LOOSE =
    "// A planted file.\n\nimport { z } from 'zod';\n\n/** Accepts anything. */\nexport const loose = z.object({ value: z.any() });\n";
export const INIT_SELECTION_QUIET = ['--no-runner', '--no-ci', '--no-hooks', '--no-guides', '--no-install'];
export const INIT_REFUSALS_QUIET = ['--no-runner', '--no-ci', '--no-guides', '--no-install'];
export const COMPONENT = '<script setup>\nconst name = 1;\n</script>\n<template><p>{{ name }}</p></template>\n';
export const EXPLAIN_POLICY = `version = 1
kits = []

[[scope]]
path = "api"
kits = ["bash"]

[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/build.sh"]
reason = "The script deliberately splits a list of arguments."
`;
export const FORMAT_OVERRIDES_POLICY = `version = 1
level = "all"
kits = ["formatting"]
[guides]
install = false
[format]
indent_width = 2
quotes = "double"
semicolons = false
[[format.overrides]]
paths = ["tests"]
quotes = "single"
semicolons = true
[[scope]]
path = "apps/web"
[scope.format]
indent_width = 4
[[scope.format.overrides]]
paths = ["**/*", "!apps/web/exempt.js"]
quotes = "single"
[[scope]]
path = "apps/web/admin"
[scope.format]
indent_width = 8
[[scope.format.overrides]]
paths = ["**/*"]
quotes = "double"
semicolons = true
line_ending = "crlf"
`;
export const FORMAT_PRESERVATION_POLICY = 'version = 1\nkits = ["formatting"]\n[guides]\ninstall = false\n';
export const ESLINT_PRESERVATION_POLICY = 'version = 1\nkits = ["javascript"]\n[guides]\ninstall = false\n';
export const NESTED_SCOPES_POLICY = `version = 1
kits = ["formatting"]
[limits]
file_lines = 250
[format]
indent_width = 4
[guides]
install = false
[[scope]]
path = "api"
kits = ["bash"]
[scope.limits]
file_lines = 200
[scope.format]
indent_width = 2
[[scope]]
path = "api/worker"
kits = ["sql"]
[scope.limits]
function_lines = 30
`;
export const CODEQUALITY_REPORT = '.gspot/reports/report.codequality.json';
export const RETENTION: Record<'gitlab' | 'github', Retention> = {
    gitlab: { always: true, keepsCodequality: true },
    github: { always: true, keepsCodequality: true, manualStage: 'manual job only' },
};
export const EDITORCONFIG =
    'root = true\n[*]\nindent_style = space\nindent_size = 2\nmax_line_length = 90\nend_of_line = lf\ncharset = utf-8\ntrim_trailing_whitespace = true\n[tests/**.js]\nindent_size = 4\n';
export const EXPECTED = 'const greeting = "hello"\nif (greeting) {\n        console.log(greeting)\n}\n';
export const REASON = 'The report names the folders the move deleted, which is what it is for.';
export const TABLE = `[{patterns = ["REPORT.md"], reason = "${REASON}"}]`;

export const ESLINT_OVERRIDE_POLICY = `version = 1
kits = ["javascript"]
[guides]
install = false
[tools.eslint.rules]
eqeqeq = ["error", "smart"]
[[tools.eslint.overrides]]
paths = ["tests"]
rules = {eqeqeq = ["error", "always"]}
[[tools.eslint.overrides]]
paths = ["tests/exempt.js"]
rules = {eqeqeq = ["error", "smart"]}
[[scope]]
path = "apps/web"
[scope.tools.eslint.rules]
eqeqeq = ["warn", "always"]
[[scope.tools.eslint.overrides]]
paths = ["**/*", "!apps/web/exempt.js"]
rules = {eqeqeq = ["error", "smart"]}
[[scope]]
path = "apps/web/admin"
[[scope.tools.eslint.overrides]]
paths = ["**/*"]
rules = {eqeqeq = ["error", "always"]}
`;

export const PRETTIER_IGNORE_RULES =
    '# Generated files except the authored entry\ngenerated/*\n!generated/authored.js\nspace\\ name.js\n';
export const PRETTIER_FIX_ARGS = ['check', '--only', 'formatting/prettier', '--fix', '--no-cache', '--json', '--'];

export const PRETTIER_NATIVE_FORMATS = {
    'tests/[draft].js': "const greeting = 'hello'\nif (greeting) {\n        console.log(greeting)\n}\n",
    'server/source.js': 'const greeting = "hello";\nif (greeting) {\n  console.log(greeting);\n}\n',
};
