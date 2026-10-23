import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { GspotError } from '#cli/system/errors.ts';
import { openWriter, writePlans } from '#cli/apply/writer.ts';
import { planBlock, planRemoval } from '#cli/apply/write-plans.ts';
import { NON_UTF8_BLOCK_CASES } from '#tests/config/apply/write-plans.ts';

test.each([...NON_UTF8_BLOCK_CASES])(
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

test('managed block updates and removal keep your text around the block', async () => {
    await using sandbox = await testdir();
    const original = '# Authored\r\n\r\nKeep these trailing lines.\r\n\r\n';
    await createFileTree(sandbox.path, { 'AGENTS.md': original });
    const prefix = 'Additional instructions.\n';
    const suffix = '\nLater authored instructions.\n';
    const firstWriter = openWriter(sandbox.path);
    writePlans(firstWriter, [planBlock(firstWriter, 'AGENTS.md', 'first instructions', 'markdown')]);
    const installed = firstWriter.files.read('AGENTS.md')!.bytes.toString('utf8');
    expect(installed).toBe(
        `${original}\n<!-- >>> gspot managed >>> -->\n\nfirst instructions\n\n<!-- <<< gspot managed <<< -->\n`,
    );
    await writeFile(join(sandbox.path, 'AGENTS.md'), prefix + installed + suffix);
    writePlans(firstWriter, [planBlock(firstWriter, 'AGENTS.md', 'updated instructions', 'markdown')]);
    expect(firstWriter.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(
        `${prefix}${original}\n<!-- >>> gspot managed >>> -->\n\nupdated instructions\n\n<!-- <<< gspot managed <<< -->\n${suffix}`,
    );
    firstWriter[Symbol.dispose]();
    using writer = openWriter(sandbox.path);
    writePlans(writer, [planRemoval(writer, 'AGENTS.md')]);
    expect(writer.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(prefix + original + suffix);
});

test('removing the only block deletes the file', async () => {
    await using sandbox = await testdir({ 'AGENTS.md': '' });

    using writer = openWriter(sandbox.path);

    writePlans(writer, [planBlock(writer, 'AGENTS.md', 'instructions', 'markdown')]);
    writePlans(writer, [planRemoval(writer, 'AGENTS.md')]);
    expect(writer.files.read('AGENTS.md')).toBeUndefined();
});
