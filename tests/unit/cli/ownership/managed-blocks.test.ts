import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { GspotError } from '#cli/system/errors.ts';
import { planBlock, planRemoval } from '#cli/ownership/plans.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';
import { BLOCK_FORMATS, MALFORMED_BLOCKS } from '#tests/data/system.ts';
import { readBlock, replaceBlock, findBlockSpan } from '#cli/system/managed-blocks.ts';

test.each([...BLOCK_FORMATS, { path: '.gitattributes', style: 'hash' as const }])(
    'block updates and removal refuse non-UTF-8 $path with a file error and keep its bytes',
    async ({ path, style }) => {
        await using sandbox = await testdir();
        const bytes = Buffer.from([0xff, 0xfe, 0x41, 0x00]);
        await writeFile(join(sandbox.path, path), bytes);
        using writer = openWriter(sandbox.path);
        const failure = matchFields<GspotError>({
            name: 'GspotError',
            code: 'filesystem',
            message: `${path} is not UTF-8 text. Save it as UTF-8, then run the command again.`,
        });
        expect(() => planBlock(writer, path, 'instructions', style)).toThrow(failure);
        expect(() => planRemoval(writer, path)).toThrow(failure);
        expect(await readFile(join(sandbox.path, path))).toStrictEqual(bytes);
    },
);

describe('blocks', () => {
    test('managed block updates and removal keep your text around the block', async () => {
        await using folder = await testdir();
        const original = '# Authored\r\n\r\nKeep these trailing lines.\r\n\r\n';
        await createFileTree(folder.path, { 'AGENTS.md': original });
        const prefix = 'Additional instructions.\n';
        const suffix = '\nLater authored instructions.\n';
        {
            using log = openWriter(folder.path);
            writePlans(log, [planBlock(log, 'AGENTS.md', 'first instructions', 'markdown')]);
            const installed = log.files.read('AGENTS.md')!.bytes.toString('utf8');
            expect(installed.startsWith(original)).toBe(true);
            await writeFile(join(folder.path, 'AGENTS.md'), prefix + installed + suffix);
            writePlans(log, [planBlock(log, 'AGENTS.md', 'updated instructions', 'markdown')]);
            expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(
                prefix +
                    replaceBlock(original, 'updated instructions', { path: 'AGENTS.md', style: 'markdown' }) +
                    suffix,
            );
        }
        {
            using log = openWriter(folder.path);
            writePlans(log, [planRemoval(log, 'AGENTS.md')]);
            expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(prefix + original + suffix);
        }
    });

    test('removing the only block deletes the file', async () => {
        await using folder = await testdir();
        await createFileTree(folder.path, { 'AGENTS.md': '' });
        {
            using log = openWriter(folder.path);

            writePlans(log, [planBlock(log, 'AGENTS.md', 'instructions', 'markdown')]);
            writePlans(log, [planRemoval(log, 'AGENTS.md')]);
            expect(log.files.read('AGENTS.md')).toBeUndefined();
        }
    });
});
describe('managed-blocks', () => {
    test('a managed block is appended and replaced without changing your own text', () => {
        const first = replaceBlock('# Mine\n\ntext\n', 'block one', { path: 'AGENTS.md', style: 'markdown' });
        expect(first).toContain('# Mine');
        expect(readBlock(first, { path: 'AGENTS.md', style: 'markdown' })).toBe('block one');
        const second = replaceBlock(first, 'block two', { path: 'AGENTS.md', style: 'markdown' });
        expect(second.match(/gspot managed >>>/g)).toHaveLength(1);
        expect(readBlock(second, { path: 'AGENTS.md', style: 'markdown' })).toBe('block two');
        expect(second.startsWith('# Mine\n\ntext\n\n')).toBe(true);
        expect(replaceBlock(second, 'block two', { path: 'AGENTS.md', style: 'markdown' })).toBe(second);
    });

    test.each([...MALFORMED_BLOCKS])('every block operation refuses malformed markers in $path: $source', (context) => {
        const { source, path } = context;
        const message = `${path} has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.`;
        expect(() => findBlockSpan(source, context)).toThrow(message);
        expect(() => readBlock(source, context)).toThrow(message);
        expect(() => replaceBlock(source, 'replacement', context)).toThrow(message);
    });

    test.each(
        BLOCK_FORMATS.flatMap((context) =>
            (
                [
                    ['\n', 'LF'],
                    ['\r\n', 'CRLF'],
                ] as const
            ).map(([newline, name]) => ({ ...context, newline, name })),
        ),
    )('block readers keep your own text with $name line endings in $path', (context) => {
        expect(findBlockSpan('authored text', context)).toBeUndefined();
        expect(readBlock('authored text', context)).toBeUndefined();
        const { newline } = context;
        const source = `before${newline}${context.start}${newline}  instructions  ${newline}${context.end}${newline}after`;
        expect(readBlock(source, context)).toBe('instructions');
        const replaced = replaceBlock(source, 'replacement', context);
        expect(replaced.startsWith(`before${newline}`)).toBe(true);
        expect(replaced.endsWith('after')).toBe(true);
        expect(readBlock(replaced, context)).toBe('replacement');
    });
});
