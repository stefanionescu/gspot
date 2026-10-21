import { Readable } from 'node:stream';
import { test, expect } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';

import {
    parseGitBlobs,
    parseTreeEntries,
    stripIndexStages,
    parseIndexEntries,
    parseAttributePatterns,
} from '#cli/parsers/git.ts';
import {
    SHA1,
    SHA256,
    ENTRY_PATH,
    BINARY_BLOB,
    BLOB_FAILURE,
    ENTRY_FAILURE,
    INVALID_BLOBS,
    ATTRIBUTE_LINES,
    INVALID_ENTRIES,
} from '#tests/data/parsers/git.ts';

test.each([...ATTRIBUTE_LINES])(
    'a .gitattributes line in C quoting decodes its octal bytes, and an [attr] macro line gives no pattern: $line',
    ({ line, expected }) => {
        expect(parseAttributePatterns(line, '.')).toStrictEqual(expected);
    },
);

test('tree entries keep full object IDs, modes and unquoted paths', () => {
    const output =
        `100644 blob ${SHA1}\t${ENTRY_PATH}\0` +
        `100755 blob ${SHA256}\texecutable\0` +
        `120000 blob ${SHA1}\tlink\0` +
        `160000 commit ${SHA256}\tsubmodule\0`;
    expect(parseTreeEntries(Buffer.from(output))).toStrictEqual([
        { mode: '100644', hash: SHA1, path: ENTRY_PATH },
        { mode: '100755', hash: SHA256, path: 'executable' },
        { mode: '120000', hash: SHA1, path: 'link' },
        { mode: '160000', hash: SHA256, path: 'submodule' },
    ]);
    expect(parseTreeEntries(Buffer.alloc(0))).toStrictEqual([]);
});

test.each([...INVALID_ENTRIES])(`a Git entry listing is refused: $name`, (entry) => {
    const { name, output } = entry;
    const message = 'message' in entry ? entry.message : ENTRY_FAILURE;
    const bytes =
        typeof output === 'string'
            ? Buffer.from(output)
            : Buffer.concat([Buffer.from(output.prefix), Buffer.from(output.bytes)]);
    if (name === 'unmerged index stage') {
        expect(() => stripIndexStages(parseIndexEntries(bytes.toString('utf8')))).toThrow(message);
    } else {
        if (typeof output === 'string') expect(() => parseIndexEntries(output)).toThrow(message);
        const tab = bytes.indexOf(9);
        const space = bytes.indexOf(32);
        const tree = Buffer.concat([
            bytes.subarray(0, space + 1),
            Buffer.from('blob '),
            bytes.subarray(space + 1, tab - 2),
            bytes.subarray(tab),
        ]);
        expect(() => parseTreeEntries(tree)).toThrow(message);
    }
});

test('a batch keeps binary content and an empty blob in response order', async () => {
    const output = Buffer.concat([
        Buffer.from(`${SHA1} blob ${String(BINARY_BLOB.length)}\n`),
        Buffer.from(BINARY_BLOB),
        Buffer.from(`\n${SHA256} blob 0\n\n`),
    ]);
    expect(new Map(await Array.fromAsync(parseGitBlobs(Readable.from([output]), [SHA1, SHA256])))).toStrictEqual(
        new Map([
            [SHA1, Buffer.from(BINARY_BLOB)],
            [SHA256, Buffer.alloc(0)],
        ]),
    );
    expect(new Map(await Array.fromAsync(parseGitBlobs(Readable.from([Buffer.alloc(0)]), [])))).toStrictEqual(
        new Map(),
    );
});

test.each([...INVALID_BLOBS])(`a batch is refused: $name`, async ({ output }) => {
    expect(await captureRejection(Array.fromAsync(parseGitBlobs(Readable.from([Buffer.from(output)]), [SHA1])))).toBe(
        BLOB_FAILURE,
    );
});

test.each([0, 1])('index entries keep stage %i and the full object ID', (stage) => {
    expect(parseIndexEntries(`100755 ${SHA256} ${String(stage)}\t${ENTRY_PATH}\0`)).toStrictEqual([
        { mode: '100755', hash: SHA256, path: ENTRY_PATH, stage },
    ]);
});

test('a batch parses the same for every split between header, body and delimiters', async () => {
    const output = Buffer.concat([
        Buffer.from(`${SHA1} blob 4\n`),
        Buffer.from([0, 255, 0, 10]),
        Buffer.from(`\n${SHA256} blob 0\n\n`),
    ]);
    for (let split = 0; split <= output.length; split += 1) {
        const chunks = [output.subarray(0, split), output.subarray(split)];
        expect(new Map(await Array.fromAsync(parseGitBlobs(Readable.from(chunks), [SHA1, SHA256])))).toStrictEqual(
            new Map([
                [SHA1, Buffer.from([0, 255, 0, 10])],
                [SHA256, Buffer.alloc(0)],
            ]),
        );
    }
});
