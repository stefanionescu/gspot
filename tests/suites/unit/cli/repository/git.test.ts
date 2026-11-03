import { join } from 'node:path';
import { testdir } from 'testdirs';
import { existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { test, expect } from 'bun:test';
import { copyFile, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { readGitText, readGitLines } from '#cli/repository/git/run.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { parseGitBlobs, parseTreeFiles, mergeAttributes, parseAttributePatterns } from '#cli/repository/git/output.ts';

import {
    SHA1,
    SHA256,
    INDEX_PATH,
    BINARY_BLOB,
    BLOB_FAILURE,
    INVALID_BLOBS,
    ATTRIBUTE_LINES,
    TRAILING_BLOB_CHUNKS,
} from '#tests/config/repository/files.ts';

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
    expect(parseTreeFiles(Buffer.from(output), [])).toStrictEqual([
        { mode: '100644', hash: SHA1, path: INDEX_PATH },
        { mode: '100755', hash: SHA256, path: 'executable' },
        { mode: '120000', hash: SHA1, path: 'link' },
        { mode: '160000', hash: SHA256, path: 'submodule' },
    ]);
    expect(parseTreeFiles(Buffer.alloc(0), [])).toStrictEqual([]);
});

test.each([...INVALID_BLOBS])(`a batch is refused: $name`, async ({ output }) => {
    const stream = parseGitBlobs(Readable.from([Buffer.from(output)]), [SHA1]);
    const parsed = Array.fromAsync(stream);
    const streamError = await captureRejection(parsed);
    expect(streamError.message).toBe(BLOB_FAILURE);
});

test('a batch parses the same for every split between header, body and delimiters', async () => {
    const empty = Readable.from([Buffer.alloc(0)]);
    expect(await Array.fromAsync(parseGitBlobs(empty, []))).toStrictEqual([]);
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

test('Git attributes apply unset and unspecified changes in order', () => {
    expect(mergeAttributes(['text', '-diff', 'eol=lf', '!text'])).toStrictEqual({ diff: 'unset', eol: 'lf' });
});

test('in a hook, Git reads the hook index in its repository, a check copy and a repository outside read their own, and init makes a new one', async () => {
    await using sandbox = await testdir({ '.gitignore': '.gspot-copies/\ncreated/\n', 'source.txt': 'committed\n' });
    await using outside = await testdir({ 'outer.txt': 'outer\n' });
    await writeFile(join(sandbox.path, 'nested.txt'), 'outside the check copy\n');
    const copy = join(sandbox.path, '.gspot-copies', 'copy');
    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['init', '-q', copy]);
    await writeFile(join(copy, 'inner.txt'), 'inner\n');
    commitAll(copy);
    commitAll(outside.path);
    const index = join(sandbox.path, '.git', 'hook-index');
    await copyFile(join(sandbox.path, '.git', 'index'), index);
    await writeFile(join(sandbox.path, 'staged.txt'), 'staged\n');
    runGitStep(sandbox.path, ['add', 'staged.txt'], { GIT_INDEX_FILE: index });
    const previous = process.cwd();
    process.chdir(sandbox.path);
    try {
        using _hook = overrideEnvironment({
            GIT_DIR: join(sandbox.path, '.git'),
            GIT_WORK_TREE: sandbox.path,
            GIT_INDEX_FILE: index,
        });
        expect(await readGitLines(sandbox.path, ['ls-files'], {})).toStrictEqual([
            '.gitignore',
            'nested.txt',
            'source.txt',
            'staged.txt',
        ]);
        expect(await readGitLines(copy, ['ls-files'], {})).toStrictEqual(['inner.txt']);
        expect(await readGitLines(outside.path, ['ls-files'], {})).toStrictEqual(['outer.txt']);
        const standard = join(sandbox.path, '.git', 'index');
        expect(await readGitLines(sandbox.path, ['ls-files'], { env: { GIT_INDEX_FILE: standard } })).toStrictEqual([
            '.gitignore',
            'nested.txt',
            'source.txt',
        ]);
        const created = join(sandbox.path, 'created');
        await readGitText(sandbox.path, ['init', '--quiet', created], {});
        expect(existsSync(join(created, '.git', 'HEAD'))).toBe(true);
    } finally {
        process.chdir(previous);
    }
});
