export const RUNNER_CASES = [
    ['default', undefined, []],
    ['npm', 'npm', ['exec', '--no', '--', 'gspot']],
    ['mise', 'mise', ['exec', '--', 'gspot']],
] as const;

export const HOOK_CASES = [
    ['pre-commit', []],
    ['pre-push', ['origin', 'https://example.com/repository.git']],
    ['commit-msg', ['message']],
] as const;

export const HOOK_PROGRAM = `console.log(JSON.stringify({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    hook: process.env.GSPOT_HOOK ?? null,
}));
`;
