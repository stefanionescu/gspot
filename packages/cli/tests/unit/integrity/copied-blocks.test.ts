import { describe, expect, test } from 'bun:test';
import { join, toNamespacedPath } from 'node:path';
import type { CloneReport } from '#types/integrity.ts';
import { cloneFindings } from '#cli/integrity/copied-blocks.ts';

describe('clone findings', () => {
    test('native absolute and relative paths retain claimed copies and exclude other files', () => {
        const root = join(import.meta.dir, 'workspace café');
        const prefixes = new Set([root, toNamespacedPath(root), '']);
        for (const prefix of prefixes) {
            const report: CloneReport = {
                statistics: { total: { percentage: 12 } },
                duplicates: [
                    {
                        lines: 30,
                        firstFile: { name: join(prefix, 'scripts', 'café.sh'), start: 3, end: 32 },
                        secondFile: { name: join(prefix, 'scripts', 'original.sh'), start: 7, end: 36 },
                    },
                    {
                        lines: 30,
                        firstFile: { name: join(prefix, 'vendor', 'copy.sh'), start: 1, end: 30 },
                        secondFile: { name: join(prefix, 'scripts', 'original.sh'), start: 7, end: 36 },
                    },
                ],
            };
            const shape = { check: 'duplication/jscpd', root, ceiling: 4, claimed: new Set(['scripts/café.sh']) };
            expect(cloneFindings(report, shape)).toEqual([
                {
                    check: 'duplication/jscpd',
                    file: 'scripts/café.sh',
                    line: 3,
                    rule: 'copied-block',
                    message:
                        '30 lines repeat scripts/original.sh:7. The duplicated share is 12.0 of 100, over the ceiling of 4.',
                    fixable: false,
                },
            ]);
            expect(cloneFindings(report, { ...shape, ceiling: 12 })).toEqual([]);
        }
    });
});
