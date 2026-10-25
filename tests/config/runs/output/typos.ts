import { TYPO } from '#tests/config/spelling.ts';

export const TYPO_REPORT = {
    type: 'typo',
    path: 'sample.txt',
    line_num: 1,
    byte_offset: 0,
    typo: TYPO.the,
    corrections: ['the'],
} as const;

export const TYPOS_REPORT_ERRORS = [
    {
        name: 'unfinished JSON',
        output: '{',
        message: 'Typos printed output that gspot cannot read.',
    },
    {
        name: 'partial typo',
        output: { type: 'typo', path: 'sample.txt', typo: TYPO.the },
        message: 'Typos printed output that gspot cannot read.',
    },
    {
        name: 'error output',
        output: { type: 'error', message: 'Read failed.' },
        message: 'Typos printed output that gspot cannot read.',
    },
    {
        name: 'escaping path',
        output: { ...TYPO_REPORT, path: '../outside.txt' },
        message: 'Cannot read reported source file ../outside.txt.',
    },
    {
        name: 'outside offset',
        output: { ...TYPO_REPORT, byte_offset: 99 },
        message: 'typos reported a position outside the file: sample.txt',
    },
    {
        name: 'missing source',
        output: { ...TYPO_REPORT, path: 'missing.txt' },
        message: 'Cannot read reported source file missing.txt.',
    },
] as const;
