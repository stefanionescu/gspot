import { test, expect, describe } from 'bun:test';
import { applyIgnores } from '#cli/execution/run.ts';

describe('ignores', () => {
    test('match by check, rule and paths and count what they matched', () => {
        const findings = [
            {
                check: 'bash/shellcheck',
                file: 'scripts/a.sh',
                rule: 'SC2312',
                message: 'm',
                fixable: false,
            },
            {
                check: 'bash/shellcheck',
                file: 'src/b.sh',
                rule: 'SC2312',
                message: 'm',
                fixable: false,
            },
            {
                check: 'bash/shellcheck',
                file: 'src/b.sh',
                rule: 'SC2086',
                message: 'm',
                fixable: false,
            },
        ];
        const result = applyIgnores(findings, [
            { check: 'bash/shellcheck', rule: 'SC2312', paths: ['scripts/**'], reason: 'why' },
            { check: 'bash/shellcheck', rule: 'SC2086', reason: 'why' },
        ]);
        expect(result.kept).toStrictEqual([
            {
                check: 'bash/shellcheck',
                file: 'src/b.sh',
                rule: 'SC2312',
                message: 'm',
                fixable: false,
            },
        ]);
        expect(result.uses.map((use) => use.matched)).toStrictEqual([1, 1]);
    });
});
