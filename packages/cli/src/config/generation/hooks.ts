/** Hooks that run the check command. */
export const CHECK_HOOKS = ['pre-commit', 'pre-push', 'commit-msg'] as const;

export const LFS_HOOKS = ['pre-push', 'post-checkout', 'post-commit', 'post-merge'] as const;

/** Saves the pre-push input, so that git lfs and gspot both read it. */
export const PUSH_INPUT_SAVE = 'input=$(cat)';

export const PUSH_INPUT_REPLAY = String.raw`printf '%s\n' "$input" | `;

export const LFS_GUARD_PREFIX = 'command -v git-lfs >/dev/null 2>&1 || ';

/** The gspot arguments of each hook, and the stages of the checks that it runs. */
export const HOOK_CHECKS = {
    'pre-commit': { arguments: 'check --hook pre-commit', stages: ['commit'] },
    'pre-push': { arguments: 'check --hook pre-push -- "$@"', stages: ['commit', 'push'] },
    'commit-msg': { arguments: 'check --hook commit-msg -- "$1"', stages: ['message'] },
} as const satisfies Record<(typeof CHECK_HOOKS)[number], { arguments: string; stages: readonly string[] }>;

export const HOOK_SHEBANG = '#!/bin/sh';

export const COMMIT_MESSAGE_PATH_LINES = [
    'case "$1" in /*|[A-Za-z]:*) message=$1 ;; *) message="$PWD/$1" ;; esac',
    'if command -v cygpath >/dev/null 2>&1; then message=$(cygpath -w "$message"); fi',
    'set -- "$message"',
] as const;
