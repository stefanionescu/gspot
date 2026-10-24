export const START_COMMANDS = [
    ['npm', 'npm@11.10.1', ['exec', '--no', '--', 'gspot']],
    ['pnpm', 'pnpm@10.32.1', ['exec', 'gspot']],
    ['yarn', 'yarn@4.13.0', ['exec', '--', 'gspot']],
    ['bun', 'bun@1.4.2', ['run', '--no-install', 'gspot']],
    ['mise', undefined, ['exec', '--', 'gspot']],
] as const;

export const HOOK_LEVEL_CASES = [
    { level: 'recommended', hooks: ['post-checkout', 'post-commit', 'post-merge', 'pre-commit', 'pre-push'] },
    { level: 'all', hooks: ['commit-msg', 'post-checkout', 'post-commit', 'post-merge', 'pre-commit', 'pre-push'] },
] as const;

export const HOOK_CASES = [
    ['pre-commit', []],
    ['pre-push', ['origin', 'https://example.com/repository.git']],
    ['commit-msg', ['message']],
] as const;

export const HOOK_SCRIPT = `console.log(JSON.stringify({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    hook: process.env.GSPOT_HOOK ?? null,
}));
`;
