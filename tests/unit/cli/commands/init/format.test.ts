import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { FORMAT_FILE_CASES, SCOPE_FORMAT_CASES, SCOPE_FORMAT_FILES } from '#tests/data/commands/init.ts';

async function prepareFormatPreview(root: string) {
    const result = await runGspot(root, [...buildInitArguments(['format']), '--dry-run', '--json']);
    const text = (JSON.parse(result.stdout) as InitJson).settings;
    const session = await openSession(root, {
        settingsFile: { settings: parseSettings(text, undefined), text },
    });
    return { result, session };
}

test.each([...FORMAT_FILE_CASES])('init reads the format settings from $name', async ({ files, expected }) => {
    await using sandbox = await testdir(files);
    const { result, session } = await prepareFormatPreview(sandbox.path);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(getTable(session.scopes[0]!.view, 'format')).toMatchObject(expected);
    for (const [path, source] of Object.entries(files))
        expect(await readFile(`${sandbox.path}/${path}`, 'utf8')).toBe(source);
    expect(await isOnDisk(`${sandbox.path}/gspot.toml`)).toBe(false);
});

test.each([...SCOPE_FORMAT_CASES])('init reads the format settings of each scope with $name', async ({ expected }) => {
    await using sandbox = await testdir(SCOPE_FORMAT_FILES);
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true,"workspaces":["app","app/deep","sibling"]}',
        'app/package.json': '{"private":true}',
        'app/deep/package.json': '{"private":true}',
        'sibling/package.json': '{"private":true}',
    });
    const { result, session } = await prepareFormatPreview(sandbox.path);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(
        session.scopes.map((selection) => [
            selection.scope.path,
            getTable(selection.view, 'format').indent_width,
            getTable(selection.view, 'format').print_width,
            getTable(selection.view, 'format').quotes,
        ]),
    ).toEqual(expected.map((row) => [...row]));
    for (const [path, source] of Object.entries(SCOPE_FORMAT_FILES))
        expect(await readFile(`${sandbox.path}/${path}`, 'utf8')).toBe(source);
});

test('init turns Prettier overrides and the Ruff quote style into format overrides', async () => {
    await using sandbox = await testdir({
        '.prettierrc.json': JSON.stringify({
            tabWidth: 4,
            printWidth: 120,
            overrides: [{ files: ['*.ts', 'src/**/*.css'], options: { tabWidth: 2, printWidth: 100 } }],
        }),
        'ruff.toml': '[format]\nquote-style = "single"\n',
        'main.py': 'value = 1\n',
        'package.json': '{"private":true,"devDependencies":{"prettier":"3.8.1"}}',
    });
    const result = await runGspot(sandbox.path, [...buildInitArguments(['format']), '--dry-run', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const text = (JSON.parse(result.stdout) as InitJson).settings;
    const settings = parseSettings(text, undefined);
    expect(settings.written).toMatchObject({
        format: {
            quotes: 'double',
            override: [
                { paths: ['**/*.ts', 'src/**/*.css'], indent_width: 2, print_width: 100 },
                { paths: ['**/*.py'], quotes: 'single' },
            ],
        },
    });
});
