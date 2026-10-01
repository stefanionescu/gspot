import { join } from 'node:path';
import { test, expect } from 'bun:test';
import type { Read } from '#cli/types/platform.ts';
import { testdir, createFileTree } from 'testdirs';
import { openOwner } from '#cli/lifecycle/ownership/owner.ts';
import type { Owner } from '#cli/types/lifecycle/lifecycle.ts';
import { onPosix, keptMode } from '#tests/support/cli/platforms.ts';

import {
    statSync,
    chmodSync,
    lstatSync,
    unlinkSync,
    symlinkSync,
    readFileSync,
    readlinkSync,
    writeFileSync,
} from 'node:fs';

// Later user edits remain intact across replacement and giving the file back.
function expectEditedLinkPreserved(owner: Owner, path: string, absolute: string, next: Read): void {
    expect(owner.replace(path, next, 'config', true)).toBe('changed');
    unlinkSync(absolute);
    symlinkSync('../tool/original.sh', absolute);
    expect(owner.replace(path, next, 'config')).toBe('preserved');
    expect(owner.applyPlan(owner.proposeRestoration(path))).toBe('preserved');
    expect(readlinkSync(absolute)).toBe('../tool/original.sh');
}

if (onPosix) {
    test('lifecycle ownership: giving back a twice replaced file deletes it, keeps unowned files, and keeps the log private', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { '.gspot/authored.txt': 'keep\n' });
        const original = Buffer.from([0, 255, 1, 10]);
        writeFileSync(join(directory.path, 'config.txt'), original, { mode: 0o640 });
        let owner = openOwner(directory.path);
        try {
            expect(owner.replace('config.txt', { bytes: Buffer.from('first'), mode: 0o444 }, 'config', true)).toBe(
                'changed',
            );
            expect(owner.replace('config.txt', { bytes: Buffer.from('second'), mode: 0o444 }, 'config')).toBe(
                'changed',
            );
            owner.close();
            owner = openOwner(directory.path);
            expect(owner.applyPlan(owner.proposeRestoration('config.txt'))).toBe('changed');
            expect(owner.read('config.txt')).toBeUndefined();
            expect(readFileSync(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('keep\n');
            expect(owner.paths()).toStrictEqual([]);
            expect(statSync(join(directory.path, '.gspot/state/ownership.json')).mode & 0o777).toBe(keptMode(0o600));
        } finally {
            owner.close();
        }
    });

    test('lifecycle ownership: installed executable links run, giving them back deletes them, and later edits stay', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'vendor/tools/tool/bin.sh': '#!/bin/sh\nprintf installed',
            'vendor/tools/tool/original.sh': '#!/bin/sh\nprintf original',
            'vendor/tools/.bin/.keep': '',
        });
        const path = 'vendor/tools/.bin/tool';
        const absolute = join(directory.path, path);
        chmodSync(join(directory.path, 'vendor/tools/tool/bin.sh'), 0o755);
        chmodSync(join(directory.path, 'vendor/tools/tool/original.sh'), 0o755);
        symlinkSync('../tool/original.sh', absolute);
        const next = { bytes: Buffer.from('../tool/bin.sh'), mode: 0o777, isLink: true as const };
        let owner = openOwner(directory.path);
        try {
            expect(owner.replace(path, next, 'config')).toBe('preserved');
            expect(owner.replace(path, next, 'config', true)).toBe('changed');
            expect(owner.replace(path, next, 'config')).toBe('unchanged');
            const executed = Bun.spawnSync([absolute], { stdout: 'pipe', stderr: 'pipe' });
            expect(executed.exitCode, executed.stderr.toString()).toBe(0);
            expect(executed.stdout.toString()).toBe('installed');
            expect(() => owner.read(path)).toThrow();
            owner.close();
            owner = openOwner(directory.path);
            expect(owner.applyPlan(owner.proposeRestoration(path))).toBe('changed');
            expect(lstatSync(absolute, { throwIfNoEntry: false })).toBeUndefined();
            expect(statSync(join(directory.path, 'vendor/tools/tool/original.sh')).mode & 0o777).toBe(keptMode(0o755));
            expectEditedLinkPreserved(owner, path, absolute, next);
        } finally {
            owner.close();
        }
    });

    test('lifecycle ownership: a regular file containing a link target is preserved after replacing an installed link', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { target: 'authored target' });
        const owner = openOwner(directory.path);
        const next = { bytes: Buffer.from('target'), mode: 0o777, isLink: true as const };
        try {
            expect(owner.replace('tool', next, 'config')).toBe('changed');
            unlinkSync(join(directory.path, 'tool'));
            writeFileSync(join(directory.path, 'tool'), 'target', { mode: 0o777 });
            expect(owner.replace('tool', next, 'config')).toBe('preserved');
            expect(owner.applyPlan(owner.proposeRestoration('tool'))).toBe('preserved');
            expect(lstatSync(join(directory.path, 'tool')).isFile()).toBe(true);
            expect(readFileSync(join(directory.path, 'target'), 'utf8')).toBe('authored target');
        } finally {
            owner.close();
        }
    });
}
