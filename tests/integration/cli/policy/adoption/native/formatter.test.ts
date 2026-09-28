import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { collectKept } from '#cli/policy/adoption/collect.ts';
import { PRETTIER_TOOLING } from '#tests/support/cli/tooling.ts';
import { askInitQuestions } from '#cli/commands/init/questions.ts';

test('formatter choices use the captured observation and a fresh failed observation is retained', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.prettierrc.json': '{"semi":false,"tabWidth":8}\n' });
    const kept = await collectKept(sandbox.path, PRETTIER_TOOLING, new Set(['formatting']), ['source.js']);
    expect(kept.unread).toStrictEqual([]);
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
        PRETTIER_TOOLING,
        kept.formatter,
    );
    expect(answers.formatter?.format).toMatchObject({ indent_width: 8, semicolons: false });
    const refreshed = await collectKept(sandbox.path, PRETTIER_TOOLING, new Set(['formatting']), ['source.js']);
    expect(refreshed.unread.map((entry) => entry.path)).toStrictEqual(['.prettierrc.json']);
    expect(refreshed.removed).toStrictEqual([]);
});

test('replace refuses a configuration symlink and preserves its outside target', async () => {
    await using repository = await testdir();
    await using outside = await testdir();
    const original = '{"semi":false}\n';
    await createFileTree(outside.path, { 'authored.json': original });
    symlinkSync(join(outside.path, 'authored.json'), join(repository.path, '.prettierrc.json'));
    const kept = await collectKept(repository.path, PRETTIER_TOOLING, new Set(['formatting']), ['source.js']);
    expect(kept.removed).toStrictEqual([]);
    expect(kept.unread.map(({ path }) => path)).toStrictEqual(['.prettierrc.json']);
    expect(await Bun.file(join(outside.path, 'authored.json')).text()).toBe(original);
});
