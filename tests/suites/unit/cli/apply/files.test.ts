import { join } from 'node:path';
import { testdir } from 'testdirs';
import { unlinkSync } from 'node:fs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { generate } from '#cli/generation/generate.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { openWriter } from '#cli/apply/write/writer.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import type { PackageFieldScenario } from '#tests/types/apply.ts';
import { writeGeneratedFiles } from '#cli/apply/files/generated.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    TOOL_FOLDERS,
    EDITED_STYLELINT_PACKAGE,
    STYLELINT_PACKAGE_FIELDS,
    COMMITLINT_PACKAGE_FIELDS,
    EDITED_COMMITLINT_PACKAGE,
} from '#tests/config/apply/files.ts';

async function applyPackageFields(root: string, scenario: PackageFieldScenario): Promise<Map<string, string>> {
    const session = await openSession(root);
    const generated = generate(session);
    expect(generated.managedKeys).toStrictEqual(scenario.changes);
    using writer = openWriter(root);
    await writeGeneratedFiles(session, generated, writer);
    const authored = new Map<string, string>(Object.entries(scenario.project));
    for (const path of scenario.unchanged) expect(await readFile(join(root, path), 'utf8')).toBe(authored.get(path)!);
    return new Map(
        await Promise.all(
            Object.keys(scenario.project).map(
                async (path) => [path, await readFile(join(root, path), 'utf8')] as const,
            ),
        ),
    );
}

test.each([...TOOL_FOLDERS])(
    'writeGeneratedFiles deletes the $kind tool folder when no configuration needs it',
    async ({ folder }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([]),
            [`${folder}/tool/index.js`]: 'export {};\n',
        });

        const session = await openSession(sandbox.path);
        using writer = openWriter(sandbox.path);
        await writeGeneratedFiles(session, { files: [], blocks: [], managedKeys: [] }, writer);
        expect(await isOnDisk(join(sandbox.path, folder))).toBe(false);
    },
);
test('leaving level all removes the managed commitlint field from every package.json and keeps the other fields', async () => {
    await using sandbox = await testdir({
        ...COMMITLINT_PACKAGE_FIELDS.project,
        'gspot.toml': buildSandboxSettings(COMMITLINT_PACKAGE_FIELDS.configurations, {
            level: 'all',
            tables: COMMITLINT_PACKAGE_FIELDS.tables,
        }),
    });
    commitAll(sandbox.path);
    const installed = await applyPackageFields(sandbox.path, COMMITLINT_PACKAGE_FIELDS);
    await writeFile(join(sandbox.path, 'app/package.json'), EDITED_COMMITLINT_PACKAGE);
    installed.set('app/package.json', EDITED_COMMITLINT_PACKAGE);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([], { level: 'recommended' }));
    const session = await openSession(sandbox.path);
    const generated = generate(session);
    expect(generated.managedKeys).toStrictEqual(
        COMMITLINT_PACKAGE_FIELDS.changes.map((file) => ({
            path: file.path,
            keys: [{ key: ['commitlint'], value: undefined }],
        })),
    );
    using writer = openWriter(sandbox.path);
    await writeGeneratedFiles(session, generated, writer);
    for (const [path, source] of installed) {
        const expected = JSON.parse(source) as Record<string, unknown>;
        Reflect.deleteProperty(expected, 'commitlint');
        const contents: unknown = JSON.parse(await readFile(join(sandbox.path, path), 'utf8'));
        expect(contents).toStrictEqual(expected);
    }
});

test('removing css drops its managed stylelint field and keeps authored fields byte for byte', async () => {
    await using sandbox = await testdir({
        ...STYLELINT_PACKAGE_FIELDS.project,
        'gspot.toml': buildSandboxSettings(STYLELINT_PACKAGE_FIELDS.configurations, {
            level: 'all',
            tables: STYLELINT_PACKAGE_FIELDS.tables,
        }),
    });
    const installed = await applyPackageFields(sandbox.path, STYLELINT_PACKAGE_FIELDS);
    await writeFile(join(sandbox.path, 'app/package.json'), EDITED_STYLELINT_PACKAGE);
    installed.set('app/package.json', EDITED_STYLELINT_PACKAGE);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([], { level: 'all' }));
    const session = await openSession(sandbox.path);
    const generated = generate(session);
    expect(generated.managedKeys).toStrictEqual([
        { path: 'package.json', keys: [{ key: ['stylelint'], value: undefined }] },
        { path: 'app/child/package.json', keys: [{ key: ['stylelint'], value: undefined }] },
        { path: 'other/package.json', keys: [{ key: ['stylelint'], value: undefined }] },
    ]);
    using writer = openWriter(sandbox.path);
    await writeGeneratedFiles(session, generated, writer);
    for (const [path, source] of installed) {
        if (['package.json', 'app/child/package.json', 'other/package.json'].includes(path)) {
            const expected = JSON.parse(source) as Record<string, unknown>;
            Reflect.deleteProperty(expected, 'stylelint');
            const contents: unknown = JSON.parse(await readFile(join(sandbox.path, path), 'utf8'));
            expect(contents).toStrictEqual(expected);
        } else expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
    }
});

test('a stale generated file removed before planning produces no removal report', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        '.gspot/stale.txt': 'stale\n',
    });
    const session = await openSession(sandbox.path);
    using writer = openWriter(sandbox.path);
    const readKeepingLinks = writer.readKeepingLinks.bind(writer);
    using _disappear = spyOn(writer, 'readKeepingLinks').mockImplementation((path) => {
        if (path === '.gspot/stale.txt') unlinkSync(join(sandbox.path, path));
        return readKeepingLinks(path);
    });
    const report = await writeGeneratedFiles(session, { files: [], blocks: [], managedKeys: [] }, writer);
    expect(report).toStrictEqual({ written: [], unchanged: [], removed: [], updated: [], notes: [] });
    expect(await isOnDisk(join(sandbox.path, '.gspot/stale.txt'))).toBe(false);
});
