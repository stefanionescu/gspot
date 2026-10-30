import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openFiles } from '#cli/system/files/open.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { writePlans, planReplacements } from '#cli/repository/writer.ts';

test('a batch writes binary bytes, and a removal plan deletes one file and keeps the other', async () => {
    await using sandbox = await testdir();
    const writer = openFiles(sandbox.path);
    const first = Buffer.from([0, 255, 10]);
    const second = Buffer.from([255, 0, 13]);
    writePlans(
        writer,
        planReplacements(writer, [
            { path: `${GSPOT_FOLDER}/first.bin`, next: { bytes: first, mode: 0o644 } },
            { path: `${GSPOT_FOLDER}/second.bin`, next: { bytes: second, mode: 0o644 } },
        ]),
    );
    expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/first.bin`))).toStrictEqual(first);
    expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/second.bin`))).toStrictEqual(second);
    writePlans(writer, [{ path: `${GSPOT_FOLDER}/first.bin`, status: 'changed' }]);
    expect(writer.readStats(`${GSPOT_FOLDER}/first.bin`)).toBeUndefined();
    expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/second.bin`))).toStrictEqual(second);
});

test('a file gspot does not own refuses the whole batch and leaves every file as it was', async () => {
    await using sandbox = await testdir({ [`${GSPOT_FOLDER}/owned.txt`]: 'original', 'authored.txt': 'keep authored' });

    const writer = openFiles(sandbox.path);

    writePlans(
        writer,
        planReplacements(writer, [
            {
                path: `${GSPOT_FOLDER}/owned.txt`,
                next: { bytes: Buffer.from('installed'), mode: 0o644 },
                expected: writer.read(`${GSPOT_FOLDER}/owned.txt`),
            },
        ]),
    );
    const plans = planReplacements(
        writer,
        [`${GSPOT_FOLDER}/owned.txt`, 'authored.txt'].map((path) => ({
            path,
            next: { bytes: Buffer.from('replacement'), mode: 0o644 },
        })),
    );
    expect(() => {
        writePlans(writer, plans);
    }).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'writing',
            message: 'gspot did not overwrite these files: authored.txt. Move them aside, then run the command again.',
        }),
    );
    expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/owned.txt`), 'utf8')).toBe('installed');
    expect(await readFile(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('keep authored');
});
