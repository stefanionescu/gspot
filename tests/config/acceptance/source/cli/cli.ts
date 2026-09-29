// The literal values acceptance/source/cli/cli reads: names, patterns, limits, and tables.
import type { Retention } from '#tests/types/acceptance/source/cli.ts';

export const SCOPES_SOURCE =
    '// The port the service listens on.\n\n/** The port, read once. */\nexport const port = Number("8080") as number;\n';
export const PRETTIER_IGNORE_SOURCE = 'export const greeting="hello";\n';
export const PRETTIER_IGNORE_FILES = ['source.js', 'generated/authored.js', 'generated/skipped.js', 'space name.js'];
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
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "zod": "4.6.2"\n    }\n}\n';
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
