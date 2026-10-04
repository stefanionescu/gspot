import { test, expect } from 'bun:test';
import { parseGitBlobs, parseGitEntries, parseIndexEntries } from '#cli/parsers/git.ts';

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
        expect(() => parseGitEntries(Buffer.from(output), 'index')).toThrow(message);
    });

test('batch parsing retains binary content and an empty blob in response order', () => {
    const output = Buffer.concat([
        Buffer.from(`${SHA1} blob ${String(BINARY_BLOB.length)}\n`),
        Buffer.from(BINARY_BLOB),
        Buffer.from(`\n${SHA256} blob 0\n\n`),
    ]);
    expect(parseGitBlobs(output, [SHA1, SHA256])).toStrictEqual(
        new Map([
            [SHA1, Buffer.from(BINARY_BLOB)],
            [SHA256, Buffer.alloc(0)],
        ]),
    );
    expect(parseGitBlobs(Buffer.alloc(0), [])).toStrictEqual(new Map());
});

for (const { name, output, message } of INVALID_BLOBS)
    test(`batch parsing rejects ${name}`, () => {
        expect(() => parseGitBlobs(Buffer.from(output), [SHA1])).toThrow(message);
    });

test('a nonempty response without requested objects is rejected', () => {
    expect(() => parseGitBlobs(Buffer.from(`${SHA1} blob 0\n\n`), [])).toThrow(
        'The Git object stream contains unexpected data.',
    );
});

test.each([0, 1, 2, 3])('working index entries preserve stage %i and its full identity', (stage) => {
    expect(parseIndexEntries(`100755 ${SHA256} ${String(stage)}\t${ENTRY_PATH}\0`)).toStrictEqual([
        { mode: '100755', hash: SHA256, path: ENTRY_PATH, stage },
    ]);
});
