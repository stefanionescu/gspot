import { test, expect } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { parseGitBlobs, parseGitEntries, parseIndexEntries } from '#cli/parsers/contracts.ts';

import {
    SHA1,
    SHA256,
    ENTRY_PATH,
    BINARY_BLOB,
    INVALID_BLOBS,
    INVALID_ENTRIES,
} from '#tests/config/cli/parsers/git.ts';

test.each(['index', 'commit'] as const)('%s entries retain full identities, modes, and unquoted paths', (kind) => {
    const output =
        kind === 'index'
            ? `100644 ${SHA1} 0\t${ENTRY_PATH}\0` +
              `100755 ${SHA256} 0\texecutable\0` +
              `120000 ${SHA1} 0\tlink\0` +
              `160000 ${SHA256} 0\tsubmodule\0`
            : `100644 blob ${SHA1}\t${ENTRY_PATH}\0` +
              `100755 blob ${SHA256}\texecutable\0` +
              `120000 blob ${SHA1}\tlink\0` +
              `160000 commit ${SHA256}\tsubmodule\0`;
    expect(parseGitEntries(Buffer.from(output), kind)).toStrictEqual([
        { mode: '100644', hash: SHA1, path: ENTRY_PATH },
        { mode: '100755', hash: SHA256, path: 'executable' },
        { mode: '120000', hash: SHA1, path: 'link' },
        { mode: '160000', hash: SHA256, path: 'submodule' },
    ]);
    expect(parseGitEntries(Buffer.alloc(0), kind)).toStrictEqual([]);
});

for (const { name, output, message } of INVALID_ENTRIES)
    test(`entry parsing rejects ${name}`, () => {
        const bytes =
            typeof output === 'string'
                ? Buffer.from(output)
                : Buffer.concat([Buffer.from(output.prefix), Buffer.from(output.bytes)]);
        expect(() => parseGitEntries(bytes, 'index')).toThrow(message);
    });

test('batch parsing retains binary content and an empty blob in response order', async () => {
    const output = Buffer.concat([
        Buffer.from(`${SHA1} blob ${String(BINARY_BLOB.length)}\n`),
        Buffer.from(BINARY_BLOB),
        Buffer.from(`\n${SHA256} blob 0\n\n`),
    ]);
    expect(new Map(await Array.fromAsync(parseGitBlobs([output].values(), [SHA1, SHA256])))).toStrictEqual(
        new Map([
            [SHA1, Buffer.from(BINARY_BLOB)],
            [SHA256, Buffer.alloc(0)],
        ]),
    );
    expect(new Map(await Array.fromAsync(parseGitBlobs([Buffer.alloc(0)].values(), [])))).toStrictEqual(new Map());
});

for (const { name, output, message } of INVALID_BLOBS)
    test(`batch parsing rejects ${name}`, async () => {
        await rejects(Array.fromAsync(parseGitBlobs([Buffer.from(output)].values(), [SHA1])), {
            message: new RegExp(message),
        });
    });

test('a nonempty response without requested objects is rejected', async () => {
    await rejects(
        Array.fromAsync(parseGitBlobs([Buffer.from(`${SHA1} blob 0\n\n`)].values(), [])),
        /The Git object stream contains unexpected data/u,
    );
});

test.each([0, 1, 2, 3])('working index entries preserve stage %i and its full identity', (stage) => {
    expect(parseIndexEntries(`100755 ${SHA256} ${String(stage)}\t${ENTRY_PATH}\0`)).toStrictEqual([
        { mode: '100755', hash: SHA256, path: ENTRY_PATH, stage },
    ]);
});

test('batch framing accepts every split between the header, binary body and delimiters', async () => {
    const output = Buffer.concat([
        Buffer.from(`${SHA1} blob 4\n`),
        Buffer.from([0, 255, 0, 10]),
        Buffer.from(`\n${SHA256} blob 0\n\n`),
    ]);
    for (let split = 0; split <= output.length; split += 1) {
        const chunks = [output.subarray(0, split), output.subarray(split)];
        expect(new Map(await Array.fromAsync(parseGitBlobs(chunks.values(), [SHA1, SHA256])))).toStrictEqual(
            new Map([
                [SHA1, Buffer.from([0, 255, 0, 10])],
                [SHA256, Buffer.alloc(0)],
            ]),
        );
    }
});
