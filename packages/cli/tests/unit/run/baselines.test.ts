import { createFixture } from 'fs-fixture';
import type { Finding } from '#types/finding.ts';
import { describe, expect, test } from 'bun:test';
import type { BaselineVerdict } from '#types/report.ts';

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

const CHECKS = new Set(['c/x']);

function counted(paths: Record<string, number>): BaselineVerdict {
    const count = Object.values(paths).reduce((sum, held) => sum + held, 0);
    return { check: 'c/x', rule: 'r1', count, baseline: 2, held: true, paths };
}

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
        const lowered = lowerBaselines(fixture.path, [counted({ 'a.ts': 1 })], CHECKS, CHECKS);
        expect(lowered.lowered).toEqual(['c/x:r1']);
        expect(readBaselines(fixture.path)[0]?.count).toBe(1);
        const rose = lowerBaselines(fixture.path, [counted({ 'a.ts': 1, 'b.ts': 1, 'c.ts': 1 })], CHECKS, CHECKS);
        expect(rose.rose).toEqual(['c/x:r1']);
        const removed = lowerBaselines(fixture.path, [], new Set(['other/check']), new Set());
        expect(removed.removed).toEqual(['c/x:r1']);
    });

    test('a rule the run counted at zero loses its baseline, and a held count is no zero', async () => {
        await using fixture = await createFixture({});
        writeBaselines(fixture.path, [finding('a.ts'), finding('b.ts')], () => true);
        const same = lowerBaselines(fixture.path, [counted({ 'a.ts': 1, 'b.ts': 1 })], CHECKS, CHECKS);
        expect(same).toEqual({ lowered: [], removed: [], rose: [], kept: [] });
        const cleared = lowerBaselines(fixture.path, [counted({})], CHECKS, CHECKS);
        expect(cleared.removed).toEqual(['c/x:r1']);
    });

    test('a check the last run did not read in full keeps its baseline, findings or none', async () => {
        await using fixture = await createFixture({});
        writeBaselines(fixture.path, [finding('a.ts'), finding('b.ts')], () => true);
        const outcome = lowerBaselines(fixture.path, [], CHECKS, new Set());
        expect(outcome.kept).toEqual(['c/x:r1']);
        expect(outcome.removed).toEqual([]);
        expect(readBaselines(fixture.path)[0]?.count).toBe(2);
    });

    test('the findings of every scope count against one baseline together', () => {
        const baseline = { check: 'c/x', rule: 'r1', count: 2, recorded: '2026-01-01', paths: {} };
        const together = applyBaselines([finding('api/a.ts'), finding('api/b.ts'), finding('web/c.ts')], [baseline]);
        expect(together.verdicts[0]?.held).toBe(false);
        expect(together.kept).toHaveLength(3);
    });
});
