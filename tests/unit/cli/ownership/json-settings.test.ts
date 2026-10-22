import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { planRemoval } from '#cli/ownership/plans.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';
import { STYLELINT_PACKAGE_JSON } from '#tests/data/checks/css.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { hasManagedKeys, planSettingsWrite } from '#cli/ownership/file-settings.ts';

test('managed JSON keys survive reopening and updates and keep other bytes and the mode', async () => {
    await using sandbox = await testdir();
    const path = 'package.json';
    const original = STYLELINT_PACKAGE_JSON.replaceAll('\n', '\r\n');
    await createFileTree(sandbox.path, { [path]: original });
    await chmod(join(sandbox.path, path), 0o640);
    const changes = [{ key: ['stylelint'], value: { extends: './.stylelintrc.json' } }];
    {
        using writer = openWriter(sandbox.path);
        writePlans(writer, [planSettingsWrite(writer, path, changes)]);
        expect(hasManagedKeys({ path, keys: changes }, writer.files.read(path)!)).toBe(true);
        const installed = writer.files.read(path)!.bytes.toString('utf8');
        expect(installed).toBe(
            original.replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./.stylelintrc.json"}'),
        );
        writePlans(writer, [planSettingsWrite(writer, path, changes)]);
        await writeFile(join(sandbox.path, path), installed.replace('native-project', 'edited-project'));
    }
    {
        using writer = openWriter(sandbox.path);
        writePlans(writer, [
            planSettingsWrite(writer, path, [{ key: ['stylelint'], value: { extends: './next.json' } }]),
        ]);
        expect(hasManagedKeys({ path, keys: changes }, writer.files.read(path)!)).toBe(false);
        writePlans(writer, [planRemoval(writer, path)]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(
            original
                .replace('native-project', 'edited-project')
                .replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./next.json"}'),
        );
        const metadata = await stat(join(sandbox.path, path));
        expect(metadata.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
    }
});

test.each(['tool.jsonc', 'package.json'])(
    '%s key edits keep comments, containers and array order after keys stop being managed',
    async (path) => {
        await using sandbox = await testdir();
        const original = '// Keep this comment.\n{ "kept": {}, "entries": [0, false, ""], }\n';
        await createFileTree(sandbox.path, { [path]: original });
        using writer = openWriter(sandbox.path);
        const fields = [
            { key: ['created', 'nested', 'owned'], value: 0 },
            { key: ['kept', 'owned'], value: false },
        ];
        writePlans(writer, [planSettingsWrite(writer, path, fields)]);
        expect(hasManagedKeys({ path, keys: fields }, writer.files.read(path)!)).toBe(true);
        const written =
            '// Keep this comment.\n{ "kept": {"owned": false}, "entries": [0, false, ""],"created": {"nested":{"owned":0}}, }\n';
        expect(writer.files.read(path)!.bytes.toString('utf8')).toBe(written);
        writePlans(writer, [planSettingsWrite(writer, path, [])]);
        expect(hasManagedKeys({ path, keys: fields }, writer.files.read(path)!)).toBe(true);
        expect(writer.files.read(path)!.bytes.toString('utf8')).toBe(written);
    },
);

test.each(['', '[]', 'false', '{"stylelint":'])(
    'invalid package.json text is refused without writing: %s',
    async (source) => {
        await using sandbox = await testdir({ 'package.json': source });

        using writer = openWriter(sandbox.path);
        const offset = source === '' ? '0' : '13';
        expect(() =>
            planSettingsWrite(writer, 'package.json', [{ key: ['stylelint'], value: { extends: './managed.json' } }]),
        ).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message:
                    source === '[]' || source === 'false'
                        ? 'package.json must contain a JSON object. Fix the file.'
                        : `package.json is not valid JSON: Invalid JSON at offset ${offset}: ValueExpected. Fix the file.`,
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
