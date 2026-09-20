import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createSandbox } from './sandbox.ts';
import { rejects } from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

test('an isolated checkout removes its files when the test body fails', async () => {
    let path = '';
    await rejects(async () => {
        await using sandbox = await createSandbox({ 'nested/input.txt': 'input', empty: null });
        path = sandbox.path;
        expect(readFileSync(join(path, 'nested/input.txt'), 'utf8')).toBe('input');
        expect(statSync(join(path, 'empty')).isDirectory()).toBe(true);
        throw new Error('Planted test failure');
    }, /Planted test failure/u);
    expect(existsSync(path)).toBe(false);
});

test('an isolated checkout removes partial setup after a filesystem error', async () => {
    await using parent = await createSandbox({});
    await rejects(createSandbox({ blocked: 'file', 'blocked/child': 'unwritable' }, parent.path));
    expect(readdirSync(parent.path)).toEqual([]);
});
