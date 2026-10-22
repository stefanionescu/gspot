import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { type FormatSettings } from '#cli/types/settings/file.ts';
import { runGspot, buildInitArguments } from '#tests/setup/cli/commands.ts';

import {
    FORMAT_FILE_CASES,
    SCOPE_FORMAT_CASES,
    SCOPE_FORMAT_FILES,
    FORMAT_WORKSPACE_FILES,
    PRETTIER_FORMAT_OPTIONS,
} from '#tests/config/commands/init/format.ts';

/** Read the proposed format settings in scope order through the init command. */
async function readInitFormatOptions(root: string, commandArguments: string[]): Promise<FormatSettings[]> {
    const result = await runGspot(root, [...commandArguments, '--dry-run', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const text = (JSON.parse(result.stdout) as InitJson).settings;
    const session = await openSession(root, { settingsFile: { settings: parseSettings(text, undefined), text } });
    return session.scopes.map(({ settings }) => getTable(settings, 'format'));
}

test.each([...FORMAT_FILE_CASES])('init reads the format settings from $name', async ({ files, expected }) => {
    await using sandbox = await testdir(files);
    const options = await readInitFormatOptions(sandbox.path, buildInitArguments(['format']));
    expect(options[0]).toMatchObject(expected);
    for (const [path, source] of Object.entries(files))
        expect(await readFile(`${sandbox.path}/${path}`, 'utf8')).toBe(source);
    expect(await isOnDisk(`${sandbox.path}/gspot.toml`)).toBe(false);
});

test.each([...SCOPE_FORMAT_CASES])('init reads the format settings of each scope with $name', async ({ expected }) => {
    await using sandbox = await testdir(SCOPE_FORMAT_FILES);
    await createFileTree(sandbox.path, FORMAT_WORKSPACE_FILES);
    const options = await readInitFormatOptions(sandbox.path, buildInitArguments(['format']));
    expect(options.map(({ indent_width, print_width, quotes }) => [indent_width, print_width, quotes])).toStrictEqual(
        expected.map(([, ...options]) => options),
    );
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
    const options = await readInitFormatOptions(sandbox.path, buildInitArguments(['format']));
    expect(options[0]).toMatchObject(PRETTIER_FORMAT_OPTIONS);
});
