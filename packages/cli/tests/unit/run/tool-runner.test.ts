import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { run } from '#cli/platform/spawn.ts';
import { describe, expect, test } from 'bun:test';
import { fileBatches } from '#cli/run/file-batches.ts';

describe('spawning a tool', () => {
    test('a run past its timeout is stopped and says so', async () => {
        await using fixture = await createFixture({});
        const result = await run([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
            cwd: fixture.path,
            timeoutMs: 200,
        });
        expect(result.isTimedOut).toBe(true);
        expect(result.duration).toBeLessThan(3000);
    });

    test('a run inside its timeout reports no timeout', async () => {
        await using fixture = await createFixture({});
        const result = await run([process.execPath, '-e', 'process.exitCode = 0'], {
            cwd: fixture.path,
            timeoutMs: 5000,
        });
        expect(result.isTimedOut).toBe(false);
        expect(result.code).toBe(0);
    });
});

describe('subprocess completion', () => {
    test('drains output larger than pipe buffers before returning the child status', async () => {
        await using fixture = await createFixture({
            'output.js': `const text = 'é'.repeat(1024 * 1024);
process.stdout.write(text);
process.stderr.write(text);
process.exitCode = Number(process.argv[2]);`,
        });
        const expected = 'é'.repeat(1024 * 1024);
        for (const status of [0, 7]) {
            const result = await run([process.execPath, join(fixture.path, 'output.js'), String(status)], {
                cwd: fixture.path,
                timeoutMs: 5000,
            });
            expect(result.isTimedOut).toBe(false);
            expect(result.code).toBe(status);
            expect(result.stdout).toBe(expected);
            expect(result.stderr).toBe(expected);
        }
    });

    test('reports a missing executable as a failed launch', async () => {
        await using fixture = await createFixture({});
        const result = await run([join(fixture.path, 'missing-executable')], { cwd: fixture.path });
        expect(result.missing).toBe(true);
        expect(result.code).not.toBe(0);
        expect(result.stderr).not.toBe('');
    });
});

describe('file batches', () => {
    test('a list that fits is one batch, and a long list splits under the budget in order', () => {
        expect(fileBatches(['a.sh', 'b.sh'], ['tool'], 'linux')).toEqual([['a.sh', 'b.sh']]);
        const files = Array.from({ length: 5000 }, (_, index) => `scripts/deploy/step-${String(index)}.sh`);
        const batches = fileBatches(files, ['tool'], 'linux');
        expect(batches.length).toBeGreaterThan(1);
        expect(batches.flat()).toEqual(files);
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
    expect(batches.flat()).toEqual(files);
    for (const batch of batches) {
        const command = [...fixed, ...batch].map((argument) => `"${argument}"`).join(' ');
        expect(command.length).toBeLessThan(8191);
    }
});

test('Unix batches count Unicode bytes and reject an argument that cannot fit', () => {
    const files = Array.from({ length: 5000 }, (_, index) => `資料/結果-${String(index)}.txt`);
    const batches = fileBatches(files, ['tool'], 'linux');
    expect(batches.flat()).toEqual(files);
    for (const batch of batches) expect(Buffer.byteLength(['tool', ...batch].join(' '))).toBeLessThan(100_000);
    expect(() => fileBatches(['x'.repeat(100_001)], ['tool'], 'linux')).toThrow('file argument exceeds');
    expect(() => fileBatches([], ['x'.repeat(100_001)], 'linux')).toThrow('Tool arguments exceed');
});

test('Batched tool invocations preserve spaced Unicode file arguments', async () => {
    await using fixture = await createFixture({
        'echo.cjs': 'process.stdout.write(JSON.stringify(process.argv.slice(2)));',
        'node_modules/.bin/echo.cmd': '@echo off\r\nnode "%~dp0..\\..\\echo.cjs" %*\r\n',
    });
    const fixed =
        process.platform === 'win32'
            ? [join(fixture.path, 'node_modules/.bin/echo.cmd')]
            : [process.execPath, join(fixture.path, 'echo.cjs')];
    const files = Array.from({ length: 300 }, (_, index) => `docs/café (draft & review)/page-${String(index)}.md`);
    const batches = fileBatches(files, fixed, 'win32');
    const received: string[] = [];
    for (const batch of batches) {
        const result = await run([...fixed, ...batch], { cwd: fixture.path });
        expect(result.code).toBe(0);
        expect(result.stdout).toBe(JSON.stringify(batch));
        received.push(...batch);
    }
    expect(received).toEqual(files);
});
