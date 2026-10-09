import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { hasFields } from '#cli/lifecycle/merge/contracts.ts';
import { TAKEOVER_PACKAGE } from '#tests/config/samples/css.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { OWNERSHIP_REFUSAL } from '#tests/config/samples/ownership.ts';
import { applyPlans, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { planMerge, planRestoration } from '#cli/lifecycle/ownership/contracts.ts';

test('JSON field ownership survives reopen, updates and removal while keeping unrelated bytes and modes', async () => {
    await using sandbox = await testdir();
    const path = 'package.json';
    const original = TAKEOVER_PACKAGE.replaceAll('\n', '\r\n');
    await createFileTree(sandbox.path, { [path]: original });
    await chmod(join(sandbox.path, path), 0o640);
    const changes = [{ path: ['stylelint'], value: { extends: './.stylelintrc.json' } }];
    let log = openOwnership(sandbox.path);
    try {
        expect(applyPlans(log, [planMerge(log, path, changes, true)])[0]).toBe('changed');
        expect(log.entryFor(path)?.configuration?.format).toBe('json');
        expect(hasFields(sandbox.path, { path, changes })).toBe(true);
        const installed = log.files.read(path)!.bytes.toString('utf8');
        expect(installed).toBe(
            original.replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./.stylelintrc.json"}'),
        );
        expect(applyPlans(log, [planMerge(log, path, changes)])[0]).toBe('unchanged');
        await writeFile(join(sandbox.path, path), installed.replace('native-project', 'edited-project'));
        log[Symbol.dispose]();
        log = openOwnership(sandbox.path);
        expect(
            applyPlans(log, [planMerge(log, path, [{ path: ['stylelint'], value: { extends: './next.json' } }])])[0],
        ).toBe('changed');
        expect(hasFields(sandbox.path, { path, changes })).toBe(false);
        expect(applyPlans(log, [planRestoration(log, path)])[0]).toBe('changed');
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(
            original.replace('native-project', 'edited-project'),
        );
        const metadata = await stat(join(sandbox.path, path));
        expect(metadata.mode & 0o777).toBe(getKeptMode(0o640));
    } finally {
        log[Symbol.dispose]();
    }
});

test('JSON ownership leaves edited managed fields and their records intact during update and restoration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': TAKEOVER_PACKAGE });
    using log = openOwnership(sandbox.path);
    applyPlans(log, [
        planMerge(log, 'package.json', [{ path: ['stylelint'], value: { extends: './managed.json' } }], true),
    ]);
    const installed = log.files.read('package.json')!.bytes.toString('utf8');
    const edited = installed.replace('./managed.json', './authored.json');
    await writeFile(join(sandbox.path, 'package.json'), edited);
    const records = structuredClone(log.state);
    expect(() =>
        applyPlans(log, [
            planMerge(log, 'package.json', [{ path: ['stylelint'], value: { extends: './next.json' } }], true),
        ]),
    ).toThrow(`The file package.json ${OWNERSHIP_REFUSAL}`);
    expect(() => applyPlans(log, [planRestoration(log, 'package.json')])).toThrow(
        `The file package.json ${OWNERSHIP_REFUSAL}`,
    );
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(edited);
    expect(log.state).toStrictEqual(records);
});

test('JSONC merges retain comments, authored containers and array order while removing created parents', async () => {
    await using sandbox = await testdir();
    const original = '// Keep this comment.\n{ "kept": {}, "entries": [0, false, ""], }\n';
    await createFileTree(sandbox.path, { 'tool.jsonc': original });
    using log = openOwnership(sandbox.path);
    const fields = [
        { path: ['created', 'nested', 'owned'], value: 0 },
        { path: ['kept', 'owned'], value: false },
    ];
    expect(applyPlans(log, [planMerge(log, 'tool.jsonc', fields, true)])[0]).toBe('changed');
    expect(hasFields(sandbox.path, { path: 'tool.jsonc', changes: fields })).toBe(true);
    expect(log.files.read('tool.jsonc')!.bytes.toString('utf8')).toContain('// Keep this comment.\n');
    expect(applyPlans(log, [planMerge(log, 'tool.jsonc', [])])[0]).toBe('changed');
    expect(log.files.read('tool.jsonc')!.bytes.toString('utf8')).toBe(original);
});

test.each(['', '[]', 'false', '{"stylelint":', '{ /* comment */ "stylelint": {} }'])(
    'JSON ownership rejects invalid authored package text without writes: %s',
    async (source) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': source });
        using log = openOwnership(sandbox.path);
        const records = structuredClone(log.state);
        expect(() =>
            planMerge(log, 'package.json', [{ path: ['stylelint'], value: { extends: './managed.json' } }], true),
        ).toThrow('package.json is not valid JSON. Fix the file, then run gspot apply.');
        expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(source);
        expect(log.state).toStrictEqual(records);
    },
);

test('JSON ownership refuses a scalar parent and a persisted native-format mismatch', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'tool.json': '{"settings":false}\n' });
    using log = openOwnership(sandbox.path);
    expect(() => planMerge(log, 'tool.json', [{ path: ['settings', 'owned'], value: true }], true)).toThrow(
        'tool.json cannot be edited at settings.owned. Fix the field, then run gspot apply.',
    );
    expect(log.files.read('tool.json')!.bytes.toString('utf8')).toBe('{"settings":false}\n');
    applyPlans(log, [planMerge(log, 'tool.json', [{ path: ['settings'], value: true }], true)]);
    log.entryFor('tool.json')!.configuration!.format = 'toml';
    log.save();
    const records = structuredClone(log.state);
    expect(() => planMerge(log, 'tool.json', [{ path: ['settings'], value: false }])).toThrow(
        'tool.json has a recorded configuration format that differs from its native format.',
    );
    expect(() => planRestoration(log, 'tool.json')).toThrow(
        'tool.json has a recorded configuration format that differs from its native format.',
    );
    expect(log.files.read('tool.json')!.bytes.toString('utf8')).toBe('{"settings":true}\n');
    expect(log.state).toStrictEqual(records);
});
