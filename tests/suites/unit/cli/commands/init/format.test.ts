import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { parse } from '@decimalturn/toml-patch';
import { getTable } from '#cli/settings/scopes.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { runGspot, buildInitArguments } from '#tests/setup/cli/commands.ts';
import { type TomlTable, type FormatSettings } from '#cli/types/settings/file.ts';

import {
    FORMAT_FILE_CASES,
    SCOPE_FORMAT_FILES,
    FORMAT_WORKSPACE_FILES,
    PRETTIER_FORMAT_OPTIONS,
    INVALID_PRETTIER_OPTIONS,
} from '#tests/config/commands/init/format.ts';

test.each(INVALID_PRETTIER_OPTIONS)(
    'init names $file and $field for an invalid option type',
    async ({ file, field, text }) => {
        await using sandbox = await testdir({
            ...FORMAT_WORKSPACE_FILES,
            'source.js': 'export const value = 1;\n',
            'app/source.js': 'export const value = 2;\n',
            [file]: text,
        });
        commitAll(sandbox.path);
        const result = await runGspot(sandbox.path, [...buildInitArguments(['format']), '--dry-run']);
        expect(result.code).toBe(2);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe(
            `${file}: ${field}: Invalid input: expected number, received string. Fix the field.\n`,
        );
        expect(await readFile(`${sandbox.path}/${file}`, 'utf8')).toBe(text);
    },
);

async function readInitFormatOptions(root: string, commandArguments: string[]): Promise<FormatSettings[]> {
    const result = await runGspot(root, [...commandArguments, '--dry-run', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const text = (JSON.parse(result.stdout) as InitJson).settings;
    const session = await openSession(root, { settingsFile: { settings: parseSettings(text, root), text } });
    return session.scopes.map(({ settings }) => getTable(settings, 'format'));
}

test.each([...FORMAT_FILE_CASES])('init reads the format settings from $name', async ({ files, expected }) => {
    await using sandbox = await testdir({ 'source.txt': 'source\n', ...files });
    commitAll(sandbox.path);
    const options = await readInitFormatOptions(sandbox.path, buildInitArguments(['format']));
    expect(options[0]).toMatchObject(expected);
    for (const [path, source] of Object.entries(files))
        expect(await readFile(`${sandbox.path}/${path}`, 'utf8')).toBe(source);
    expect(await isOnDisk(`${sandbox.path}/gspot.toml`)).toBe(false);
});

test('init reads the format settings of each scope', async () => {
    await using sandbox = await testdir(SCOPE_FORMAT_FILES);
    await createFileTree(sandbox.path, FORMAT_WORKSPACE_FILES);
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, [...buildInitArguments(['format']), '--dry-run', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const text = (JSON.parse(result.stdout) as InitJson).settings;
    const session = await openSession(sandbox.path, {
        settingsFile: { settings: parseSettings(text, sandbox.path), text },
    });
    expect(
        session.scopes.map(({ folder, settings }) => {
            const { indent_width, print_width, quotes } = getTable(settings, 'format');
            return [folder.path, indent_width, print_width, quotes];
        }),
    ).toStrictEqual([
        ['', 2, 90, 'double'],
        ['app', 6, 100, 'single'],
        ['app/deep', 6, 100, 'single'],
        ['sibling', 2, 90, 'double'],
    ]);
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
    commitAll(sandbox.path);
    const options = await readInitFormatOptions(sandbox.path, buildInitArguments(['format']));
    expect(options[0]).toMatchObject(PRETTIER_FORMAT_OPTIONS);
});

test.each(['prettier.config.mjs', '.prettierrc.cjs'])(
    'init names the format settings it cannot read from %s',
    async (path) => {
        await using sandbox = await testdir({
            [path]: 'export default { printWidth: 100 };\n',
            'source.js': 'export const count = 1;\n',
        });
        commitAll(sandbox.path);
        const result = await runGspot(sandbox.path, [...buildInitArguments(['format']), '--dry-run', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const { plan, settings } = JSON.parse(result.stdout) as InitJson;
        expect([...plan.delete, ...plan.write].find((file) => file.path === path)?.note).toContain(
            'gspot cannot read a JavaScript Prettier config, so set format.indent_width and format.print_width by hand',
        );
        expect(parse(settings) as TomlTable).not.toHaveProperty('format');
    },
);

test('init preserves tabs, semicolons and trailing commas from Prettier', async () => {
    await using sandbox = await testdir({
        '.prettierrc.json': '{"useTabs":true,"semi":false,"trailingComma":"none"}',
        'source.ts': 'export {};\n',
    });
    commitAll(sandbox.path);
    const formats = await readInitFormatOptions(sandbox.path, buildInitArguments(['format']));
    expect(formats[0]).toMatchObject({
        indent_style: 'tab',
        semicolons: false,
        trailing_commas: 'none',
    });
});
