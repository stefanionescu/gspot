import type { Policy } from '#cli/types/policy/settings.ts';
import type { HookRunner } from '#cli/types/generation/hooks.ts';

export const HOOK_ARGS = {
    'pre-commit': 'check --hook pre-commit',
    'pre-push': 'check --hook pre-push -- "$@"',
    'commit-msg': 'check --hook commit-msg --message-file "$1"',
} as const;

/** Hook commands and the install command used when their executable is absent. */
export const HOOK_RUNNERS = {
    gspot: { command: 'gspot', install: 'Install gspot and add it to PATH, then run: gspot install.' },
    mise: { command: 'mise exec -- gspot', install: 'Install mise, then run: mise install.' },
    bun: { command: 'bun run --no-install gspot', install: 'Install Bun, then run: bun install.' },
    npm: { command: 'npm exec --no -- gspot', install: 'Install Node.js and npm, then run: npm install.' },
    pnpm: { command: 'pnpm exec gspot', install: 'Install pnpm, then run: pnpm install.' },
    yarn: { command: 'yarn exec gspot', install: 'Install Yarn, then run: yarn install.' },
} satisfies Record<NonNullable<Policy['runner']> | 'gspot', HookRunner>;
