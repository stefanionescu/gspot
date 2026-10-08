import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { getKeptMode } from '#tests/harness/platforms.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { planReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { planRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import { stat, chmod, lstat, unlink, symlink, readFile, readlink, writeFile } from 'node:fs/promises';

// Later user edits remain intact across replacement and giving the file back.
async function expectEditedLinkPreserved(log: Log, path: string, absolute: string, next: FileCopy): Promise<void> {
    expect(applyPlan(log, planReplacement(log, { path: path, next: next, kind: 'config', canReplace: true }))).toBe(
        'changed',
    );
    await unlink(absolute);
    await symlink('../tool/original.sh', absolute);
    expect(applyPlan(log, planReplacement(log, { path: path, next: next, kind: 'config' }))).toBe('preserved');
    expect(applyPlan(log, planRestoration(log, path))).toBe('preserved');
    expect(await readlink(absolute)).toBe('../tool/original.sh');
}

if (isPosix) {
    test('lifecycle ownership: giving back a twice replaced file deletes it, keeps unowned files, and keeps the log private', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { '.gspot/authored.txt': 'keep\n' });
        const original = Buffer.from([0, 255, 1, 10]);
        await writeFile(join(directory.path, 'config.txt'), original, { mode: 0o640 });
        let log = openOwnership(directory.path);
        try {
            expect(
                applyPlan(
                    log,
                    planReplacement(log, {
                        path: 'config.txt',
                        next: { bytes: Buffer.from('first'), mode: 0o444 },
                        kind: 'config',
                        canReplace: true,
                    }),
                ),
            ).toBe('changed');
            expect(
                applyPlan(
                    log,
                    planReplacement(log, {
                        path: 'config.txt',
                        next: { bytes: Buffer.from('second'), mode: 0o444 },
                        kind: 'config',
                    }),
                ),
            ).toBe('changed');
            log[Symbol.dispose]();
            log = openOwnership(directory.path);
            expect(applyPlan(log, planRestoration(log, 'config.txt'))).toBe('changed');
            expect(log.files.read('config.txt')).toBeUndefined();
            expect(await readFile(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('keep\n');
            expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
            const ownershipMetadata = await stat(join(directory.path, '.gspot/state/ownership.json'));
            expect(ownershipMetadata.mode & 0o777).toBe(getKeptMode(0o600));
        } finally {
            log[Symbol.dispose]();
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
        await chmod(join(directory.path, 'vendor/tools/tool/bin.sh'), 0o755);
        await chmod(join(directory.path, 'vendor/tools/tool/original.sh'), 0o755);
        await symlink('../tool/original.sh', absolute);
        const next = { bytes: Buffer.from('../tool/bin.sh'), mode: 0o777, isLink: true as const };
        let log = openOwnership(directory.path);
        try {
            expect(applyPlan(log, planReplacement(log, { path: path, next: next, kind: 'config' }))).toBe('preserved');
            expect(
                applyPlan(log, planReplacement(log, { path: path, next: next, kind: 'config', canReplace: true })),
            ).toBe('changed');
            expect(applyPlan(log, planReplacement(log, { path: path, next: next, kind: 'config' }))).toBe('unchanged');
            const executed = runTestCommandBlocking([absolute], { cwd: directory.path });
            expect(executed.code, executed.stderr).toBe(0);
            expect(executed.stdout).toBe('installed');
            expect(() => log.files.read(path)).toThrow();
            log[Symbol.dispose]();
            log = openOwnership(directory.path);
            expect(applyPlan(log, planRestoration(log, path))).toBe('changed');
            expect(await lstat(absolute).catch((error: unknown) => error)).toMatchObject({ code: 'ENOENT' });
            const originalMetadata = await stat(join(directory.path, 'vendor/tools/tool/original.sh'));
            expect(originalMetadata.mode & 0o777).toBe(getKeptMode(0o755));
            await expectEditedLinkPreserved(log, path, absolute, next);
        } finally {
            log[Symbol.dispose]();
        }
    });

    test('lifecycle ownership: a regular file containing a link target is preserved after replacing an installed link', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { target: 'authored target' });
        const log = openOwnership(directory.path);
        const next = { bytes: Buffer.from('target'), mode: 0o777, isLink: true as const };
        try {
            expect(applyPlan(log, planReplacement(log, { path: 'tool', next: next, kind: 'config' }))).toBe('changed');
            await unlink(join(directory.path, 'tool'));
            await writeFile(join(directory.path, 'tool'), 'target', { mode: 0o777 });
            expect(applyPlan(log, planReplacement(log, { path: 'tool', next: next, kind: 'config' }))).toBe(
                'preserved',
            );
            expect(applyPlan(log, planRestoration(log, 'tool'))).toBe('preserved');
            const restoredMetadata = await lstat(join(directory.path, 'tool'));
            expect(restoredMetadata.isFile()).toBe(true);
            expect(await readFile(join(directory.path, 'target'), 'utf8')).toBe('authored target');
        } finally {
            log[Symbol.dispose]();
        }
    });
}
