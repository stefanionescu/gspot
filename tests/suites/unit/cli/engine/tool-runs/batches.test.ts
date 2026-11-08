import { expect, test } from 'bun:test';

import { UNIX_COMMAND_LIMIT, WINDOWS_COMMAND_LIMIT, WINDOWS_PROCESS_LIMIT } from '#cli/config/engine.ts';
import { splitFileArguments } from '#cli/engine/tool-runs/batches.ts';
import type { CheckStop } from '#cli/system/errors.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('Windows batches leave room for quoted paths and the absolute executable path', () => {
    const files = Array.from({ length: 5000 }, (_, index) => `docs/café folder (draft)/page-${String(index)}.md`);
    const fixed = [
        'C:/workspace with spaces/node_modules/.bin/markdownlint.cmd',
        '--config',
        'C:/workspace with spaces/.gspot/markdown.json',
    ];
    const batches = splitFileArguments(files, fixed, 'win32');
    expect(batches.flat()).toStrictEqual(files);
    for (const batch of batches) {
        const command = [...fixed, ...batch].map((argument) => `"${argument}"`).join(' ');
        expect(command.length).toBeLessThanOrEqual(WINDOWS_COMMAND_LIMIT);
    }
});

test('a Windows program that is no batch file gets the CreateProcess limit', () => {
    const files = Array.from({ length: 5000 }, (_, index) => `docs/café folder (draft)/page-${String(index)}.md`);
    const fixed = ['C:/node/node.exe', 'C:/workspace/.gspot/node_modules/markdownlint/bin.js'];
    const batches = splitFileArguments(files, fixed, 'win32');
    expect(batches.flat()).toStrictEqual(files);
    for (const batch of batches) {
        const command = [...fixed, ...batch].map((argument) => `"${argument}"`).join(' ');
        expect(command.length).toBeLessThanOrEqual(WINDOWS_PROCESS_LIMIT);
    }
    expect(batches[0]!.join(' ').length).toBeGreaterThan(WINDOWS_COMMAND_LIMIT);
});

test('a long Unicode list splits under the byte limit in order, and a path or tool arguments that cannot fit are refused', () => {
    const files = Array.from({ length: 5000 }, (_, index) => `資料/結果-${String(index)}.txt`);
    const fixed = ['tool', '--data', 'x'.repeat(UNIX_COMMAND_LIMIT / 2)];
    const batches = splitFileArguments(files, fixed, 'linux');
    expect(batches.flat()).toStrictEqual(files);
    for (const batch of batches)
        expect(Buffer.byteLength([...fixed, ...batch].join(' '))).toBeLessThanOrEqual(UNIX_COMMAND_LIMIT);
    const refusal = matchFields<CheckStop>({ name: 'CheckStop', status: 'error' });
    expect(() => splitFileArguments(['x'.repeat(UNIX_COMMAND_LIMIT + 1)], ['tool'], 'linux')).toThrow(refusal);
    expect(() => splitFileArguments([], ['x'.repeat(UNIX_COMMAND_LIMIT + 1)], 'linux')).toThrow(refusal);
});

test('file arguments that fill the byte budget stay together and the next byte starts another batch', () => {
    const first = 'x'.repeat(UNIX_COMMAND_LIMIT - Buffer.byteLength('tool') - 4);
    expect(splitFileArguments([first, 'a'], ['tool'], 'linux')).toStrictEqual([[first, 'a']]);
    expect(splitFileArguments([first, 'ab'], ['tool'], 'linux')).toStrictEqual([[first], ['ab']]);
});
