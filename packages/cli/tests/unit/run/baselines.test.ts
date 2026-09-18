import { createFixture } from 'fs-fixture';
import type { Finding } from '#types/finding.ts';
import { describe, expect, test } from 'bun:test';

import {
    applyBaselines,
    isBaselineAllowed,
    lowerBaselines,
    readBaselines,
    writeBaselines,
} from '#cli/run/baselines.ts';

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
        expect(isBaselineAllowed(['format'])).toBe(false);
        expect(isBaselineAllowed(['style', 'structure'])).toBe(true);
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
