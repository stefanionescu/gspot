import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { fileMode } from '#cli/system/safe-folder/reads.ts';
import { hasManagedKeys } from '#cli/ownership/managed-keys.ts';
import { STYLELINT_PACKAGE_JSON } from '#tests/config/stylelint.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { applyPlans, openOwnershipLog } from '#cli/ownership/log.ts';
import { OWNERSHIP_REFUSAL } from '#tests/config/generated-files.ts';
import { planManagedKeys, planRestoration } from '#cli/ownership/plans.ts';

test('managed JSON keys survive reopening, updates and removal and keep other bytes and the mode', async () => {
    await using sandbox = await testdir();
    const path = 'package.json';
    const original = STYLELINT_PACKAGE_JSON.replaceAll('\n', '\r\n');
    await createFileTree(sandbox.path, { [path]: original });
    await chmod(join(sandbox.path, path), 0o640);
    const changes = [{ path: ['stylelint'], value: { extends: './.stylelintrc.json' } }];
    {
        using log = openOwnershipLog(sandbox.path);
        applyPlans(log, [planManagedKeys(log, path, changes, true)]);
        expect(log.entryFor(path)?.keys?.format).toBe('json');
        expect(hasManagedKeys(sandbox.path, { path, changes })).toBe(true);
        const installed = log.files.read(path)!.bytes.toString('utf8');
        expect(installed).toBe(
            original.replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./.stylelintrc.json"}'),
        );
        applyPlans(log, [planManagedKeys(log, path, changes)]);
        await writeFile(join(sandbox.path, path), installed.replace('native-project', 'edited-project'));
    }
    {
        using log = openOwnershipLog(sandbox.path);
        applyPlans(log, [planManagedKeys(log, path, [{ path: ['stylelint'], value: { extends: './next.json' } }])]);
        expect(hasManagedKeys(sandbox.path, { path, changes })).toBe(false);
        applyPlans(log, [planRestoration(log, path)]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(
            original.replace('native-project', 'edited-project'),
        );
        const metadata = await stat(join(sandbox.path, path));
        expect(metadata.mode & 0o777).toBe(fileMode({ mode: 0o640 }));
    }
});

test('an edited managed JSON key and its record stay as they are on update and give-back', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': STYLELINT_PACKAGE_JSON });
    using log = openOwnershipLog(sandbox.path);
    applyPlans(log, [
        planManagedKeys(log, 'package.json', [{ path: ['stylelint'], value: { extends: './managed.json' } }], true),
    ]);
    const installed = log.files.read('package.json')!.bytes.toString('utf8');
    const edited = installed.replace('./managed.json', './authored.json');
    await writeFile(join(sandbox.path, 'package.json'), edited);
    const records = structuredClone(log.state);
    expect(() => {
        applyPlans(log, [
            planManagedKeys(log, 'package.json', [{ path: ['stylelint'], value: { extends: './next.json' } }], true),
        ]);
    }).toThrow(`These files were not overwritten by gspot: package.json${OWNERSHIP_REFUSAL}`);
    expect(() => {
        applyPlans(log, [planRestoration(log, 'package.json')]);
    }).toThrow(`These files were not overwritten by gspot: package.json${OWNERSHIP_REFUSAL}`);
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(edited);
    expect(log.state).toStrictEqual(records);
});

test('JSONC key edits keep comments, your containers and array order, and remove parents gspot created', async () => {
    await using sandbox = await testdir();
    const original = '// Keep this comment.\n{ "kept": {}, "entries": [0, false, ""], }\n';
    await createFileTree(sandbox.path, { 'tool.jsonc': original });
    using log = openOwnershipLog(sandbox.path);
    const fields = [
        { path: ['created', 'nested', 'owned'], value: 0 },
        { path: ['kept', 'owned'], value: false },
    ];
    applyPlans(log, [planManagedKeys(log, 'tool.jsonc', fields, true)]);
    expect(hasManagedKeys(sandbox.path, { path: 'tool.jsonc', changes: fields })).toBe(true);
    expect(log.files.read('tool.jsonc')!.bytes.toString('utf8')).toContain('// Keep this comment.\n');
    applyPlans(log, [planManagedKeys(log, 'tool.jsonc', [])]);
    expect(log.files.read('tool.jsonc')!.bytes.toString('utf8')).toBe(original);
});

test.each(['', '[]', 'false', '{"stylelint":', '{ /* comment */ "stylelint": {} }'])(
    'invalid package.json text is refused without writing: %s',
    async (source) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': source });
        using log = openOwnershipLog(sandbox.path);
        const records = structuredClone(log.state);
        expect(() =>
            planManagedKeys(log, 'package.json', [{ path: ['stylelint'], value: { extends: './managed.json' } }], true),
        ).toThrow('package.json is not valid JSON. Fix the file, then run gspot apply.');
        expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(source);
        expect(log.state).toStrictEqual(records);
    },
);
