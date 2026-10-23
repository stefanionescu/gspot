import { HOOKS_PATH_SETTING } from '#cli/config/repository/setup/tools.ts';

export const SAMPLE_HOOK_SUFFIX = '.sample';

export const SET_HOOKS_PATH = ['git', 'config', HOOKS_PATH_SETTING] as const;

export const UNSET_HOOKS_PATH = ['git', 'config', '--unset', HOOKS_PATH_SETTING] as const;

/** The calls that git lfs install has written in its pre-push hook over its releases. */
export const LFS_PUSH_CALLS: ReadonlySet<string> = new Set([
    'git lfs pre-push "$@"',
    'git lfs push --stdin "$@"',
    'git lfs push --stdin $*',
]);
