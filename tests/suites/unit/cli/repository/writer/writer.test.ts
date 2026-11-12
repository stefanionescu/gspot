import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { planReplacements, writePlans } from '#cli/repository/writer.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { matchFields } from '#tests/setup/matchers.ts';

const AUTHORED_REFUSAL = matchFields<GspotError>({
    name: 'GspotError',
    code: 'writing',
    message: expect.stringContaining('authored.txt') as string,
});

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
    expect(writer.findStats(`${GSPOT_FOLDER}/first.bin`)).toBeUndefined();
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
                previous: writer.read(`${GSPOT_FOLDER}/owned.txt`),
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
    }).toThrow(AUTHORED_REFUSAL);
    expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/owned.txt`), 'utf8')).toBe('installed');
    expect(await readFile(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('keep authored');
});

test.each(['edited', 'deleted'])('a reviewed authored file that was %s is not replaced', async (change) => {
    await using sandbox = await testdir({ 'authored.txt': 'reviewed\n' });
    const writer = openFiles(sandbox.path);
    const previous = writer.read('authored.txt');
    await (change === 'edited'
        ? writeFile(join(sandbox.path, 'authored.txt'), 'new edit\n')
        : unlink(join(sandbox.path, 'authored.txt')));
    const plans = planReplacements(writer, [
        { path: 'authored.txt', previous, next: { bytes: Buffer.from('generated\n'), mode: 0o644 } },
    ]);
    expect(() => {
        writePlans(writer, plans);
    }).toThrow(AUTHORED_REFUSAL);
    expect(writer.read('authored.txt')?.bytes.toString('utf8')).toBe(change === 'edited' ? 'new edit\n' : undefined);
});
