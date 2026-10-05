export const HOOK_ARGS = {
    'pre-commit': 'check --hook pre-commit',
    'pre-push': 'check --hook pre-push -- "$@"',
    'commit-msg': 'check --hook commit-msg --message-file "$1"',
} as const;

/** Hook commands and the installation needed when their executable is absent. */
export const HOOK_RUNNERS = {
    gspot: { command: 'gspot', acquisition: 'Install gspot and add it to PATH, then run: gspot install.' },
    mise: { command: 'mise exec -- gspot', acquisition: 'Install mise, then run: mise install.' },
    bun: { command: 'bun run --no-install gspot', acquisition: 'Install Bun, then run: bun install.' },
    npm: { command: 'npm exec --no -- gspot', acquisition: 'Install Node.js and npm, then run: npm install.' },
    pnpm: { command: 'pnpm exec gspot', acquisition: 'Install pnpm, then run: pnpm install.' },
    yarn: { command: 'yarn exec gspot', acquisition: 'Install Yarn, then run: yarn install.' },
};
