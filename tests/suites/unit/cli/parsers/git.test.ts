import { Readable } from 'node:stream';
import { test, expect } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';

import {
    parseGitBlobs,
    decodeGitPaths,
    parseTreeFiles,
    mergeAttributes,
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

test.each([...INVALID_BLOBS])(`a batch is refused: $name`, async ({ output }) => {
    const stream = parseGitBlobs(Readable.from([Buffer.from(output)]), [SHA1]);
    const parsed = Array.fromAsync(stream);
    const streamError = await captureRejection(parsed);
    expect(streamError.message).toBe(BLOB_FAILURE);
});

test('a batch parses the same for every split between header, body and delimiters', async () => {
    expect(await Array.fromAsync(parseGitBlobs(Readable.from([Buffer.alloc(0)]), []))).toStrictEqual([]);
    const output = Buffer.concat([
        Buffer.from(`${SHA1} blob ${String(BINARY_BLOB.length)}\n`),
        Buffer.from(BINARY_BLOB),
        Buffer.from(`\n${SHA256} blob 0\n\n`),
    ]);
    for (let split = 0; split <= output.length; split += 1) {
        const chunks = [output.subarray(0, split), output.subarray(split)];
        const blobs = await Array.fromAsync(parseGitBlobs(Readable.from(chunks), [SHA1, SHA256]));
        const parsed = new Map(blobs);
        expect(parsed).toStrictEqual(
            new Map([
                [SHA1, Buffer.from(BINARY_BLOB)],
                [SHA256, Buffer.alloc(0)],
            ]),
        );
    }
});

test.each([...TRAILING_BLOB_CHUNKS])('a Git blob stream refuses trailing bytes in the $name', async ({ chunks }) => {
    const stream = parseGitBlobs(Readable.from(chunks.map((chunk) => Buffer.from(chunk))), [SHA1]);
    const parsed = Array.fromAsync(stream);
    const error = await captureRejection(parsed);
    expect(error.message).toBe(BLOB_FAILURE);
});

test('a Git blob stream accepts empty chunks after the final object', async () => {
    const chunks = [Buffer.from(`${SHA1} blob 0\n\n`), Buffer.alloc(0), Buffer.alloc(0)];
    const parsed = await Array.fromAsync(parseGitBlobs(Readable.from(chunks), [SHA1]));
    expect(parsed).toStrictEqual([[SHA1, Buffer.alloc(0)]]);
});

test('Git path decoding keeps readable entries and reports only invalid names', () => {
    const unreadable: string[] = [];
    const listing = decodeGitPaths(Buffer.from('good.ts\0bad\u00FF.ts\0other.ts\0', 'latin1'), unreadable);
    expect(listing.split('\0')).toStrictEqual(['good.ts', 'other.ts']);
    expect(unreadable).toStrictEqual([String.raw`"bad\377.ts"`]);
});

test('Git attributes apply unset and unspecified changes in order', () => {
    expect(mergeAttributes(['text', '-diff', 'eol=lf', '!text'])).toStrictEqual({ diff: 'unset', eol: 'lf' });
});
