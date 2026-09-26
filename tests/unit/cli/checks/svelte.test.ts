import { describe, expect, test } from 'bun:test';
import { svelteFindings } from '#cli/checks/svelte.ts';

const LINES = [
    '1758823456789 START "/repo"',
    `1758823456790 ${JSON.stringify({ type: 'ERROR', filename: 'src/Count.svelte', start: { line: 1, character: 10 }, end: { line: 1, character: 15 }, message: "Type 'string' is not assignable to type 'number'.", code: 2322, source: 'ts' })}`,
    `1758823456791 ${JSON.stringify({ type: 'WARNING', filename: 'src/Product.svelte', start: { line: 4, character: 0 }, end: { line: 4, character: 20 }, message: '`<img>` element should have an alt attribute', code: 'a11y_missing_attribute', source: 'svelte' })}`,
    '1758823456792 COMPLETED 2 FILES 1 ERRORS 1 WARNINGS 2 FILES_WITH_PROBLEMS',
].join('\n');

describe('svelteFindings', () => {
    test('errors and warnings become findings at one-based positions with their code as the rule', () => {
        expect(svelteFindings('svelte/check', '', LINES)).toStrictEqual([
            {
                check: 'svelte/check',
                file: 'src/Count.svelte',
                line: 2,
                column: 11,
                rule: 'TS2322',
                message: "Type 'string' is not assignable to type 'number'.",
                fixable: false,
            },
            {
                check: 'svelte/check',
                file: 'src/Product.svelte',
                line: 5,
                column: 1,
                rule: 'a11y_missing_attribute',
                message: '`<img>` element should have an alt attribute',
                fixable: false,
            },
        ]);
        expect(svelteFindings('svelte/check', 'apps/web', LINES)[0]?.file).toBe('apps/web/src/Count.svelte');
    });

    test('a failure line is an error, not a clean result', () => {
        expect(() =>
            svelteFindings('svelte/check', '', '1758823456790 FAILURE "Failed to locate tsconfig or jsconfig"'),
        ).toThrow('The svelte-check run failed: Failed to locate tsconfig or jsconfig');
    });
});
