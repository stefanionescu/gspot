import { describe, expect, test } from 'bun:test';
import { applyIgnores } from '#cli/run/ignores.ts';
import type { Finding } from '#cli/output/schema.ts';

const finding = (file: string, rule = 'r1', check = 'c/x'): Finding => ({
    check,
    file,
    rule,
    message: 'm',
    fixable: false,
});

describe('ignores', () => {
    test('match by check, rule and paths and count what they matched', () => {
        const findings = [
            finding('scripts/a.sh', 'SC2312', 'bash/shellcheck'),
            finding('src/b.sh', 'SC2312', 'bash/shellcheck'),
            finding('src/b.sh', 'SC2086', 'bash/shellcheck'),
        ];
        const result = applyIgnores(findings, [
            { check: 'bash/shellcheck', rule: 'SC2312', paths: ['scripts/**'], reason: 'why' },
            { check: 'bash/shellcheck', rule: 'SC2086', reason: 'why' },
        ]);
        expect(result.kept).toStrictEqual([finding('src/b.sh', 'SC2312', 'bash/shellcheck')]);
        expect(result.uses.map((use) => use.matched)).toStrictEqual([1, 1]);
    });
});
