/** Default and explicit terminal responses to the actual initialization runner question. */
export const RUNNER_ANSWERS = [
    { name: 'accepts the available mise default', terminal: false, defaults: true, answer: 'npm', expected: 'mise' },
    { name: 'accepts the selected npm runner', terminal: true, defaults: false, answer: 'npm', expected: 'npm' },
] as const;

/** Missing terminals and cancellation must not silently select the proposed runner. */
export const RUNNER_FAILURES = [
    {
        name: 'refuses an unanswered runner without a terminal',
        terminal: false,
        answer: 'npm',
        error: 'Pass --no-runner',
    },
    {
        name: 'reports runner cancellation without writing',
        terminal: true,
        answer: 'cancel',
        error: 'Cancelled; nothing written.',
    },
] as const;

/** The runner question names the actual command that each selection uses. */
export const RUNNER_OPTIONS = [
    { value: 'mise', label: 'mise (mise exec -- gspot)' },
    { value: 'bun', label: 'bun (bun run --no-install gspot)' },
    { value: 'npm', label: 'npm (npm exec --no -- gspot)' },
    { value: 'pnpm', label: 'pnpm (pnpm exec gspot)' },
    { value: 'yarn', label: 'yarn (yarn exec gspot)' },
    { value: 'none', label: 'none' },
] as const;

/** Integration defaults when an unanswered dry-run has no terminal. */
export const DEFAULT_ANSWERS = { hooks: true, ci: 'none', agentRules: true, runner: 'mise' } as const;
