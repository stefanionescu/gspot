import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { GspotError } from '#cli/system/errors.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { NON_UTF8_BLOCK_CASES } from '#tests/config/write.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { commitAll, createGitSandbox } from '#tests/setup/system/git.ts';
import { planBlock, openWriter, writePlans, planRemovals } from '#cli/write.ts';

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
        expect(() => planRemovals(writer, [path])).toThrow(failure);
        expect(await readFile(join(sandbox.path, path))).toStrictEqual(bytes);
    },
);

test('managed block updates and removal keep your text around the block', async () => {
    await using sandbox = await testdir();
    const previous = '# Authored\r\n\r\nKeep these trailing lines.\r\n\r\n';
    await createFileTree(sandbox.path, { 'AGENTS.md': previous });
    const prefix = 'Additional instructions.\n';
    const suffix = '\nLater authored instructions.\n';
    const firstWriter = openWriter(sandbox.path);
    writePlans(firstWriter, [planBlock(firstWriter, 'AGENTS.md', 'first instructions', 'markdown')]);
    const installed = firstWriter.read('AGENTS.md')!.bytes.toString('utf8');
    expect(installed).toBe(
        `${previous}\n<!-- >>> gspot managed >>> -->\n\nfirst instructions\n\n<!-- <<< gspot managed <<< -->\n`,
    );
    await writeFile(join(sandbox.path, 'AGENTS.md'), prefix + installed + suffix);
    writePlans(firstWriter, [planBlock(firstWriter, 'AGENTS.md', 'updated instructions', 'markdown')]);
    expect(firstWriter.read('AGENTS.md')!.bytes.toString('utf8')).toBe(
        `${prefix}${previous}\n<!-- >>> gspot managed >>> -->\n\nupdated instructions\n\n<!-- <<< gspot managed <<< -->\n${suffix}`,
    );
    firstWriter[Symbol.dispose]();
    using writer = openWriter(sandbox.path);
    writePlans(writer, planRemovals(writer, ['AGENTS.md']));
    expect(writer.read('AGENTS.md')!.bytes.toString('utf8')).toBe(prefix + previous + suffix);
});

test('removing the only block deletes the file', async () => {
    await using sandbox = await testdir({ 'AGENTS.md': '' });

    using writer = openWriter(sandbox.path);

    writePlans(writer, [planBlock(writer, 'AGENTS.md', 'instructions', 'markdown')]);
    writePlans(writer, planRemovals(writer, ['AGENTS.md']));
    expect(writer.read('AGENTS.md')).toBeUndefined();
});

test('apply preserves a copied header example and removes an obsolete scoped pointer', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { scopes: [{ path: 'docs', configurations: [] }] }),
        'examples/.editorconfig': `${formatHeader('.editorconfig')}root = true\n`,
        'docs/.markdownlint.jsonc': `${formatHeader('.markdownlint.jsonc')}{"extends":"../.markdownlint.jsonc"}\n`,
        'README.md': '# Root\n',
        'docs/README.md': '# Docs\n',
    });
    commitAll(sandbox.path);
    const before = await readFile(join(sandbox.path, 'examples/.editorconfig'));
    const session = await openSession(sandbox.path);
    using writer = openWriter(sandbox.path);
    const report = await writeGeneratedFiles(session, generate(session), writer);
    expect(await readFile(join(sandbox.path, 'examples/.editorconfig'))).toStrictEqual(before);
    expect(report.removed).toContain('docs/.markdownlint.jsonc');
    expect(await isOnDisk(join(sandbox.path, 'docs/.markdownlint.jsonc'))).toBe(false);
});
