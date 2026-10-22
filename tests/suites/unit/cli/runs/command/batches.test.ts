import { test, expect } from 'bun:test';
import { captureThrow } from '#tests/setup/matchers.ts';
import { splitFileArguments } from '#cli/runs/command/batches.ts';
import { UNIX_COMMAND_LIMIT, WINDOWS_COMMAND_LIMIT } from '#cli/config/runs/command/batches.ts';

test('Windows batches leave room for quoted paths and the full executable path', () => {
    const files = Array.from({ length: 5000 }, (_, index) => `docs/café folder (draft)/page-${String(index)}.md`);
    const fixed = [
        'C:/workspace with spaces/node_modules/.bin/markdownlint.cmd',
        '--config',
        'C:/workspace with spaces/.gspot/markdown.json',
    ];
    const batches = splitFileArguments(files, fixed, 'win32');
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toStrictEqual(files);
    for (const batch of batches) {
        const command = [...fixed, ...batch].map((argument) => `"${argument}"`).join(' ');
        expect(command.length).toBeLessThanOrEqual(WINDOWS_COMMAND_LIMIT);
    }
});

test('a long Unicode list splits under the byte limit in order, and a path or tool arguments that cannot fit are refused', () => {
    const files = Array.from({ length: 5000 }, (_, index) => `資料/結果-${String(index)}.txt`);
    const fixed = ['tool', '--data', 'x'.repeat(UNIX_COMMAND_LIMIT / 2)];
    const batches = splitFileArguments(files, fixed, 'linux');
    expect(batches.flat()).toStrictEqual(files);
    for (const batch of batches)
        expect(Buffer.byteLength([...fixed, ...batch].join(' '))).toBeLessThanOrEqual(UNIX_COMMAND_LIMIT);
    expect(captureThrow(() => splitFileArguments(['x'.repeat(UNIX_COMMAND_LIMIT + 1)], ['tool'], 'linux'))).toBe(
        `${'x'.repeat(UNIX_COMMAND_LIMIT + 1)} is too long for one command line. Shorten its path.`,
    );
    expect(() => splitFileArguments([], ['x'.repeat(UNIX_COMMAND_LIMIT + 1)], 'linux')).toThrow(
        new Error('Tool arguments exceed the command limit. Shorten the tool arguments.'),
    );
});
