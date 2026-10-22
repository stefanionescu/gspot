export const START_COMMANDS = [
    ['npm', 'npm@11.10.1', ['exec', '--no', '--', 'gspot']],
    ['pnpm', 'pnpm@10.32.1', ['exec', 'gspot']],
    ['yarn', 'yarn@4.13.0', ['exec', 'gspot']],
    ['bun', 'bun@1.4.2', ['run', '--no-install', 'gspot']],
    ['mise', undefined, ['exec', '--', 'gspot']],
] as const;

export const HOOK_LEVEL_CASES = [
    { level: 'recommended', hooks: ['pre-commit', 'pre-push'] },
    { level: 'all', hooks: ['commit-msg', 'pre-commit', 'pre-push'] },
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

export const LOGGING_SCRIPT = String.raw`const fs = require('node:fs');
const name = require('node:path').basename(process.argv[1], '.js');
const input = fs.readFileSync(0, 'utf8');
fs.appendFileSync(process.env.CALLS_LOG, JSON.stringify({ name, argv: process.argv.slice(2), input }) + '\n');
`;

export const CAT_SCRIPT = `process.stdout.write(require('node:fs').readFileSync(0));
`;
