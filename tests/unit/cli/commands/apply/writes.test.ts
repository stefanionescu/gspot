import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openFiles } from '#cli/system/files/open.ts';
import { generate } from '#cli/generation/generate.ts';
import { type ApplyReport } from '#cli/types/apply.ts';
import { runGit, commitAll } from '#tests/setup/git.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { EXTERNAL_INPUT_CASES } from '#tests/data/system.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';
import { TOOL_FOLDERS } from '#tests/data/install/installation.ts';
import { runGspot, runRegisteredCommand } from '#tests/setup/run-gspot.ts';
import { rm, stat, chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { STYLELINT_FILES, STYLELINT_PACKAGE_JSON } from '#tests/data/checks/css.ts';
import { COMMITLINT_PACKAGE, COMMITLINT_PROJECT } from '#tests/data/checks/commits.ts';
import { CURRENT_LAYOUT_FILES, PREVIOUS_LAYOUT_FILES } from '#tests/data/commands/apply.ts';

test('generated files stay writable: apply keeps their bytes and removes them when nothing needs them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], { rules: true, tables: '[rules]\nenabled = true\n' }),
    });
    writeObsoleteFile(sandbox.path);
    expect(runGit(sandbox.path, ['init', '-q']).code).toBe(0);
    const applied = await runRegisteredCommand(sandbox.path, ['apply']);
    expect(applied.exitCode).toBe(0);
    expect(await isOnDisk(join(sandbox.path, '.gspot/obsolete/old.txt'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gitattributes'))).toBe(true);
    const written = (applied.json as ApplyReport).written;

    const output = written.find((path) => path.endsWith('/engineering/rules/WORKING.md'))!;
    expect(output).toBeDefined();
    const bytes = await readFile(join(sandbox.path, output), 'utf8');
    const attributes = await stat(join(sandbox.path, output));
    expect(attributes.mode & 0o200).toBe(0o200);
    await chmod(join(sandbox.path, output), 0o444);
    const reapplied = await runRegisteredCommand(sandbox.path, ['apply']);
    expect(reapplied.exitCode).toBe(0);
    const refreshed = await stat(join(sandbox.path, output));
    expect(refreshed.mode & 0o200).toBe(0o200);
    expect(await readFile(join(sandbox.path, output), 'utf8')).toBe(bytes);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSettingsText([]));
    const pruned = await runRegisteredCommand(sandbox.path, ['apply']);
    expect(pruned.exitCode).toBe(0);
    expect(await isOnDisk(join(sandbox.path, output))).toBe(false);
});

test.each([...EXTERNAL_INPUT_CASES])(
    'apply --dry-run refuses an input $path that links outside the repository',
    async ({ path, outside, files, message }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...files,
            'project/.gspot/configurations/.keep': '',
            outside,
        });
        const project = join(sandbox.path, 'project');
        await symlink(join(sandbox.path, 'outside'), join(project, path));
        expect(await captureRejection(runRegisteredCommand(project, ['apply', '--dry-run']))).toContain(message);
        expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe(outside);
        expect(await isOnDisk(join(project, '.gspot/state/ownership.json'))).toBe(false);
    },
);

test('apply removes an obsolete directory link without following it', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'project/gspot.toml': buildSettingsText([]),
        'outside/old.txt': 'outside bytes\n',
    });
    const root = join(folder.path, 'project');
    writeObsoleteFile(root);
    await rm(join(root, '.gspot/obsolete'), { recursive: true });
    await symlink('../../outside', join(root, '.gspot/obsolete'));
    expect(await runRegisteredCommand(root, ['apply'])).toHaveProperty('exitCode', 0);
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
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText([]),
            [`${folder}/tool/index.js`]: 'export {};\n',
        });
        const session = await openSession(sandbox.path);
        using log = openWriter(sandbox.path);
        writeGeneratedFiles(session, { files: [], blocks: [], fileEdits: [], notes: [] }, log);
        expect(await isOnDisk(join(sandbox.path, folder))).toBe(false);
    },
);

test.each([
    {
        tool: 'commitlint',
        project: COMMITLINT_PROJECT,
        original: COMMITLINT_PACKAGE,
        configurations: [],
        tables: '[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n',
        hasGit: true,
        leaveLevel: 'recommended' as const,
        unchanged: ['plain/package.json'],
        changes: [
            {
                path: 'package.json',
                changes: [
                    {
                        path: ['commitlint'],
                        value: { extends: './.gspot/configurations/general/commits/commitlint.json' },
                    },
                ],
            },
            {
                path: 'app/child/package.json',
                changes: [
                    {
                        path: ['commitlint'],
                        value: { extends: '../../.gspot/configurations/general/commits/commitlint.json' },
                    },
                ],
            },
            {
                path: 'app/package.json',
                changes: [
                    {
                        path: ['commitlint'],
                        value: { extends: '../.gspot/configurations/general/commits/commitlint.json' },
                    },
                ],
            },
        ],
    },
    {
        tool: 'stylelint',
        project: STYLELINT_FILES,
        original: STYLELINT_PACKAGE_JSON,
        configurations: ['css'],
        tables: '[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "other"\n',
        hasGit: false,
        leaveLevel: 'all' as const,
        unchanged: ['plain/package.json', 'app/child/package.json', 'other/package.json'],
        changes: [
            { path: 'package.json', changes: [{ path: ['stylelint'], value: { extends: './.stylelintrc.json' } }] },
            {
                path: 'app/package.json',
                changes: [{ path: ['stylelint'], value: { extends: './.stylelintrc.json' } }],
            },
        ],
    },
])('leaving a tool selection preserves unrelated package.json fields: $tool', async (row) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...row.project,
        'gspot.toml': buildSettingsText(row.configurations, { level: 'all', tables: row.tables }),
    });
    if (row.hasGit) commitAll(sandbox.path);
    let session = await openSession(sandbox.path);
    const generated = generate(session);
    expect(generated.fileEdits).toStrictEqual(
        row.changes.map((file) => ({
            ...file,
            changes: file.changes.map((change) => ({ ...change, path: [...change.path] })),
        })),
    );
    {
        using log = openWriter(sandbox.path);
        writeGeneratedFiles(session, generated, log);
    }
    const authored = new Map<string, string>(Object.entries(row.project));
    for (const path of row.unchanged) expect(authored.get(path)).toBe(await readFile(join(sandbox.path, path), 'utf8'));
    const installedCopies = new Map(
        await Promise.all(
            Object.keys(row.project).map(
                async (path) => [path, await readFile(join(sandbox.path, path), 'utf8')] as const,
            ),
        ),
    );
    const installed = installedCopies.get('app/package.json')!;
    const editedPackage = installed.replace('native-project', 'edited-project');
    await writeFile(join(sandbox.path, 'app/package.json'), editedPackage);
    installedCopies.set('app/package.json', editedPackage);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSettingsText([], { level: row.leaveLevel }));
    session = await openSession(sandbox.path);
    expect(generate(session).fileEdits).toStrictEqual(
        row.tool === 'commitlint'
            ? row.changes.map((file) => ({ path: file.path, changes: [{ path: [row.tool], value: undefined }] }))
            : [],
    );
    {
        using log = openWriter(sandbox.path);
        writeGeneratedFiles(session, generate(session), log);
    }
    for (const [path, source] of installedCopies) {
        const actual = await readFile(join(sandbox.path, path), 'utf8');
        if (row.tool === 'commitlint') {
            const expected = JSON.parse(source) as Record<string, unknown>;
            Reflect.deleteProperty(expected, row.tool);
            expect(JSON.parse(actual)).toStrictEqual(expected);
        } else expect(actual).toBe(source);
    }
});

function writeObsoleteFile(root: string): void {
    using log = openWriter(root);

    writePlans(log, [
        planReplacement(log, {
            path: '.gspot/obsolete/old.txt',
            next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
        }),
    ]);
}

test('the first apply after an upgrade moves tool files and rules from the 0.2 layout', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript', 'prose'], { rules: true, tables: '[rules]\nenabled = true\n' }),
        'index.js': 'export const value = 1;\n',
        ...PREVIOUS_LAYOUT_FILES,
    });

    const applied = await runRegisteredCommand(sandbox.path, ['apply']);

    expect(applied.exitCode).toBe(0);
    for (const path of Object.keys(PREVIOUS_LAYOUT_FILES)) expect(await isOnDisk(join(sandbox.path, path))).toBe(false);
    for (const path of CURRENT_LAYOUT_FILES) expect(await isOnDisk(join(sandbox.path, path))).toBe(true);
    expect(await isOnDisk(join(sandbox.path, '.gspot/config'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gspot/rules'))).toBe(false);
});
