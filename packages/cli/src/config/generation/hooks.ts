/** Hooks that run the check command. */
export const CHECK_HOOKS = ['pre-commit', 'pre-push', 'commit-msg'] as const;

export const LFS_HOOKS = ['pre-push', 'post-checkout', 'post-commit', 'post-merge'] as const;

/** Saves the pre-push input, so that git lfs and gspot both read it. */
export const PUSH_INPUT_SAVE = 'input=$(cat)';
export const PUSH_INPUT_REPLAY = String.raw`printf '%s\n' "$input" | `;

export const LFS_GUARD_PREFIX = 'command -v git-lfs >/dev/null 2>&1 || ';

/** The calls that git lfs install has written in its pre-push hook over its releases. */
export const LFS_PUSH_CALLS: ReadonlySet<string> = new Set([
    'git lfs pre-push "$@"',
    'git lfs push --stdin "$@"',
    'git lfs push --stdin $*',
]);

export const HOOK_ARGUMENTS = {
    'pre-commit': 'check --hook pre-commit',
    'pre-push': 'check --hook pre-push -- "$@"',
    'commit-msg': 'check --hook commit-msg -- "$1"',
} as const satisfies Record<(typeof CHECK_HOOKS)[number], string>;

/** The stages of the checks that each hook runs. */
export const HOOK_STAGES = {
    'pre-commit': ['commit'],
    'pre-push': ['commit', 'push'],
    'commit-msg': ['message'],
} as const satisfies Record<(typeof CHECK_HOOKS)[number], readonly string[]>;

/** The runner and exact pin command for each package manager. */
export const RUNNERS = {
    npm: {
        command: 'npm exec --no -- gspot',
        missing: 'Install Node.js and npm, then run: npm install.',
        pin: 'npm install --save-dev --save-exact',
    },
    pnpm: {
        command: 'pnpm exec gspot',
        missing: 'Install pnpm, then run: pnpm install.',
        pin: 'pnpm add --save-dev --save-exact',
    },
    yarn: {
        command: 'yarn exec gspot',
        missing: 'Install Yarn, then run: yarn install.',
        pin: 'yarn add --dev --exact',
    },
    bun: {
        command: 'bun run --no-install gspot',
        missing: 'Install Bun, then run: bun install.',
        pin: 'bun add --dev --exact',
    },
    mise: {
        command: 'mise exec -- gspot',
        missing: 'Install mise, then run: mise install.',
        pin: 'mise use --pin --tool-option allow_low_downloads=true npm:<package>@<version>',
    },
} as const;

export const HOOK_SHEBANG = '#!/bin/sh';
export const COMMIT_MESSAGE_PATH_LINES = [
    'case "$1" in /*|[A-Za-z]:*) message=$1 ;; *) message="$PWD/$1" ;; esac',
    'if command -v cygpath >/dev/null 2>&1; then message=$(cygpath -w "$message"); fi',
    'set -- "$message"',
] as const;
