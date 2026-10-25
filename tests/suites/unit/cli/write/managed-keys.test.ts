import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { INVALID_PACKAGE_JSON_TEXTS } from '#tests/config/write.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { STYLELINT_PACKAGE_JSON } from '#tests/config/authored-config-files.ts';
import { openWriter, writePlans, hasManagedKeys, planSettingsWrite } from '#cli/write.ts';

test('managed JSON keys survive reopening and updates and keep other bytes and the mode', async () => {
    await using sandbox = await testdir();
    const path = 'package.json';
    const original = STYLELINT_PACKAGE_JSON.replaceAll('\n', '\r\n');
    await createFileTree(sandbox.path, { [path]: original });
    await chmod(join(sandbox.path, path), 0o640);
    const changes = [{ key: ['stylelint'], value: { extends: './.stylelintrc.yml' } }];
    const firstWriter = openWriter(sandbox.path);
    writePlans(firstWriter, [planSettingsWrite(firstWriter, path, changes)]);
    expect(hasManagedKeys({ path, keys: changes }, firstWriter.read(path)!)).toBe(true);
    const installed = firstWriter.read(path)!.bytes.toString('utf8');
    expect(installed).toBe(
        original.replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./.stylelintrc.yml"}'),
    );
    await writeFile(join(sandbox.path, path), installed.replace('native-project', 'edited-project'));
    firstWriter[Symbol.dispose]();
    using writer = openWriter(sandbox.path);
    writePlans(writer, [planSettingsWrite(writer, path, [{ key: ['stylelint'], value: { extends: './next.json' } }])]);
    expect(hasManagedKeys({ path, keys: changes }, writer.read(path)!)).toBe(false);
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(
        original
            .replace('native-project', 'edited-project')
            .replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./next.json"}'),
    );
    const metadata = await stat(join(sandbox.path, path));
    expect(metadata.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
});

test.each(['tool.jsonc', 'package.json'])('%s key edits keep comments, containers and array order', async (path) => {
    await using sandbox = await testdir();
    const original = '// Keep this comment.\n{ "kept": {}, "entries": [0, false, ""], }\n';
    await createFileTree(sandbox.path, { [path]: original });
    using writer = openWriter(sandbox.path);
    const fields = [
        { key: ['created', 'nested', 'owned'], value: 0 },
        { key: ['kept', 'owned'], value: false },
    ];
    writePlans(writer, [planSettingsWrite(writer, path, fields)]);
    expect(hasManagedKeys({ path, keys: fields }, writer.read(path)!)).toBe(true);
    const written =
        '// Keep this comment.\n{ "kept": {"owned": false}, "entries": [0, false, ""],"created": {"nested":{"owned":0}}, }\n';
    expect(writer.read(path)!.bytes.toString('utf8')).toBe(written);
});

test.each([...INVALID_PACKAGE_JSON_TEXTS])(
    'invalid package.json text is refused without writing: %p',
    async ({ source, message }) => {
        await using sandbox = await testdir({ 'package.json': source });

        using writer = openWriter(sandbox.path);
        expect(() =>
            planSettingsWrite(writer, 'package.json', [{ key: ['stylelint'], value: { extends: './managed.json' } }]),
        ).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message,
            }),
        );
        expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(source);
    },
);

test.each(['package.json', 'bunfig.toml'])(
    'managed keys refuse non-UTF-8 %s with a file error and keep its bytes',
    async (path) => {
        await using sandbox = await testdir();
        const bytes = Buffer.from([0xff, 0xfe, 0x41, 0x00]);
        await writeFile(join(sandbox.path, path), bytes);
        using writer = openWriter(sandbox.path);
        expect(() => planSettingsWrite(writer, path, [])).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: `${path} is not UTF-8 text. Save it as UTF-8, then run the command again.`,
            }),
        );
        expect(await readFile(join(sandbox.path, path))).toStrictEqual(bytes);
    },
);

test('managed TOML keys refuse a malformed file, create missing tables, and write back an edited managed value', async () => {
    await using sandbox = await testdir({ 'broken.toml': '[tasks\n' });

    using writer = openWriter(sandbox.path);
    const changes = [{ key: ['tasks', 'gspot:check', 'run'], value: 'gspot check' }];
    expect(() => planSettingsWrite(writer, 'broken.toml', changes)).toThrow(
        new GspotError(
            'filesystem',
            'broken.toml:1:7 is not valid TOML: Expected table closing "]", found end of file. Fix the file.',
        ),
    );
    expect(await readFile(join(sandbox.path, 'broken.toml'), 'utf8')).toBe('[tasks\n');
    writePlans(writer, [planSettingsWrite(writer, 'mise.toml', changes)]);
    const installed = await readFile(join(sandbox.path, 'mise.toml'), 'utf8');
    expect(parseToml(installed)).toStrictEqual({ tasks: { 'gspot:check': { run: 'gspot check' } } });
    await writeFile(join(sandbox.path, 'mise.toml'), installed.replace('gspot check', 'authored check'));
    writePlans(writer, [planSettingsWrite(writer, 'mise.toml', changes)]);
    expect(await readFile(join(sandbox.path, 'mise.toml'), 'utf8')).toBe(installed);
});
test('a managed TOML key update keeps the edits next to it', async () => {
    await using sandbox = await testdir();
    const original = '# Keep this comment.\nextends = "./authored.json"\n[compilerOptions]\nstrict = false\n';
    await createFileTree(sandbox.path, { 'compiler.toml': original });
    const firstWriter = openWriter(sandbox.path);
    writePlans(firstWriter, [
        planSettingsWrite(firstWriter, 'compiler.toml', [{ key: ['extends'], value: './.gspot/first.json' }]),
    ]);
    const installed = firstWriter.read('compiler.toml')!.bytes.toString('utf8');
    const edited = installed.replace('strict = false', 'strict = true');
    await writeFile(join(sandbox.path, 'compiler.toml'), edited);
    writePlans(firstWriter, [
        planSettingsWrite(firstWriter, 'compiler.toml', [{ key: ['extends'], value: './.gspot/second.json' }]),
    ]);
    expect(firstWriter.read('compiler.toml')!.bytes.toString('utf8')).toBe(
        edited.replace('./.gspot/first.json', './.gspot/second.json'),
    );
    firstWriter[Symbol.dispose]();
});

test('setting a TOML key to the value it holds keeps the bytes and mode', async () => {
    await using sandbox = await testdir();
    const content = 'authored = true\n[scripts]\ncheck = "gspot check"\n';
    await createFileTree(sandbox.path, { 'package.toml': content });
    await chmod(join(sandbox.path, 'package.toml'), 0o640);
    using writer = openWriter(sandbox.path);
    writePlans(writer, [
        planSettingsWrite(writer, 'package.toml', [{ key: ['scripts', 'check'], value: 'gspot check' }]),
    ]);
    expect(await readFile(join(sandbox.path, 'package.toml'), 'utf8')).toBe(content);
    const metadata = await stat(join(sandbox.path, 'package.toml'));
    expect(metadata.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
});
