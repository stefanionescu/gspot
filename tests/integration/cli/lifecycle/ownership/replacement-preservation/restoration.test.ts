import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';

import {
    chmodSync,
    lchmodSync,
    lstatSync,
    readFileSync,
    readlinkSync,
    statSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';

if (process.platform !== 'win32')
    describe('lifecycle ownership', () => {
        test('two replacements restore the first original bytes and mode and preserve unowned files', async () => {
            await using directory = await testdir();
            await createFileTree(directory.path, { '.gspot/authored.txt': 'keep\n' });
            const original = Buffer.from([0, 255, 1, 10]);
            writeFileSync(join(directory.path, 'config.txt'), original, { mode: 0o640 });
            let owner = openLifecycleOwner(directory.path);
            try {
                expect(owner.replace('config.txt', { bytes: Buffer.from('first'), mode: 0o444 }, 'config', true)).toBe(
                    'changed',
                );
                expect(owner.replace('config.txt', { bytes: Buffer.from('second'), mode: 0o444 }, 'config')).toBe(
                    'changed',
                );
                owner.close();
                owner = openLifecycleOwner(directory.path);
                expect(owner.restore('config.txt')).toBe('changed');
                expect(owner.read('config.txt')).toStrictEqual({ bytes: original, mode: 0o640 });
                expect(readFileSync(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('keep\n');
                expect(owner.paths()).toStrictEqual([]);
                expect(statSync(join(directory.path, '.gspot/state/ownership.json')).mode & 0o777).toBe(0o600);
                expect(statSync(join(directory.path, '.gspot/state/recovery')).mode & 0o777).toBe(0o700);
            } finally {
                owner.close();
            }
        });

        test('installed executable links run, restore authored links and modes, and preserve later edits', async () => {
            await using directory = await testdir();
            await createFileTree(directory.path, {
                '.gspot/node_modules/tool/bin.sh': '#!/bin/sh\nprintf installed',
                '.gspot/node_modules/tool/original.sh': '#!/bin/sh\nprintf original',
                '.gspot/node_modules/.bin/.keep': '',
            });
            const path = '.gspot/node_modules/.bin/tool';
            const absolute = join(directory.path, path);
            chmodSync(join(directory.path, '.gspot/node_modules/tool/bin.sh'), 0o755);
            chmodSync(join(directory.path, '.gspot/node_modules/tool/original.sh'), 0o755);
            symlinkSync('../tool/original.sh', absolute);
            if (process.platform === 'darwin') lchmodSync(absolute, 0o700);
            const originalMode = lstatSync(absolute).mode & 0o7777;
            const next = { bytes: Buffer.from('../tool/bin.sh'), mode: 0o777, isLink: true as const };
            let owner = openLifecycleOwner(directory.path);
            try {
                expect(owner.replace(path, next, 'config')).toBe('preserved');
                expect(owner.replace(path, next, 'config', true)).toBe('changed');
                expect(owner.replace(path, next, 'config')).toBe('unchanged');
                const executed = Bun.spawnSync([absolute], { stdout: 'pipe', stderr: 'pipe' });
                expect(executed.exitCode, executed.stderr.toString()).toBe(0);
                expect(executed.stdout.toString()).toBe('installed');
                expect(() => owner.read(path)).toThrow();
                owner.close();
                owner = openLifecycleOwner(directory.path);
                expect(owner.restore(path)).toBe('changed');
                expect(readlinkSync(absolute)).toBe('../tool/original.sh');
                expect(lstatSync(absolute).mode & 0o7777).toBe(originalMode);
                expect(statSync(join(directory.path, '.gspot/node_modules/tool/original.sh')).mode & 0o777).toBe(0o755);
                expect(owner.replace(path, next, 'config', true)).toBe('changed');
                unlinkSync(absolute);
                symlinkSync('../tool/original.sh', absolute);
                expect(owner.replace(path, next, 'config')).toBe('preserved');
                expect(owner.restore(path)).toBe('preserved');
                expect(readlinkSync(absolute)).toBe('../tool/original.sh');
            } finally {
                owner.close();
            }
        });

        test('a regular file containing a link target is preserved after replacing an installed link', async () => {
            await using directory = await testdir();
            await createFileTree(directory.path, { target: 'authored target' });
            const owner = openLifecycleOwner(directory.path);
            const next = { bytes: Buffer.from('target'), mode: 0o777, isLink: true as const };
            try {
                expect(owner.replace('tool', next, 'config')).toBe('changed');
                unlinkSync(join(directory.path, 'tool'));
                writeFileSync(join(directory.path, 'tool'), 'target', { mode: 0o777 });
                expect(owner.replace('tool', next, 'config')).toBe('preserved');
                expect(owner.restore('tool')).toBe('preserved');
                expect(lstatSync(join(directory.path, 'tool')).isFile()).toBe(true);
                expect(readFileSync(join(directory.path, 'target'), 'utf8')).toBe('authored target');
            } finally {
                owner.close();
            }
        });
    });
