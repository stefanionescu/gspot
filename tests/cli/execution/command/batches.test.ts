import { test, expect, describe } from 'bun:test';
import { fileBatches } from '#cli/execution/command/batches.ts';
import { UNIX_COMMAND_LIMIT, WINDOWS_COMMAND_LIMIT } from '#cli/config/execution/command.ts';

describe('file batches', () => {
    test('a list that fits is one batch, and a long list splits under the budget in order', () => {
        expect(fileBatches(['a.sh', 'b.sh'], ['tool'], 'linux')).toStrictEqual([['a.sh', 'b.sh']]);
        const files = Array.from({ length: 5000 }, (_, index) => `scripts/deploy/step-${String(index)}.sh`);
        const batches = fileBatches(files, ['tool'], 'linux');
        expect(batches.length).toBeGreaterThan(1);
        expect(batches.flat()).toStrictEqual(files);
        for (const batch of batches)
            expect(Buffer.byteLength(['tool', ...batch].join(' '))).toBeLessThanOrEqual(UNIX_COMMAND_LIMIT);
    });
});

test('Windows batches reserve quoted paths and the resolved executable', () => {
    const files = Array.from({ length: 5000 }, (_, index) => `docs/café folder (draft)/page-${String(index)}.md`);
    const fixed = [
        'C:/workspace with spaces/node_modules/.bin/markdownlint.cmd',
        '--config',
        'C:/workspace with spaces/.gspot/markdown.json',
    ];
    const batches = fileBatches(files, fixed, 'win32');
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toStrictEqual(files);
    for (const batch of batches) {
        const command = [...fixed, ...batch].map((argument) => `"${argument}"`).join(' ');
        expect(command.length).toBeLessThanOrEqual(WINDOWS_COMMAND_LIMIT);
    }
});

test('Unix batches count Unicode bytes and reject an argument that cannot fit', () => {
    const files = Array.from({ length: 5000 }, (_, index) => `資料/結果-${String(index)}.txt`);
    const fixed = ['tool', '--data', 'x'.repeat(UNIX_COMMAND_LIMIT / 2)];
    const batches = fileBatches(files, fixed, 'linux');
    expect(batches.flat()).toStrictEqual(files);
    for (const batch of batches)
        expect(Buffer.byteLength([...fixed, ...batch].join(' '))).toBeLessThanOrEqual(UNIX_COMMAND_LIMIT);
    expect(() => fileBatches(['x'.repeat(UNIX_COMMAND_LIMIT + 1)], ['tool'], 'linux')).toThrow(
        'is too long for one command line',
    );
    expect(() => fileBatches([], ['x'.repeat(UNIX_COMMAND_LIMIT + 1)], 'linux')).toThrow('Tool arguments exceed');
});
