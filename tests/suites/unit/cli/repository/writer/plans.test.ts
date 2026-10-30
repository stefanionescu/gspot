import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/planning/session.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { GspotError } from '#cli/system/errors.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { planBlock, openWriter, writePlans, planRemovals } from '#cli/repository/writer.ts';

test('block updates and removal refuse a non-UTF-8 file with a file error and keep its bytes', async () => {
    await using sandbox = await testdir();
    const bytes = Buffer.from([0xff, 0xfe, 0x41, 0x00]);
    await writeFile(join(sandbox.path, 'AGENTS.md'), bytes);
    using writer = openWriter(sandbox.path);
    const failure = matchFields<GspotError>({
        name: 'GspotError',
        code: 'filesystem',
        message: 'AGENTS.md is not UTF-8 text. Save it as UTF-8, then run the command again.',
    });
    expect(() => planBlock(writer, 'AGENTS.md', 'instructions')).toThrow(failure);
    expect(() => planRemovals(writer, ['AGENTS.md'])).toThrow(failure);
    expect(await readFile(join(sandbox.path, 'AGENTS.md'))).toStrictEqual(bytes);
});

test('managed block updates and removal keep your text around the block', async () => {
    await using sandbox = await testdir();
    const previous = '# Authored\r\n\r\nKeep these trailing lines.\r\n\r\n';
    await createFileTree(sandbox.path, { 'AGENTS.md': previous });
    const prefix = 'Additional instructions.\n';
    const suffix = '\nLater authored instructions.\n';
    const firstWriter = openWriter(sandbox.path);
    writePlans(firstWriter, [planBlock(firstWriter, 'AGENTS.md', 'first instructions')]);
    const installed = firstWriter.read('AGENTS.md')!.bytes.toString('utf8');
    expect(installed).toBe(
        `${previous}\r\n<!-- >>> gspot managed >>> -->\r\n\r\nfirst instructions\r\n\r\n<!-- <<< gspot managed <<< -->\r\n`,
    );
    await writeFile(join(sandbox.path, 'AGENTS.md'), prefix + installed + suffix);
    writePlans(firstWriter, [planBlock(firstWriter, 'AGENTS.md', 'updated instructions')]);
    expect(firstWriter.read('AGENTS.md')!.bytes.toString('utf8')).toBe(
        `${prefix}${previous}\r\n<!-- >>> gspot managed >>> -->\n\nupdated instructions\n\n<!-- <<< gspot managed <<< -->\n${suffix}`,
    );
    firstWriter[Symbol.dispose]();
    using writer = openWriter(sandbox.path);
    writePlans(writer, planRemovals(writer, ['AGENTS.md']));
    expect(writer.read('AGENTS.md')!.bytes.toString('utf8')).toBe(prefix + previous + suffix);
});

test('removing the only block deletes the file', async () => {
    await using sandbox = await testdir({ 'AGENTS.md': '' });

    using writer = openWriter(sandbox.path);

    writePlans(writer, [planBlock(writer, 'AGENTS.md', 'instructions')]);
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
    const report = await writeGeneratedFiles(session, generateFiles(session), writer);
    expect(await readFile(join(sandbox.path, 'examples/.editorconfig'))).toStrictEqual(before);
    expect(report.removed).toContain('docs/.markdownlint.jsonc');
    expect(await isOnDisk(join(sandbox.path, 'docs/.markdownlint.jsonc'))).toBe(false);
});
