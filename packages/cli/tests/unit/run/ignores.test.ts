import { createFixture } from 'fs-fixture';
import type { Finding } from '#types/finding.ts';
import { describe, expect, test } from 'bun:test';
import { applyIgnores, inlineIgnores } from '#cli/run/ignores.ts';

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
        expect(result.kept).toHaveLength(1);
        expect(result.uses.map((use) => use.matched)).toEqual([1, 1]);
    });

    test('inline gspot-ignore comments apply to the next line when alone and the same line otherwise', async () => {
        await using fixture = await createFixture({
            'a.sh': 'echo 1\n# gspot-ignore structure/call-through -- The public name is the stable one.\nx() { y; }\nz() { w; } # gspot-ignore structure/call-through\n',
        });
        const inline = inlineIgnores(fixture.path, 'a.sh');
        expect(inline).toEqual([
            { line: 3, check: 'structure/call-through', reason: 'The public name is the stable one.' },
            { line: 4, check: 'structure/call-through' },
        ]);
    });
});
