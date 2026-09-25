import { fileBatches } from '#cli/execution/file-batches.ts';
import { describe, expect, test } from 'bun:test';

describe('file batches', () => {
    test('a list that fits is one batch, and a long list splits under the budget in order', () => {
        expect(fileBatches(['a.sh', 'b.sh'], ['tool'], 'linux')).toStrictEqual([['a.sh', 'b.sh']]);
        const files = Array.from({ length: 5000 }, (_, index) => `scripts/deploy/step-${String(index)}.sh`);
        const batches = fileBatches(files, ['tool'], 'linux');
        expect(batches.length).toBeGreaterThan(1);
        expect(batches.flat()).toStrictEqual(files);
        for (const batch of batches) expect(batch.join(' ').length).toBeLessThanOrEqual(100_000);
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
        expect(command.length).toBeLessThan(8191);
    }
});

test('Unix batches count Unicode bytes and reject an argument that cannot fit', () => {
    const files = Array.from({ length: 5000 }, (_, index) => `資料/結果-${String(index)}.txt`);
    const batches = fileBatches(files, ['tool'], 'linux');
    expect(batches.flat()).toStrictEqual(files);
    for (const batch of batches) expect(Buffer.byteLength(['tool', ...batch].join(' '))).toBeLessThan(100_000);
    expect(() => fileBatches(['x'.repeat(100_001)], ['tool'], 'linux')).toThrow('file argument exceeds');
    expect(() => fileBatches([], ['x'.repeat(100_001)], 'linux')).toThrow('Tool arguments exceed');
});
