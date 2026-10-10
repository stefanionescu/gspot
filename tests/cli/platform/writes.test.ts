import { join } from 'node:path';
import { testdir } from 'testdirs';
import * as filesystem from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { setImmediate } from 'node:timers/promises';
import { pathExists } from '#tests/harness/preservation.ts';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { FLUSH_FAILURES } from '#tests/config/cli/platform/writes.ts';
import { installTree } from '#cli/lifecycle/ownership/state/public.ts';

// Real flushes are held at their callback boundary. Only the error case injects a synthetic failure.
test.each([...FLUSH_FAILURES])(
    'batch publication drains descriptors and preserves the installed tree after $name',
    async ({ change, message }) => {
        await using directory = await testdir();
        using log = openOwnership(directory.path);
        await installTree(log, 'npm', [
            { path: '.gspot/node_modules/previous', file: { bytes: Buffer.from('old'), mode: 0o644 } },
        ]);
        const ready = Promise.withResolvers<undefined>();
        const held: Array<{
            error: NodeJS.ErrnoException | null;
            finish: (error: NodeJS.ErrnoException | null) => void;
        }> = [];
        const flush = filesystem.fsync;
        using _boundary = spyOn(filesystem, 'fsync').mockImplementation(
            Object.assign((file: number, finish: (error: NodeJS.ErrnoException | null) => void) => {
                flush(file, (error) => {
                    held.push({ error, finish });
                    if (held.length === 2) ready.resolve(undefined);
                });
            }, flush),
        );
        const outcome: { settled: boolean; failure?: unknown } = { settled: false };
        const publication = installTree(log, 'npm', [
            { path: '.gspot/node_modules/first', file: { bytes: Buffer.from('first'), mode: 0o644 } },
            { path: '.gspot/node_modules/second', file: { bytes: Buffer.from('second'), mode: 0o644 } },
        ]).then(
            () => {
                outcome.settled = true;
            },
            (error: unknown) => {
                outcome.failure = error;
                outcome.settled = true;
            },
        );
        try {
            await ready.promise;
            if (change) {
                const [temporary] = await readdir(join(directory.path, '.gspot/node_modules.next'));
                await writeFile(join(directory.path, '.gspot/node_modules.next', temporary!), 'changed bytes');
            }
            const first = held.shift()!;
            first.finish(change ? first.error : Object.assign(new Error(message), { code: 'EIO' }));
            await setImmediate();
            expect(outcome.settled).toBe(false);
            for (const pending of held.splice(0)) pending.finish(pending.error);
            await publication;
            expect(outcome.failure).toBeInstanceOf(Error);
            expect((outcome.failure as Error).message).toContain(message);
            expect(await readFile(join(directory.path, '.gspot/node_modules/previous'), 'utf8')).toBe('old');
        } finally {
            for (const pending of held.splice(0)) pending.finish(pending.error);
            await publication;
        }
        log[Symbol.dispose]();
        using recovered = openOwnership(directory.path);
        expect(await pathExists(join(directory.path, '.gspot/node_modules.next'))).toBe(false);
        expect(await readFile(join(directory.path, '.gspot/node_modules/previous'), 'utf8')).toBe('old');
        expect(recovered.state.installed).toStrictEqual(['npm']);
    },
);
