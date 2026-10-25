import { HOOKS_PATH_SETTING } from '#cli/config/repository/setup.ts';

export const SAMPLE_HOOK_SUFFIX = '.sample';

export const SET_HOOKS_PATH = ['git', 'config', HOOKS_PATH_SETTING] as const;

export const UNSET_HOOKS_PATH = ['git', 'config', '--unset', HOOKS_PATH_SETTING] as const;

export const LFS_PUSH_CALLS: ReadonlySet<string> = new Set([
    'git lfs pre-push "$@"',
    'git lfs push --stdin "$@"',
    'git lfs push --stdin $*',
]);
