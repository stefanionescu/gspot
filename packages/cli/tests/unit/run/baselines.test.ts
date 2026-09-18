import { describe, expect, test } from 'bun:test';
import { createFixture } from 'fs-fixture';

import { applyBaselines, baselineAllowed, lowerBaselines, readBaselines, writeBaselines } from '#cli/run/baselines.ts';
import { applyIgnores, inlineIgnores } from '#cli/run/ignores.ts';
import { assertPinMatches, pinnedVersion, writePin, GSPOT_VERSION } from '#cli/run/version-pin.ts';
import type { Finding } from '#types/finding.ts';

const finding = (file: string, rule = 'r1', check = 'c/x'): Finding => ({
    check,
    file,
    rule,
    message: 'm',
    fixable: false,
});

describe('baselines', () => {
    test('a held baseline removes its findings; a count that rose keeps them', () => {
        const baseline = { check: 'c/x', rule: 'r1', count: 2, recorded: '2026-09-18', paths: { 'a.ts': 2 } };
        const held = applyBaselines([finding('a.ts'), finding('a.ts')], [baseline]);
        expect(held.kept).toHaveLength(0);
        expect(held.verdicts[0]?.held).toBe(true);
        const rose = applyBaselines([finding('a.ts'), finding('a.ts'), finding('b.ts')], [baseline]);
        expect(rose.kept).toHaveLength(3);
        expect(rose.verdicts[0]?.held).toBe(false);
    });

    test('in staged mode a touched file cannot grow even when the total holds', () => {
        const baseline = {
            check: 'c/x',
            rule: 'r1',
            count: 3,
            recorded: '2026-09-18',
            paths: { 'a.ts': 1, 'b.ts': 2 },
        };
        const result = applyBaselines([finding('a.ts'), finding('a.ts')], [baseline], new Set(['a.ts']));
        expect(result.verdicts[0]?.held).toBe(false);
    });

    test('format, syntax and schema findings never baseline', () => {
        expect(baselineAllowed(['format'])).toBe(false);
        expect(baselineAllowed(['style', 'structure'])).toBe(true);
    });

    test('write, read and lower baseline files', async () => {
        await using fixture = await createFixture({});
        writeBaselines(fixture.path, [finding('a.ts'), finding('b.ts')], () => true);
        expect(readBaselines(fixture.path)[0]?.count).toBe(2);
        const lowered = lowerBaselines(fixture.path, [finding('a.ts')], new Set(['c/x']));
        expect(lowered.lowered).toEqual(['c/x:r1']);
        expect(readBaselines(fixture.path)[0]?.count).toBe(1);
        const rose = lowerBaselines(
            fixture.path,
            [finding('a.ts'), finding('b.ts'), finding('c.ts')],
            new Set(['c/x']),
        );
        expect(rose.rose).toEqual(['c/x:r1']);
        const removed = lowerBaselines(fixture.path, [], new Set(['other/check']));
        expect(removed.removed).toEqual(['c/x:r1']);
    });
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

describe('the version pin', () => {
    test('is written, read, and refused when it differs', async () => {
        await using fixture = await createFixture({});
        expect(pinnedVersion(fixture.path)).toBeUndefined();
        writePin(fixture.path);
        expect(pinnedVersion(fixture.path)).toBe(GSPOT_VERSION);
        expect(() => assertPinMatches(fixture.path)).not.toThrow();
        writePin(fixture.path, '9.9.9');
        expect(() => assertPinMatches(fixture.path)).toThrow('gspot upgrade --to');
    });
});
