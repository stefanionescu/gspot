/** The authored hook providers and the Git-local script that init must retain. */
export const HOOK_REPOSITORIES = [
    {
        name: 'another hooks folder',
        files: { '.githooks/pre-commit': '#!/bin/sh\n' },
        setting: ['config', 'core.hooksPath', '.githooks'],
        gitHook: false,
    },
    { name: 'a Husky folder', files: { '.husky/pre-commit': 'npm test\n' }, setting: undefined, gitHook: false },
    {
        name: 'a Lefthook configuration',
        files: { 'lefthook.yml': 'pre-commit:\n' },
        setting: undefined,
        gitHook: false,
    },
    { name: 'a script in the Git hooks folder', files: {}, setting: undefined, gitHook: true },
] as const;
