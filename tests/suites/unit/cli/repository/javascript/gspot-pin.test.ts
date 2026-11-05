import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import cliPackage from '#cli-package' with { type: 'json' };
import { readGspotPin, writeGspotPin } from '#cli/repository/javascript/gspot-pin.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('the pin of a repository with package.json is an exact development dependency', async () => {
    await using sandbox = await createGitSandbox({ 'package.json': '{\n  "name": "example"\n}\n' });
    writeGspotPin(openFiles(sandbox.path));
    const manifest = JSON.parse(await readFile(join(sandbox.path, 'package.json'), 'utf8')) as Record<string, unknown>;
    expect(manifest['devDependencies']).toStrictEqual({ [cliPackage.name]: cliPackage.version });
    expect(readGspotPin(sandbox.path)).toBe(cliPackage.version);
});

test('the pin keeps the indentation of package.json', async () => {
    await using sandbox = await createGitSandbox({ 'package.json': '{\n    "name": "example"\n}\n' });
    writeGspotPin(openFiles(sandbox.path));
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(
        `{\n    "name": "example",\n    "devDependencies": {\n        "${cliPackage.name}": "${cliPackage.version}"\n    }\n}\n`,
    );
});

test('the pin of a repository with neither file writes a mise.toml that pins Node.js, with a final newline', async () => {
    await using sandbox = await createGitSandbox({});
    writeGspotPin(openFiles(sandbox.path));
    expect(await readFile(join(sandbox.path, 'mise.toml'), 'utf8')).toBe(
        `[tools]\nnode = "24"\n"npm:${cliPackage.name}" = { version = "${cliPackage.version}", allow_low_downloads = "true" }\n`,
    );
});

test('a mise.toml whose tools field is not a table refuses the pin and names the file', async () => {
    await using sandbox = await createGitSandbox({ 'mise.toml': 'tools = "node"\n' });
    const error = await captureRejection(
        Promise.try(() => {
            writeGspotPin(openFiles(sandbox.path));
        }),
    );
    expect(error).toBeInstanceOf(GspotError);
    expect(error.message).toContain('mise.toml');
    expect(await readFile(join(sandbox.path, 'mise.toml'), 'utf8')).toBe('tools = "node"\n');
});

test('the pin of a repository without package.json is a mise tool beside the others', async () => {
    await using sandbox = await createGitSandbox({ 'mise.toml': '[tools]\nnode = "24.0.0"\n' });
    writeGspotPin(openFiles(sandbox.path));
    const text = await readFile(join(sandbox.path, 'mise.toml'), 'utf8');
    expect(text.match(/^node = /gmu)).toStrictEqual(['node = ']);
    expect(text).toContain('node = "24.0.0"');
    expect(readGspotPin(sandbox.path)).toBe(cliPackage.version);
});

test.each([
    { commandArguments: ['add', 'bash'] },
    { commandArguments: ['remove', 'bash', '--reason', 'The repository has no shell scripts.'] },
    { commandArguments: ['set', 'level', 'all'] },
    { commandArguments: ['unset', 'level'] },
    { commandArguments: ['ignore', '--paths', 'README.md', '--reason', 'The readme is written by hand.'] },
    { commandArguments: ['unignore', '--paths', 'README.md'] },
    { commandArguments: ['install'] },
    { commandArguments: ['check'] },
])('another pinned version stops gspot $commandArguments.0, and names the install', async ({ commandArguments }) => {
    const settings = buildSandboxSettings([]);
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'mise.toml': '[tools]\n"npm:@gspothq/cli" = "0.0.1"\n',
        'README.md': '# Example\n',
    });
    const result = await runGspot(sandbox.path, [...commandArguments, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    const failure = JSON.parse(result.stdout) as { error: string; message: string };
    expect(failure.error).toBe('arguments');
    expect(failure.message).toContain('npm:@gspothq/cli@0.0.1');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test('the pin keeps a sorted devDependencies block sorted, and goes last in an unsorted one', async () => {
    await using sorted = await createGitSandbox({
        'package.json': '{\n  "devDependencies": {\n    "@a/first": "1.0.0",\n    "zod": "1.0.0"\n  }\n}\n',
    });
    writeGspotPin(openFiles(sorted.path));
    const { devDependencies: inOrder } = JSON.parse(await readFile(join(sorted.path, 'package.json'), 'utf8')) as {
        devDependencies: Record<string, string>;
    };
    expect(Object.keys(inOrder)).toStrictEqual(['@a/first', '@gspothq/cli', 'zod']);
    await using unsorted = await createGitSandbox({
        'package.json': '{\n  "devDependencies": {\n    "zod": "1.0.0",\n    "@a/first": "1.0.0"\n  }\n}\n',
    });
    writeGspotPin(openFiles(unsorted.path));
    const { devDependencies: outOfOrder } = JSON.parse(await readFile(join(unsorted.path, 'package.json'), 'utf8')) as {
        devDependencies: Record<string, string>;
    };
    expect(Object.keys(outOfOrder)).toStrictEqual(['zod', '@a/first', '@gspothq/cli']);
});
