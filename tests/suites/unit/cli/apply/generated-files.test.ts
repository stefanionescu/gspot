import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { openWriter } from '#cli/apply/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { writeGeneratedFiles } from '#cli/apply/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    TOOL_FOLDERS,
    EDITED_STYLELINT_PACKAGE,
    STYLELINT_PACKAGE_FIELDS,
    COMMITLINT_PACKAGE_FIELDS,
    EDITED_COMMITLINT_PACKAGE,
} from '#tests/config/apply/generated-files.ts';

test.each([...TOOL_FOLDERS])(
    'writeGeneratedFiles deletes the $kind tool folder when no configuration needs it',
    async ({ folder }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([]),
            [`${folder}/tool/index.js`]: 'export {};\n',
        });

        const session = await openSession(sandbox.path);
        using writer = openWriter(sandbox.path);
        writeGeneratedFiles(session, { files: [], blocks: [], managedKeys: [] }, writer);
        expect(await isOnDisk(join(sandbox.path, folder))).toBe(false);
    },
);
test('leaving level all removes the managed commitlint field from every package.json and keeps the other fields', async () => {
    const scenario = COMMITLINT_PACKAGE_FIELDS;
    await using sandbox = await testdir({
        ...scenario.project,
        'gspot.toml': buildSandboxSettings(scenario.configurations, { level: 'all', tables: scenario.tables }),
    });
    commitAll(sandbox.path);
    const installed = await writePackageFields(sandbox.path, scenario);
    await writeFile(join(sandbox.path, 'app/package.json'), EDITED_COMMITLINT_PACKAGE);
    installed.set('app/package.json', EDITED_COMMITLINT_PACKAGE);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([], { level: 'recommended' }));
    const session = await openSession(sandbox.path);
    const generated = generate(session);
    expect(generated.managedKeys).toStrictEqual(
        scenario.changes.map((file) => ({ path: file.path, keys: [{ key: ['commitlint'], value: undefined }] })),
    );
    using writer = openWriter(sandbox.path);
    writeGeneratedFiles(session, generated, writer);
    for (const [path, source] of installed) {
        const expected = JSON.parse(source) as Record<string, unknown>;
        Reflect.deleteProperty(expected, 'commitlint');
        expect(JSON.parse(await readFile(join(sandbox.path, path), 'utf8'))).toStrictEqual(expected);
    }
});

/** Write selected package fields and retain the complete installed bytes for the removal checks. */
async function writePackageFields(
    root: string,
    scenario: typeof COMMITLINT_PACKAGE_FIELDS | typeof STYLELINT_PACKAGE_FIELDS,
): Promise<Map<string, string>> {
    const session = await openSession(root);
    const generated = generate(session);
    expect(generated.managedKeys).toStrictEqual(
        scenario.changes.map((file) => ({
            ...file,
            keys: file.keys.map((change) => ({ ...change, key: [...change.key] })),
        })),
    );
    using writer = openWriter(root);
    writeGeneratedFiles(session, generated, writer);
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
test('removing css leaves package.json files with an authored stylelint field byte for byte', async () => {
    const scenario = STYLELINT_PACKAGE_FIELDS;
    await using sandbox = await testdir({
        ...scenario.project,
        'gspot.toml': buildSandboxSettings(scenario.configurations, { level: 'all', tables: scenario.tables }),
    });
    const installed = await writePackageFields(sandbox.path, scenario);
    await writeFile(join(sandbox.path, 'app/package.json'), EDITED_STYLELINT_PACKAGE);
    installed.set('app/package.json', EDITED_STYLELINT_PACKAGE);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([], { level: 'all' }));
    const session = await openSession(sandbox.path);
    const generated = generate(session);
    expect(generated.managedKeys).toStrictEqual([]);
    using writer = openWriter(sandbox.path);
    writeGeneratedFiles(session, generated, writer);
    for (const [path, source] of installed) expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
});
