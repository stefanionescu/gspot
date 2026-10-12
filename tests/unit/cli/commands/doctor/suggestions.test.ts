import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { commitAll } from '#tests/setup/git.ts';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/apply.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { SERVER_FILES } from '#tests/config/eslint/framework.ts';
import { listSuggestions } from '#cli/commands/doctor/suggestions.ts';
import { STYLELINT_FILES, STYLELINT_SUGGESTIONS } from '#tests/config/stylelint.ts';
import { COMMITLINT_PACKAGE, COMMITLINT_PROJECT } from '#tests/config/commitlint.ts';

test('a folder without Git keeps authored commit settings and reports its actual prerequisite', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': COMMITLINT_PACKAGE,
        'gspot.toml': settingsText([], { level: 'all' }),
    });
    const session = await openSession(sandbox.path);
    expect(emitAll(session).fileEdits).toStrictEqual([]);
    expect(listSuggestions(session).unowned.filter((row) => row.note.includes('commitlint'))).toStrictEqual([
        { path: 'package.json', note: 'commitlint requires a Git repository', command: 'git init' },
    ]);
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(COMMITLINT_PACKAGE);
});

test('Next.js suggests CSS without translations for its explicit server files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...SERVER_FILES,
        'gspot.toml': `level = "all"
configurations = ["javascript"]
[[scope]]
path = "app"
configurations = ["nextjs"]
`,
    });
    const suggestions = listSuggestions(await openSession(sandbox.path)).suggested.map(
        ({ configuration }) => configuration,
    );
    expect(suggestions).toContain('css');
    expect(suggestions).not.toContain('translations');
});

test('doctor excludes managed commitlint fields and suggests level all for authored fields after they leave', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...COMMITLINT_PROJECT,
        'gspot.toml': settingsText([], {
            level: 'all',
            tables: `[[scope]]
path = "app"
[[scope]]
path = "app/child"
`,
        }),
    });
    commitAll(sandbox.path);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    expect(
        listSuggestions(await openSession(sandbox.path)).unowned.filter((row) => row.path.endsWith('package.json')),
    ).toStrictEqual([]);
    await Bun.write(join(sandbox.path, 'gspot.toml'), settingsText([], { level: 'recommended' }));
    const restored = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(restored.exitCode, restored.text).toBe(0);
    expect(
        listSuggestions(await openSession(sandbox.path))
            .unowned.filter((row) => row.note.includes('commitlint'))
            .map(({ path, command }) => ({ path, command })),
    ).toStrictEqual([
        { path: 'app/child/package.json', command: 'gspot set level all' },
        { path: 'app/package.json', command: 'gspot set level all' },
        { path: 'package.json', command: 'gspot set level all' },
    ]);
});

test('doctor suggests moving authored Stylelint fields while excluding managed fields', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...STYLELINT_FILES,
        'gspot.toml': settingsText(['css'], {
            level: 'all',
            tables: `[[scope]]
path = "app"
[[scope]]
path = "app/child"
[[scope]]
path = "other"
`,
        }),
    });
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode, applied.text).toBe(0);
    const suggestions = listSuggestions(await openSession(sandbox.path));
    expect(suggestions.unowned.filter((row) => ['package.json', 'app/package.json'].includes(row.path))).toStrictEqual(
        [],
    );
    expect(
        suggestions.unowned
            .filter((row) => row.note.includes('stylelint'))
            .map(({ path, command }) => ({ path, command })),
    ).toStrictEqual([...STYLELINT_SUGGESTIONS]);
});
