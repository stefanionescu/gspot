import type { RunReport } from '#cli/types/engine/run.ts';

export const HOOKS_PATH_CASES = [
    { hooksPath: '', named: ['none'], unnamed: ['use-thing.ts'] },
    { hooksPath: 'hooks', named: ['hooks/', 'pre-commit', 'use-thing.ts', '(your own)'], unnamed: [] },
    { hooksPath: '.husky', named: ['.husky/', 'pre-commit', '(husky)'], unnamed: ['use-thing.ts'] },
] as const;

export const HOOK_NAMED_SOURCE = 'export function useThing() { return true; }\n';
export const SCAN_RUN_REPORT: RunReport = {
    comparison: null,
    fixes: null,
    notes: [],
    version: '0.0.0-test',
    stages: ['commit', 'push'],
    started: '2026-01-01T00:00:00.000Z',
    duration: 4200,
    checks: [
        {
            check: 'javascript/eslint',
            scope: '',
            status: 'failed',
            fileCount: 2,
            duration: 2000,
            findings: [1, 2, 3, 4].map((line) => ({
                check: 'javascript/eslint',
                file: 'src/a.ts',
                line,
                rule: 'no-console',
                message: 'Unexpected console statement.',
                fixable: false,
            })),
        },
        {
            check: 'secrets/gitleaks-staged',
            scope: '',
            status: 'failed',
            fileCount: 2,
            duration: 1000,
            findings: [
                {
                    check: 'secrets/gitleaks-staged',
                    file: 'src/key.ts',
                    line: 2,
                    rule: 'generic-api-key',
                    message: 'Detected a key.',
                    fixable: false,
                },
            ],
        },
        {
            check: 'format/prettier',
            scope: '',
            status: 'failed',
            fileCount: 2,
            duration: 500,
            findings: ['src/a.ts', 'src/b.ts'].map((file) => ({
                check: 'format/prettier',
                file,
                message: 'Not formatted the way Prettier formats it.',
                fixable: true,
            })),
        },
        {
            check: 'spelling/typos',
            scope: '',
            status: 'failed',
            fileCount: 1,
            duration: 500,
            findings: [
                {
                    check: 'spelling/typos',
                    file: 'README.md',
                    line: 1,
                    message: 'A word is misspelled.',
                    fixable: true,
                },
            ],
        },
        {
            check: 'secrets/environment-examples',
            scope: '',
            status: 'passed',
            fileCount: 2,
            duration: 900,
            findings: [],
        },
        {
            check: 'python/ruff',
            scope: '',
            status: 'missing',
            fileCount: 1,
            duration: 0,
            findings: [],
            note: 'ruff is not installed.',
        },
    ],
    ignores: [],
    skippedCount: {},
    unstagedChanges: 0,
    partial: false,
    failed: ['javascript/eslint', 'secrets/gitleaks-staged', 'format/prettier', 'spelling/typos'],
    exitCode: 1,
};
