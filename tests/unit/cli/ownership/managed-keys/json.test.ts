import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { hasManagedKeys } from '#cli/ownership/managed-keys.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { writePlans, openWriter } from '#cli/ownership/writer.ts';
import { STYLELINT_PACKAGE_JSON } from '#tests/config/stylelint.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { planRemoval, planManagedKeys } from '#cli/ownership/plans.ts';

test('managed JSON keys survive reopening and updates and keep other bytes and the mode', async () => {
    await using sandbox = await testdir();
    const path = 'package.json';
    const original = STYLELINT_PACKAGE_JSON.replaceAll('\n', '\r\n');
    await createFileTree(sandbox.path, { [path]: original });
    await chmod(join(sandbox.path, path), 0o640);
    const changes = [{ path: ['stylelint'], value: { extends: './.stylelintrc.json' } }];
    {
        using log = openWriter(sandbox.path);
        writePlans(log, [planManagedKeys(log, path, changes)]);
        expect(hasManagedKeys({ path, changes }, log.files.read(path)!)).toBe(true);
        const installed = log.files.read(path)!.bytes.toString('utf8');
        expect(installed).toBe(
            original.replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./.stylelintrc.json"}'),
        );
        writePlans(log, [planManagedKeys(log, path, changes)]);
        await writeFile(join(sandbox.path, path), installed.replace('native-project', 'edited-project'));
    }
    {
        using log = openWriter(sandbox.path);
        writePlans(log, [planManagedKeys(log, path, [{ path: ['stylelint'], value: { extends: './next.json' } }])]);
        expect(hasManagedKeys({ path, changes }, log.files.read(path)!)).toBe(false);
        writePlans(log, [planRemoval(log, path)]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(
            original
                .replace('native-project', 'edited-project')
                .replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./next.json"}'),
        );
        const metadata = await stat(join(sandbox.path, path));
        expect(metadata.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
    }
});

test('JSONC key edits keep comments, containers and array order after keys stop being managed', async () => {
    await using sandbox = await testdir();
    const original = '// Keep this comment.\n{ "kept": {}, "entries": [0, false, ""], }\n';
    await createFileTree(sandbox.path, { 'tool.jsonc': original });
    using log = openWriter(sandbox.path);
    const fields = [
        { path: ['created', 'nested', 'owned'], value: 0 },
        { path: ['kept', 'owned'], value: false },
    ];
    writePlans(log, [planManagedKeys(log, 'tool.jsonc', fields)]);
    expect(hasManagedKeys({ path: 'tool.jsonc', changes: fields }, log.files.read('tool.jsonc')!)).toBe(true);
    expect(log.files.read('tool.jsonc')!.bytes.toString('utf8')).toContain('// Keep this comment.\n');
    writePlans(log, [planManagedKeys(log, 'tool.jsonc', [])]);
    expect(hasManagedKeys({ path: 'tool.jsonc', changes: fields }, log.files.read('tool.jsonc')!)).toBe(true);
});

test.each(['', '[]', 'false', '{"stylelint":', '{ /* comment */ "stylelint": {} }'])(
    'invalid package.json text is refused without writing: %s',
    async (source) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': source });
        using log = openWriter(sandbox.path);
        expect(() =>
            planManagedKeys(log, 'package.json', [{ path: ['stylelint'], value: { extends: './managed.json' } }]),
        ).toThrow('package.json is not valid JSON. Fix the file.');
        expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(source);
    },
);
