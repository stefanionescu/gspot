import { Readable } from 'node:stream';
import { test, expect } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';

import {
    parseGitBlobs,
    parseTreeFiles,
    parseIndexFiles,
    stripIndexStages,
    parseAttributePatterns,
} from '#cli/parsers/git.ts';
import {
    SHA1,
    SHA256,
    INDEX_PATH,
    BINARY_BLOB,
    BLOB_FAILURE,
    INVALID_BLOBS,
    ATTRIBUTE_LINES,
    INDEX_LINE_FAILURE,
    INVALID_INDEX_LINES,
    TRAILING_BLOB_CHUNKS,
} from '#tests/config/parsers/git.ts';

test.each([...ATTRIBUTE_LINES])(
    'a .gitattributes line in C quoting decodes its octal bytes, and an [attr] macro line gives no pattern: $line',
    ({ line, expected }) => {
        expect(parseAttributePatterns(line, '.')).toStrictEqual(expected);
    },
);

test('tree entries keep full object IDs, modes and unquoted paths', () => {
    const output =
        `100644 blob ${SHA1}\t${INDEX_PATH}\0` +
        `100755 blob ${SHA256}\texecutable\0` +
        `120000 blob ${SHA1}\tlink\0` +
        `160000 commit ${SHA256}\tsubmodule\0`;
    expect(parseTreeFiles(Buffer.from(output))).toStrictEqual([
        { mode: '100644', hash: SHA1, path: INDEX_PATH },
        { mode: '100755', hash: SHA256, path: 'executable' },
        { mode: '120000', hash: SHA1, path: 'link' },
        { mode: '160000', hash: SHA256, path: 'submodule' },
    ]);
    expect(parseTreeFiles(Buffer.alloc(0))).toStrictEqual([]);
});

test.each([...INVALID_INDEX_LINES])('an index or tree listing is refused: $name', (row) => {
    const { output } = row;
    const message = 'message' in row ? row.message : INDEX_LINE_FAILURE;
    const bytes =
        typeof output === 'string'
            ? Buffer.from(output)
            : Buffer.concat([Buffer.from(output.prefix), Buffer.from(output.bytes)]);

    if (typeof output === 'string') expect(() => parseIndexFiles(output)).toThrow(message);
    const tab = bytes.indexOf(9);
    const space = bytes.indexOf(32);
    const tree = Buffer.concat([
        bytes.subarray(0, space + 1),
        Buffer.from('blob '),
        bytes.subarray(space + 1, tab - 2),
        bytes.subarray(tab),
    ]);
    expect(() => parseTreeFiles(tree)).toThrow(message);
});

test('a batch keeps binary content and an empty blob in response order', async () => {
    const output = Buffer.concat([
        Buffer.from(`${SHA1} blob ${String(BINARY_BLOB.length)}\n`),
        Buffer.from(BINARY_BLOB),
        Buffer.from(`\n${SHA256} blob 0\n\n`),
    ]);
    const blobs = await Array.fromAsync(parseGitBlobs(Readable.from([output]), [SHA1, SHA256]));
    const observed = new Map(blobs);
    expect(observed).toStrictEqual(
        new Map([
            [SHA1, Buffer.from(BINARY_BLOB)],
            [SHA256, Buffer.alloc(0)],
        ]),
    );
    const empty = Buffer.alloc(0);
    const emptyBlobs = await Array.fromAsync(parseGitBlobs(Readable.from([empty]), []));
    const emptyMap = new Map(emptyBlobs);
    expect(emptyMap).toStrictEqual(new Map());
});

test.each([...INVALID_BLOBS])(`a batch is refused: $name`, async ({ output }) => {
    const stream = parseGitBlobs(Readable.from([Buffer.from(output)]), [SHA1]);
    const observed = Array.fromAsync(stream);
    const streamError = await captureRejection(observed);
    expect(streamError.message).toBe(BLOB_FAILURE);
});

test.each([0, 1])('index entries keep stage %i and the full object ID', (stage) => {
    expect(parseIndexFiles(`100755 ${SHA256} ${String(stage)}\t${INDEX_PATH}\0`)).toStrictEqual([
        { mode: '100755', hash: SHA256, path: INDEX_PATH, stage },
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
        const blobs = await Array.fromAsync(parseGitBlobs(Readable.from(chunks), [SHA1, SHA256]));
        const observed = new Map(blobs);
        expect(observed).toStrictEqual(
            new Map([
                [SHA1, Buffer.from([0, 255, 0, 10])],
                [SHA256, Buffer.alloc(0)],
            ]),
        );
    }
});

test.each([...TRAILING_BLOB_CHUNKS])('a Git blob stream refuses trailing bytes in the $name', async ({ chunks }) => {
    const stream = parseGitBlobs(Readable.from(chunks.map((chunk) => Buffer.from(chunk))), [SHA1]);
    const observed = Array.fromAsync(stream);
    const error = await captureRejection(observed);
    expect(error.message).toBe(BLOB_FAILURE);
});

test('a Git blob stream accepts empty chunks after the final object', async () => {
    const chunks = [Buffer.from(`${SHA1} blob 0\n\n`), Buffer.alloc(0), Buffer.alloc(0)];
    const observed = await Array.fromAsync(parseGitBlobs(Readable.from(chunks), [SHA1]));
    expect(observed).toStrictEqual([[SHA1, Buffer.alloc(0)]]);
});

test('an unmerged index stage is refused before copying its tree', () => {
    expect(() => stripIndexStages(parseIndexFiles(`100644 ${SHA1} 1\tsource.ts\0`))).toThrow(INDEX_LINE_FAILURE);
});
