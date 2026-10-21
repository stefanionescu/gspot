import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { generate } from '#cli/generation/generate.ts';
import { type ApplyReport } from '#cli/types/apply.ts';
import { runGit, commitAll } from '#tests/setup/git.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import { LINKED_FILE_CASES } from '#tests/data/system.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';
import { TOOL_FOLDERS } from '#tests/data/install/installation.ts';
import { EDITED_STYLELINT_PACKAGE } from '#tests/data/commands/init.ts';
import { rm, stat, chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { STYLELINT_PACKAGE_FIELDS, COMMITLINT_PACKAGE_FIELDS, EDITED_COMMITLINT_PACKAGE } from '#tests/data/apply.ts';

function writeObsoleteFile(root: string): void {
    using log = openWriter(root);

    writePlans(log, [
        planReplacement(log, {
            path: '.gspot/obsolete/old.txt',
            next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
        }),
    ]);
}

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
    {
        using writer = openWriter(root);
        writeGeneratedFiles(session, generated, writer);
    }
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

test('generated files stay writable: apply keeps their bytes and removes them when nothing needs them', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: '[rules]\nenabled = true\n' }),
    });

    writeObsoleteFile(sandbox.path);
    expect(runGit(sandbox.path, ['init', '-q']).code).toBe(0);
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code).toBe(0);
    expect(await isOnDisk(join(sandbox.path, '.gspot/obsolete/old.txt'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gspot/obsolete'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gitattributes'))).toBe(true);
    const written = (JSON.parse(applied.stdout) as ApplyReport).written;

    const output = written.find((path) => path.endsWith('/engineering/rules/WORKING.md'))!;
    const bytes = await readFile(join(sandbox.path, output), 'utf8');
    const attributes = await stat(join(sandbox.path, output));
    expect(attributes.mode & 0o200).toBe(0o200);
    await chmod(join(sandbox.path, output), 0o444);
    const reapplied = await runGspot(sandbox.path, ['apply']);
    expect(reapplied.code).toBe(0);
    const refreshed = await stat(join(sandbox.path, output));
    expect(refreshed.mode & 0o200).toBe(0o200);
    expect(await readFile(join(sandbox.path, output), 'utf8')).toBe(bytes);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([]));
    const pruned = await runGspot(sandbox.path, ['apply']);
    expect(pruned.code).toBe(0);
    expect(await isOnDisk(join(sandbox.path, output))).toBe(false);
});

test.each([...LINKED_FILE_CASES])(
    'apply --dry-run refuses an input $path that links outside the repository',
    async ({ path, outside, files, message }) => {
        await using sandbox = await testdir({
            ...files,
            'project/.gspot/configurations/.keep': '',
            outside,
        });

        const project = join(sandbox.path, 'project');
        await symlink(join(sandbox.path, 'outside'), join(project, path));
        const refused = await runGspot(project, ['apply', '--dry-run']);
        expect(refused.code).toBe(2);
        expect(refused.stderr).toBe(`${message}\n`);
        expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe(outside);
    },
);

test('apply removes an obsolete directory link without following it', async () => {
    await using folder = await testdir({
        'project/gspot.toml': buildSandboxSettings([]),
        'outside/old.txt': 'outside bytes\n',
    });

    const root = join(folder.path, 'project');
    writeObsoleteFile(root);
    await rm(join(root, '.gspot/obsolete'), { recursive: true });
    await symlink('../../outside', join(root, '.gspot/obsolete'));
    expect(await runGspot(root, ['apply'])).toHaveProperty('code', 0);
    expect(await isOnDisk(join(root, '.gspot/obsolete'))).toBe(false);
    expect(await readFile(join(folder.path, 'outside/old.txt'), 'utf8')).toBe('outside bytes\n');
});

test('a fresh Git clone keeps the committed generated files byte for byte and mode for mode', async () => {
    await using original = await testdir();
    await using clone = await testdir();
    await createFileTree(original.path, { 'entry.sh': 'echo example\n' });
    commitAll(original.path);
    const initialized = await runGspot(original.path, buildInitArguments(['bash']));
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const reconciled = await runGspot(original.path, ['apply', '--json']);
    expect(reconciled.code, reconciled.stdout + reconciled.stderr).toBe(0);
    commitAll(original.path);
    const cloned = runGit(original.path, ['clone', '--quiet', '--no-local', original.path, clone.path]);
    expect(cloned.code, cloned.stderr).toBe(0);
    using files = openFiles(clone.path);
    const config = '.gspot/configurations/language/bash/shellcheckrc';
    const initial = files.read(config)!;
    const applied = await runGspot(clone.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(
        (JSON.parse(applied.stdout) as ApplyReport).notes.filter((note) => note.includes('shellcheckrc')),
    ).toStrictEqual([]);
    const restored = files.read(config)!;
    expect(restored.bytes).toStrictEqual(initial.bytes);
    expect(restored.mode).toBe(initial.mode);
    const repeated = await runGspot(clone.path, ['apply', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as ApplyReport).written).toStrictEqual([]);
    const unchanged = runGit(clone.path, ['diff', '--exit-code']);
    expect(unchanged.code, unchanged.stdout + unchanged.stderr).toBe(0);
});

test.each([...TOOL_FOLDERS])(
    'writing generated files deletes the $kind tool folder when no configuration needs it',
    async ({ folder }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([]),
            [`${folder}/tool/index.js`]: 'export {};\n',
        });

        const session = await openSession(sandbox.path);
        using log = openWriter(sandbox.path);
        writeGeneratedFiles(session, { files: [], blocks: [], managedKeys: [] }, log);
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
    {
        using writer = openWriter(sandbox.path);
        writeGeneratedFiles(session, generated, writer);
    }
    for (const [path, source] of installed) {
        const expected = JSON.parse(source) as Record<string, unknown>;
        Reflect.deleteProperty(expected, 'commitlint');
        expect(JSON.parse(await readFile(join(sandbox.path, path), 'utf8'))).toStrictEqual(expected);
    }
});

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
    {
        using writer = openWriter(sandbox.path);
        writeGeneratedFiles(session, generated, writer);
    }
    for (const [path, source] of installed) expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
});
