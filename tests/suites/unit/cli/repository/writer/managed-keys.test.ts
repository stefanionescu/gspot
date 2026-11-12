import { chmod, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseToml } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { CHECK_COMMAND } from '#cli/config/engine.ts';
import { planManagedKeys, writePlans } from '#cli/repository/writer.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { STYLELINT_PACKAGE_JSON } from '#tests/config/setup/configurations.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';

test('managed JSON keys survive reopening and updates and keep other bytes and the mode', async () => {
    await using sandbox = await testdir();
    const path = 'package.json';
    const previous = STYLELINT_PACKAGE_JSON.replaceAll('\n', '\r\n');
    await createFileTree(sandbox.path, { [path]: previous });
    await chmod(join(sandbox.path, path), 0o640);
    const changes = [{ key: ['stylelint'], value: { extends: './.stylelintrc.yml' } }];
    const firstWriter = openFiles(sandbox.path);
    writePlans(firstWriter, [planManagedKeys(firstWriter, path, changes)]);
    expect(planManagedKeys(firstWriter, path, changes).status).toBe('unchanged');
    const installed = firstWriter.read(path)!.bytes.toString('utf8');
    expect(installed).toBe(
        previous.replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./.stylelintrc.yml"}'),
    );
    await writeFile(join(sandbox.path, path), installed.replace('native-project', 'edited-project'));
    const writer = openFiles(sandbox.path);
    writePlans(writer, [planManagedKeys(writer, path, [{ key: ['stylelint'], value: { extends: './next.json' } }])]);
    expect(planManagedKeys(writer, path, changes).status).toBe('changed');
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(
        previous
            .replace('native-project', 'edited-project')
            .replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./next.json"}'),
    );
    const metadata = await stat(join(sandbox.path, path));
    expect(metadata.mode & 0o777).toBe(isWindows ? 0o666 : 0o640);
});

test('tool.jsonc key edits keep comments, containers and array order', async () => {
    const path = 'tool.jsonc';
    await using sandbox = await testdir();
    const previous = '// Keep this comment.\n{ "kept": {}, "entries": [0, false, ""], }\n';
    await createFileTree(sandbox.path, { [path]: previous });
    const writer = openFiles(sandbox.path);
    const fields = [
        { key: ['created', 'nested', 'owned'], value: 0 },
        { key: ['kept', 'owned'], value: false },
    ];
    writePlans(writer, [planManagedKeys(writer, path, fields)]);
    expect(planManagedKeys(writer, path, fields).status).toBe('unchanged');
    const written =
        '// Keep this comment.\n{ "kept": {"owned": false}, "entries": [0, false, ""],"created": {"nested":{"owned":0}}, }\n';
    expect(writer.read(path)!.bytes.toString('utf8')).toBe(written);
});

test('managed TOML keys refuse a malformed file, create missing tables, and write back an edited managed value', async () => {
    await using sandbox = await testdir({ 'broken.toml': '[tasks\n' });

    const writer = openFiles(sandbox.path);
    const changes = [{ key: ['tasks', 'gspot:check', 'run'], value: CHECK_COMMAND }];
    expect(() => planManagedKeys(writer, 'broken.toml', changes)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: expect.stringContaining('broken.toml') as string,
        }),
    );
    expect(await readFile(join(sandbox.path, 'broken.toml'), 'utf8')).toBe('[tasks\n');
    writePlans(writer, [planManagedKeys(writer, 'mise.toml', changes)]);
    const installed = await readFile(join(sandbox.path, 'mise.toml'), 'utf8');
    expect(parseToml(installed)).toStrictEqual({ tasks: { 'gspot:check': { run: CHECK_COMMAND } } });
    await writeFile(join(sandbox.path, 'mise.toml'), installed.replace(CHECK_COMMAND, 'authored check'));
    writePlans(writer, [planManagedKeys(writer, 'mise.toml', changes)]);
    expect(await readFile(join(sandbox.path, 'mise.toml'), 'utf8')).toBe(installed);
});

test('a managed TOML key update keeps the edits next to it', async () => {
    await using sandbox = await testdir();
    const previous = '# Keep this comment.\nextends = "./authored.json"\n[compilerOptions]\nstrict = false\n';
    await createFileTree(sandbox.path, { 'compiler.toml': previous });
    const firstWriter = openFiles(sandbox.path);
    writePlans(firstWriter, [
        planManagedKeys(firstWriter, 'compiler.toml', [{ key: ['extends'], value: './.gspot/first.json' }]),
    ]);
    const installed = firstWriter.read('compiler.toml')!.bytes.toString('utf8');
    const edited = installed.replace('strict = false', 'strict = true');
    await writeFile(join(sandbox.path, 'compiler.toml'), edited);
    writePlans(firstWriter, [
        planManagedKeys(firstWriter, 'compiler.toml', [{ key: ['extends'], value: './.gspot/second.json' }]),
    ]);
    expect(firstWriter.read('compiler.toml')!.bytes.toString('utf8')).toBe(
        edited.replace('./.gspot/first.json', './.gspot/second.json'),
    );
});

test('setting a TOML key to the value it holds keeps the bytes and mode', async () => {
    await using sandbox = await testdir();
    const content = 'authored = true\n[scripts]\ncheck = "gspot check"\n';
    await createFileTree(sandbox.path, { 'package.toml': content });
    await chmod(join(sandbox.path, 'package.toml'), 0o640);
    const writer = openFiles(sandbox.path);
    writePlans(writer, [
        planManagedKeys(writer, 'package.toml', [{ key: ['scripts', 'check'], value: CHECK_COMMAND }]),
    ]);
    expect(await readFile(join(sandbox.path, 'package.toml'), 'utf8')).toBe(content);
    const metadata = await stat(join(sandbox.path, 'package.toml'));
    expect(metadata.mode & 0o777).toBe(isWindows ? 0o666 : 0o640);
});
