import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import cliPackage from '#cli-package' with { type: 'json' };
import { readGspotPin, writeGspotPin } from '#cli/repository/javascript/gspot-pin.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('the pin of a repository with package.json is an exact development dependency', async () => {
    await using sandbox = await createGitSandbox({ 'package.json': '{\n  "name": "example"\n}\n' });
    writeGspotPin(openFiles(sandbox.path));
    expect(readGspotPin(sandbox.path)).toBe(cliPackage.version);
});

test('the pin keeps the indentation of package.json', async () => {
    await using sandbox = await createGitSandbox({ 'package.json': '{\n    "name": "example"\n}\n' });
    writeGspotPin(openFiles(sandbox.path));
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(
        `{\n    "name": "example",\n    "devDependencies": {\n        "${cliPackage.name}": "${cliPackage.version}"\n    }\n}\n`,
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
