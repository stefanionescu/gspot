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
