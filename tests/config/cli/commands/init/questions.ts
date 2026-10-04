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
        error: 'Pass --no-task',
    },
    {
        name: 'reports runner cancellation without writing',
        terminal: true,
        answer: 'cancel',
        error: 'Cancelled; nothing written.',
    },
] as const;
