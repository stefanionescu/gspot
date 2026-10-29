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

export const TYPOS_FINDING_CASES = [
    {
        name: 'a byte offset after Unicode text',
        source: 'café te\u0068\n',
        report: { ...TYPO_REPORT, byte_offset: 6 },
        expected: { file: 'sample.txt', line: 1, column: 6, message: '`te\u0068` should be `the`', fixable: true },
    },
    {
        name: 'several possible corrections',
        source: 'te\u0068\n',
        report: { ...TYPO_REPORT, corrections: ['the', 'tea'] },
        expected: {
            file: 'sample.txt',
            line: 1,
            column: 1,
            message: '`te\u0068` should be `the`, `tea`',
            fixable: false,
        },
    },
    {
        name: 'a misspelled file name',
        source: '',
        report: { type: 'typo', path: 'te\u0068.txt', byte_offset: 0, typo: 'te\u0068', corrections: ['the'] },
        expected: { file: 'te\u0068.txt', message: 'Filename: `te\u0068` should be `the`', fixable: false },
    },
] as const;
