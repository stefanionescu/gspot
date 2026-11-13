import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import cliPackage from '#cli-package' with { type: 'json' };
import { GSPOT_MISE_TOOL, NODE_TOOL } from '#cli/config/repository/version-pin.ts';
import { findGspotPinMismatch, readGspotPin, writeMisePin, writePackagePin } from '#cli/repository/projects/pin.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('the pin keeps the indentation of package.json', async () => {
    await using sandbox = await createGitSandbox({ 'package.json': '{\n    "name": "example"\n}\n' });
    writePackagePin(openFiles(sandbox.path));
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(
        `{\n    "name": "example",\n    "devDependencies": {\n        "${cliPackage.name}": "${cliPackage.version}"\n    }\n}\n`,
    );
});

test('a mise.toml whose tools field is not a table refuses the pin and names the file', async () => {
    await using sandbox = await createGitSandbox({ 'mise.toml': 'tools = "node"\n' });
    const error = await captureRejection(
        Promise.try(() => {
            writeMisePin(openFiles(sandbox.path));
        }),
    );
    expect(error).toBeInstanceOf(GspotError);
    expect(error.message).toContain('mise.toml');
    expect(await readFile(join(sandbox.path, 'mise.toml'), 'utf8')).toBe('tools = "node"\n');
});

test('the mise pin is a tool beside the others and keeps their Node.js pin', async () => {
    await using sandbox = await createGitSandbox({ 'mise.toml': '[tools]\nnode = "24.0.0"\n' });
    writeMisePin(openFiles(sandbox.path));
    const text = await readFile(join(sandbox.path, 'mise.toml'), 'utf8');
    expect(text.match(/^node = /gmu)).toStrictEqual(['node = ']);
    expect(text).toContain('node = "24.0.0"');
    expect(readGspotPin(sandbox.path)).toBe(cliPackage.version);
});

test('the mise pin adds Node.js when mise.toml has none', async () => {
    await using sandbox = await createGitSandbox({ 'mise.toml': '' });
    writeMisePin(openFiles(sandbox.path));
    const { tools } = parse(await readFile(join(sandbox.path, 'mise.toml'), 'utf8')) as {
        tools: Record<string, unknown>;
    };
    expect(Object.keys(tools)).toStrictEqual([NODE_TOOL, GSPOT_MISE_TOOL]);
    expect(readGspotPin(sandbox.path)).toBe(cliPackage.version);
});

test('the gspot pin is the locked version of a range, and a range without a lockfile is no pin', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': `{"devDependencies": {"${cliPackage.name}": "^0.0.1"}}\n`,
    });
    expect(readGspotPin(sandbox.path)).toBeUndefined();
    await writeFile(
        join(sandbox.path, 'package-lock.json'),
        JSON.stringify({
            packages: {
                '': { devDependencies: { [cliPackage.name]: '^0.0.1' } },
                [`node_modules/${cliPackage.name}`]: { version: '0.0.2' },
            },
        }),
    );
    expect(readGspotPin(sandbox.path)).toBe('0.0.2');
});

test('the pin keeps a sorted devDependencies block sorted, and goes last in an unsorted one', async () => {
    await using sorted = await createGitSandbox({
        'package.json': '{\n  "devDependencies": {\n    "@a/first": "1.0.0",\n    "zod": "1.0.0"\n  }\n}\n',
    });
    writePackagePin(openFiles(sorted.path));
    const { devDependencies: inOrder } = JSON.parse(await readFile(join(sorted.path, 'package.json'), 'utf8')) as {
        devDependencies: Record<string, string>;
    };
    expect(Object.keys(inOrder)).toStrictEqual(['@a/first', '@gspothq/cli', 'zod']);
    await using unsorted = await createGitSandbox({
        'package.json': '{\n  "devDependencies": {\n    "zod": "1.0.0",\n    "@a/first": "1.0.0"\n  }\n}\n',
    });
    writePackagePin(openFiles(unsorted.path));
    const { devDependencies: outOfOrder } = JSON.parse(await readFile(join(unsorted.path, 'package.json'), 'utf8')) as {
        devDependencies: Record<string, string>;
    };
    expect(Object.keys(outOfOrder)).toStrictEqual(['zod', '@a/first', '@gspothq/cli']);
});

test('a package.json pin and a mise.toml pin that differ are both named, with the version to set', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': `{"devDependencies": {"${cliPackage.name}": "0.0.1"}}\n`,
        'mise.toml': '[tools]\n"npm:@gspothq/cli" = "0.0.2"\n',
    });
    const mismatch = findGspotPinMismatch(sandbox.path);
    expect(mismatch).toContain('package.json pins gspot 0.0.1 and mise.toml pins gspot 0.0.2');
    expect(mismatch).toContain(`set it to ${cliPackage.version}`);
});
