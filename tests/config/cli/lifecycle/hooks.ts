import { CLI_PINS } from '#cli/config/generation/pins.ts';

/** The authored hook providers and the Git-local script that init must retain. */
export const HOOK_REPOSITORIES = [
    {
        name: 'another hooks folder',
        runner: 'mise',
        files: { '.githooks/pre-commit': '#!/bin/sh\n' },
        setting: ['config', 'core.hooksPath', '.githooks'],
        gitHook: false,
    },
    {
        name: 'a Husky folder',
        runner: 'npm',
        files: { '.husky/pre-commit': 'npm test\n' },
        setting: undefined,
        gitHook: false,
    },
    {
        name: 'a Lefthook configuration',
        runner: 'npm',
        files: { 'lefthook.yml': 'pre-commit:\n' },
        setting: undefined,
        gitHook: false,
    },
    { name: 'a script in the Git hooks folder', runner: 'npm', files: {}, setting: undefined, gitHook: true },
] as const;

/** The successful native Mise process result used by the foreign-provider installation. */
export const MISE_INSTALL_RESULT = {
    code: 0,
    missing: false,
    duration: 0,
    stdout: `mise ${CLI_PINS.mise.version}`,
    stderr: '',
};
