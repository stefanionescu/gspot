import type { PlanOptions } from '#cli/types/planning.ts';

export const TWO_SCOPES_SETTINGS = `configurations = []
[[scope]]
path = "api"
configurations = []
[[scope]]
path = "web"
configurations = []
`;

export const TSC_PUSH_OPTIONS = { stage: 'push', only: ['typescript/tsc'] } satisfies Pick<
    PlanOptions,
    'stage' | 'only'
>;

export const EDITORCONFIG_FILES = {
    'source.py': 'VALUE = 1\n',
    'task.sh': '#!/bin/sh\nprintf hello\n',
    'Source.swift': 'let value = 1\n',
    'settings.toml': 'value = 1\n',
    'query.sql': 'SELECT 1;\n',
    Makefile: 'build:\n\ttrue\n',
    Dockerfile: 'FROM scratch\n',
} as const;

export const PROJECT_PATH_IGNORES = [
    {
        name: 'a deleted ignored input',
        changed: ['api/ignored.ts'],
        present: false,
        check: 'typescript/tsc',
        rule: undefined,
        files: [],
    },
    {
        name: 'a changed ignored input',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: undefined,
        files: [],
    },
    {
        name: 'an ignored and an owned input',
        changed: ['api/ignored.ts', 'api/kept.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: undefined,
        files: ['api/kept.ts'],
    },
    {
        name: 'a rule-specific ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: 'sample',
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
    {
        name: 'another check\u{2019}s path ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'data-files/v8r',
        rule: undefined,
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
] as const;

export const TYPESCRIPT_SCOPES_SETTINGS = TWO_SCOPES_SETTINGS.replace(
    'configurations = []',
    'configurations = ["typescript"]',
);

export const LAYERED_SCOPE_SETTINGS = `level = "all"
configurations = ["format"]
[limits]
file_lines = 250
[format]
indent_width = 4
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
limits.file_lines = 200
format.indent_width = 2
[[scope]]
path = "api/worker"
configurations = ["sql"]
limits.sql.file_lines = 30
tools.sqlfluff.dialect = "postgres"
`;

export const LOCKFILE_TRIGGER_NAMES = [
    'bun.lock',
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'uv.lock',
] as const;
