import { test, expect } from 'bun:test';
import { parseGitBlobs, parseTreeEntries, parseIndexEntries, parseIndexRevision } from '#cli/parsers/git.ts';
import { SHA1, SHA256, ENTRY_PATH, BINARY_BLOB, INVALID_BLOBS, INVALID_ENTRIES } from '#tests/config/git.ts';

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

for (const { name, output, message } of INVALID_ENTRIES)
    test(`a Git entry listing is refused: ${name}`, () => {
        const bytes =
            typeof output === 'string'
                ? Buffer.from(output)
                : Buffer.concat([Buffer.from(output.prefix), Buffer.from(output.bytes)]);
        if (name === 'unmerged index stage') {
            expect(() => parseIndexRevision(parseIndexEntries(bytes.toString('utf8')))).toThrow(message);
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
    expect(
        new Map(
            await Array.fromAsync(
                parseGitBlobs(
                    // eslint-disable-next-line @typescript-eslint/require-await -- reason: The Git reader takes an async stream; this test supplies fixed byte chunks.
                    (async function* () {
                        for (const chunk of [output]) yield chunk;
                    })(),
                    [SHA1, SHA256],
                ),
            ),
        ),
    ).toStrictEqual(
        new Map([
            [SHA1, Buffer.from(BINARY_BLOB)],
            [SHA256, Buffer.alloc(0)],
        ]),
    );
    expect(
        new Map(
            await Array.fromAsync(
                parseGitBlobs(
                    // eslint-disable-next-line @typescript-eslint/require-await -- reason: The Git reader takes an async stream; this test supplies fixed byte chunks.
                    (async function* () {
                        for (const chunk of [Buffer.alloc(0)]) yield chunk;
                    })(),
                    [],
                ),
            ),
        ),
    ).toStrictEqual(new Map());
});

for (const { name, output, message } of INVALID_BLOBS)
    test(`a batch is refused: ${name}`, () => {
        expect(
            Array.fromAsync(
                parseGitBlobs(
                    // eslint-disable-next-line @typescript-eslint/require-await -- reason: The Git reader takes an async stream; this test supplies fixed byte chunks.
                    (async function* () {
                        for (const chunk of [Buffer.from(output)]) yield chunk;
                    })(),
                    [SHA1],
                ),
            ),
        ).rejects.toThrow(new RegExp(message));
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
        expect(
            new Map(
                await Array.fromAsync(
                    parseGitBlobs(
                        // eslint-disable-next-line @typescript-eslint/require-await -- reason: The Git reader takes an async stream; this test supplies fixed byte chunks.
                        (async function* () {
                            for (const chunk of chunks) yield chunk;
                        })(),
                        [SHA1, SHA256],
                    ),
                ),
            ),
        ).toStrictEqual(
            new Map([
                [SHA1, Buffer.from([0, 255, 0, 10])],
                [SHA256, Buffer.alloc(0)],
            ]),
        );
    }
});
