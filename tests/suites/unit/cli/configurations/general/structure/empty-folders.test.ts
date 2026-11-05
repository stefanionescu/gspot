import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

test('a folder with no files reports once at its top, and through a folder that holds only empty folders', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'src/index.ts': 'export const index = 1;\n',
    });
    commitAll(sandbox.path);
    await mkdir(join(sandbox.path, 'empty'));
    await mkdir(join(sandbox.path, 'nested/inner/deep'), { recursive: true });
    await mkdir(join(sandbox.path, 'src/hole/deep'), { recursive: true });
    const findings = await runSandboxCheck(sandbox.path, 'structure/empty-folders');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
        ['empty', 'nested', 'src/hole'].map((file) => ({ file, rule: 'empty-folder' })),
    );
});

test('an ignored folder, and a folder that holds an ignored or untracked file, report nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        '.gitignore': 'cache/\n*.log\n',
        'logs/run.log': 'ignored\n',
        'drafts/note.txt': 'untracked\n',
    });
    await mkdir(join(sandbox.path, 'cache/empty'), { recursive: true });
    expect(await runSandboxCheck(sandbox.path, 'structure/empty-folders')).toStrictEqual([]);
});

test('a folder that only a placeholder file keeps in Git reports on that file, at its top folder', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'logs/.gitkeep': '',
        'tmp/inner/.keep': '',
        'src/index.ts': 'export const index = 1;\n',
        'src/.gitkeep': '',
    });
    commitAll(sandbox.path);
    const findings = await runSandboxCheck(sandbox.path, 'structure/empty-folders');
    expect(findings.map(({ file, message }) => ({ file, message }))).toStrictEqual([
        { file: 'logs/.gitkeep', message: 'The folder logs/ holds only .gitkeep.' },
        { file: 'tmp/inner/.keep', message: 'The folder tmp/ holds only .keep.' },
    ]);
});
