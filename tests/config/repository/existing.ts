export const LINKED_HOOK_FOLDERS = [
    { path: '.husky', kind: 'husky' },
    { path: '.githooks', kind: 'githooks' },
] as const;

export const LINKED_RULE_FOLDERS = ['.cursor/rules', '.claude/rules'] as const;

export const LINKED_HOOK_FILES = [
    { path: '.lefthook.yml', kind: 'lefthook' },
    { path: '.pre-commit-config.yaml', kind: 'pre-commit' },
] as const;

export const LEFTHOOK_FILES = ['lefthook.yml', '.config/lefthook.yml', 'lefthook-local.yml'] as const;

/** The stubs that Husky 9 writes in .husky/_/, the folder that core.hooksPath names. */
export const HUSKY_STUBS = {
    '.husky/_/.gitignore': '*\n',
    '.husky/_/h': '#!/usr/bin/env sh\n',
    '.husky/_/pre-commit': '#!/usr/bin/env sh\n. "$(dirname "$0")/h"\n',
};

/** package.json texts with `simple-git-hooks` settings. */
export const SIMPLE_GIT_HOOKS_PACKAGES = [
    {
        text: '{"simple-git-hooks":{"pre-commit":"echo authored"}}',
        hooks: [{ kind: 'simple-git-hooks', path: 'package.json', files: [] as string[] }],
    },
    { text: '{}', hooks: [] },
] as const;

/** Pre-commit hooks of several hook managers. */
export const HOOK_FOLDER_FILES = {
    '.githooks/pre-commit': '#!/bin/sh\nexit 0\n',
    '.husky/pre-commit': '#!/bin/sh\nexit 0\n',
    '.git-hooks/pre-commit': '#!/bin/sh\nexit 0\n',
    '.gspot/hooks/pre-commit': '#!/bin/sh\nexit 0\n',
    '.mise/tasks/hook/pre-commit': '#!/bin/sh\nexit 0\n',
} as const;

/** The Ruff section read through a link. */
export const LINKED_RUFF_SECTION = {
    tool: 'ruff',
    path: 'pyproject.toml',
    shared: true,
    table: 'tool.ruff',
} as const;

/** CI documents whose run steps name tools. */
export const CI_JOB_DOCUMENTS = [
    {
        name: 'GitHub run steps',
        path: '.github/workflows/check.yml',
        document: {
            jobs: {
                quality: { steps: [{ uses: 'actions/checkout@v4' }, { run: 'bun run lint' }, null, 12] },
                build: { steps: [{ run: 'bun run build' }] },
            },
        },
        expected: ['quality'],
    },
    {
        name: 'GitLab scalar and array scripts',
        path: '.gitlab-ci.yml',
        document: {
            quality: { script: 'eslint src' },
            analysis: { script: [null, 12, 'npm run lint'] },
            '.lint-template': { script: 'eslint src' },
            build: { script: ['bun run build'] },
        },
        expected: ['quality', 'analysis'],
    },
    {
        name: 'named inherited jobs',
        path: '.gitlab/ci/check.yml',
        document: {
            'code-lint': { extends: '.base' },
            unrelated: { extends: '.base' },
            'lint-settings': { variables: {} },
            'lint-invalid': [],
        },
        expected: ['code-lint'],
    },
    {
        name: 'script precedence over steps',
        path: '.github/workflows/check.yml',
        document: {
            jobs: {
                build: { script: 'bun run build', steps: [{ run: 'eslint src' }] },
                quality: { script: ['eslint src'], steps: [] },
            },
        },
        expected: ['quality'],
    },
    { name: 'null document', path: '.gitlab-ci.yml', document: null, expected: [] },
    { name: 'non-object jobs', path: '.github/workflows/check.yml', document: { jobs: 12 }, expected: [] },
] as const;

/** Prettier settings in source, vendor, and gspot folders. */
export const PRETTIER_SETTINGS_FILES = {
    'src/.prettierrc.json': '{"semi":false}',
    'vendor/.prettierrc.json': '{"semi":true}',
    '.gspot/.prettierrc.json': '{"tabWidth":8}',
    '.gspot/package.json': 'unowned malformed output',
    'nested/.gspot/package.json': '{}',
} as const;
