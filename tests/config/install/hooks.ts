import { HUSKY_STUBS } from '#tests/config/repository/setup.ts';

const NPM_PROJECT_PACKAGE =
    '{"private":true,"packageManager":"npm@11.10.1","devDependencies":{"@gspothq/cli":"0.1.0"}}';

export const HOOK_REPOSITORIES = [
    {
        name: 'another hooks folder',
        location: '.githooks',
        startProgram: 'mise',
        files: { '.githooks/pre-commit': '#!/bin/sh\n' },
        setting: ['config', 'core.hooksPath', '.githooks'],
        gitHook: false,
    },
    {
        name: 'a Husky folder',
        location: '.husky',
        startProgram: 'npm',
        files: {
            'package.json': NPM_PROJECT_PACKAGE,
            '.husky/pre-commit': 'npm test\n',
        },
        setting: undefined,
        gitHook: false,
    },
    {
        name: 'a Husky 9 folder',
        location: '.husky',
        startProgram: 'npm',
        files: {
            'package.json': NPM_PROJECT_PACKAGE,
            '.husky/pre-commit': 'npm test\n',
            ...HUSKY_STUBS,
        },
        setting: ['config', 'core.hooksPath', '.husky/_'],
        gitHook: false,
    },
    {
        name: 'a Lefthook configuration',
        location: 'lefthook.yml',
        startProgram: 'npm',
        files: {
            'package.json': NPM_PROJECT_PACKAGE,
            'lefthook.yml': 'pre-commit:\n',
        },
        setting: undefined,
        gitHook: false,
    },
    {
        name: 'a script in the Git hooks folder',
        location: '.git/hooks',
        startProgram: 'npm',
        files: {
            'package.json': NPM_PROJECT_PACKAGE,
        },
        setting: undefined,
        gitHook: true,
    },
] as const;

export const STOCK_LFS_PRE_PUSH = String.raw`#!/bin/sh
command -v git-lfs >/dev/null 2>&1 || { printf >&2 "\n%s\n\n" "This repository is configured for Git LFS but 'git-lfs' was not found on your path. If you no longer wish to use Git LFS, remove this hook by deleting the 'pre-push' file in the hooks directory (set by 'core.hookspath'; usually '.git/hooks')."; exit 2; }
git lfs pre-push "$@"
`;

export const HOOK_CONFIGURATION_CASES = [
    {
        path: '.pre-commit-config.yaml',
        oneHook:
            'repos:\n  - repo: local\n    hooks:\n      - id: gspot-commit\n        name: gspot commit\n        language: system\n        entry: gspot check --hook pre-commit\n',
        bothHooks:
            'repos:\n  - repo: local\n    hooks:\n      - id: gspot-commit\n        name: gspot commit\n        language: system\n        entry: gspot check --hook pre-commit\n      - id: gspot-push\n        name: gspot push\n        language: system\n        entry: gspot check --hook pre-push\n        stages: [pre-push]\n',
    },
    {
        path: 'package.json',
        oneHook: '{"simple-git-hooks":{"pre-commit":"gspot check --hook pre-commit"}}',
        bothHooks:
            '{"simple-git-hooks":{"pre-commit":"gspot check --hook pre-commit","pre-push":"gspot check --hook pre-push"}}',
    },
] as const;
