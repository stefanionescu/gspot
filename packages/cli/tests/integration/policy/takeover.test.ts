import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import type { ExistingTooling } from '#cli/repository/types.ts';
import { collectCarried } from '#cli/lifecycle/takeover.ts';
import { askInitQuestions } from '#cli/lifecycle/questions.ts';

const tooling: ExistingTooling = {
    configs: [{ tool: 'prettier', path: '.prettierrc.json' }],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};

test('formatter choices use the captured observation and a fresh failed observation is retained', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.prettierrc.json': '{"semi":false,"tabWidth":8}\n' });
    const carried = await collectCarried(sandbox.path, tooling, new Set(['formatting']), ['source.js']);
    expect(carried.unread).toEqual([]);
    await Bun.write(join(sandbox.path, '.prettierrc.json'), 'invalid JSON');
    const answers = await askInitQuestions(
        sandbox.path,
        {
            cwd: sandbox.path,
            yes: true,
            isDryRun: true,
            json: false,
            install: false,
            allowDirty: false,
            hooks: 'none',
            ci: 'none',
            runner: 'none',
            rules: 'no',
            format: 'keep',
        },
        tooling,
        carried.formatter,
    );
    expect(answers.formatter?.format).toMatchObject({ indent_width: 8, semicolons: false });
    const refreshed = await collectCarried(sandbox.path, tooling, new Set(['formatting']), ['source.js']);
    expect(refreshed.unread.map((entry) => entry.path)).toEqual(['.prettierrc.json']);
    expect(refreshed.removed).toEqual([]);
});

test('takeover refuses a configuration symlink and preserves its outside target', async () => {
    await using repository = await testdir();
    await using outside = await testdir();
    const original = '{"semi":false}\n';
    await createFileTree(outside.path, { 'authored.json': original });
    symlinkSync(join(outside.path, 'authored.json'), join(repository.path, '.prettierrc.json'));
    const carried = await collectCarried(repository.path, tooling, new Set(['formatting']), ['source.js']);
    expect(carried.removed).toEqual([]);
    expect(carried.unread.map(({ path }) => path)).toEqual(['.prettierrc.json']);
    expect(await Bun.file(join(outside.path, 'authored.json')).text()).toBe(original);
});
