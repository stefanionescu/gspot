/** Native file selection and syntax diagnostics for each interpreter. */
export const SYNTAX_CASES = [
    {
        check: 'bash/bash-syntax',
        path: 'script.sh',
        files: ['launcher', 'script.sh'],
        broken: 'if then\n',
        line: 1,
        message: 'syntax',
    },
    // Zsh reports a parse error at the end of this one-line input, on line 2.
    {
        check: 'bash/zsh-syntax',
        path: 'script.zsh',
        files: ['script.zsh', 'zlauncher'],
        broken: 'if then\n',
        line: 2,
        message: 'parse error',
    },
    {
        check: 'bash/bats-syntax',
        path: 'script.bats',
        files: ['script.bats'],
        broken: '@test "broken" {\n    if then\n}\n',
        line: 2,
        message: 'syntax',
    },
];

/** Removing each authored declaration returns only its own file to source checks. */
export const DECLARATION_CASES = [
    {
        kind: 'generated',
        directory: 'output types',
        tables: '',
        files: [['output types/broken.sh', 'if then\n'] as const, ['upstream/broken.sh', 'if then\n'] as const],
        setup: [
            ['set', 'generated', '{"paths":["output types"]}', '--reason', 'External files retained for consumers'],
            ['set', 'vendored', '{"paths":["upstream"]}', '--reason', 'External files retained for consumers'],
        ],
    },
    {
        kind: 'exclude',
        directory: 'legacy scripts',
        tables: 'exclude = ["legacy scripts"]\n',
        files: [['legacy scripts/broken.sh', 'if then\n'] as const],
        setup: [],
    },
];
