import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { git, commitAll } from '#tests/setup/git.ts';
import { rejection } from '#tests/setup/matchers.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { TOOL_FOLDERS } from '#tests/config/tools.ts';
import { openSession } from '#cli/commands/session.ts';
import { type ApplyReport } from '#cli/types/apply.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import { writePlans, openWriter } from '#cli/ownership/writer.ts';
import { EXTERNAL_INPUT_CASES } from '#tests/config/generated-files.ts';
import { rm, stat, chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { COMMITLINT_PACKAGE, COMMITLINT_PROJECT } from '#tests/config/commitlint.ts';
import { STYLELINT_FILES, STYLELINT_PACKAGE_JSON } from '#tests/config/stylelint.ts';

{
    test('apply refuses a plan whose settings changed after the session was read', async () => {
        await using sandbox = await testdir();
        const initial = settingsText([]);
        await createFileTree(sandbox.path, { 'gspot.toml': initial });
        const session = await openSession(sandbox.path);
        const edited = `level = "all"\n${initial}`;
        await Bun.write(join(sandbox.path, 'gspot.toml'), edited);
        {
            using log = openWriter(session.root);
            expect(() => writeGeneratedFiles(session, emitAll(session), log)).toThrow(
                'The gspot.toml file changed while gspot was running. Run the command again.',
            );
        }
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(edited);
        expect(await pathExists(join(sandbox.path, '.gspot/state/ownership.json'))).toBe(false);
    });
}
{
    test('generated files stay writable: apply keeps their bytes and removes them when nothing needs them', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText([], { rules: true, tables: '[rules]\nenabled = true\n' }),
        });
        {
            using log = openWriter(sandbox.path);

            writePlans(log, [
                planReplacement(log, {
                    path: '.gspot/obsolete/old.txt',
                    next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
                }),
            ]);
        }
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
        expect(applied.exitCode).toBe(0);
        expect(await pathExists(join(sandbox.path, '.gspot/obsolete/old.txt'))).toBe(false);
        expect(await pathExists(join(sandbox.path, '.gitattributes'))).toBe(true);
        const written = (applied.json as ApplyReport).written;

        const output = written.find((path) => path.endsWith('/agent/WORKING.md'))!;
        expect(output).toBeDefined();
        const bytes = await readFile(join(sandbox.path, output), 'utf8');
        const attributes = await stat(join(sandbox.path, output));
        expect(attributes.mode & 0o200).toBe(0o200);
        await chmod(join(sandbox.path, output), 0o444);
        const reapplied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
        expect(reapplied.exitCode).toBe(0);
        const refreshed = await stat(join(sandbox.path, output));
        expect(refreshed.mode & 0o200).toBe(0o200);
        expect(await readFile(join(sandbox.path, output), 'utf8')).toBe(bytes);
        await writeFile(join(sandbox.path, 'gspot.toml'), settingsText([]));
        const pruned = await applyCommand({ cwd: sandbox.path, isDryRun: false });
        expect(pruned.exitCode).toBe(0);
        expect(await pathExists(join(sandbox.path, output))).toBe(false);
    });

    test.each([...EXTERNAL_INPUT_CASES])(
        'apply --dry-run refuses an input $path that links outside the repository',
        async ({ path, outside, files, diagnostic }) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                ...files,
                'project/.gspot/config/.keep': '',
                outside,
            });
            const project = join(sandbox.path, 'project');
            await symlink(join(sandbox.path, 'outside'), join(project, path));
            expect(await rejection(applyCommand({ cwd: project, isDryRun: true }))).toContain(diagnostic);
            expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe(outside);
            expect(await pathExists(join(project, '.gspot/state/ownership.json'))).toBe(false);
        },
    );

    test('apply removes an obsolete directory link without following it', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'project/gspot.toml': settingsText([]),
            'outside/old.txt': 'outside bytes\n',
        });
        const root = join(directory.path, 'project');
        {
            using log = openWriter(root);

            writePlans(log, [
                planReplacement(log, {
                    path: '.gspot/obsolete/old.txt',
                    next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
                }),
            ]);
        }
        await rm(join(root, '.gspot/obsolete'), { recursive: true });
        await symlink('../../outside', join(root, '.gspot/obsolete'));
        expect(await applyCommand({ cwd: root, isDryRun: false })).toHaveProperty('exitCode', 0);
        expect(await pathExists(join(root, '.gspot/obsolete'))).toBe(false);
        expect(await readFile(join(directory.path, 'outside/old.txt'), 'utf8')).toBe('outside bytes\n');
    });
}
{
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
        const cloned = git(original.path, ['clone', '--quiet', '--no-local', original.path, clone.path]);
        expect(cloned.code, cloned.stderr).toBe(0);
        using files = openSafeFolder(clone.path);
        const config = '.gspot/config/shellcheckrc';
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
        const unchanged = git(clone.path, ['diff', '--exit-code']);
        expect(unchanged.code, unchanged.stdout + unchanged.stderr).toBe(0);
    });
}

test.each([...TOOL_FOLDERS])(
    'writing generated files deletes the $kind tool folder when no configuration needs it',
    async ({ folder }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': settingsText([]),
            [`${folder}/tool/index.js`]: 'export {};\n',
        });
        const session = await openSession(directory.path);
        using log = openWriter(directory.path);
        writeGeneratedFiles(session, { files: [], blocks: [], fileEdits: [], notes: [] }, log);
        expect(await pathExists(join(directory.path, folder))).toBe(false);
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
                changes: [{ path: ['commitlint'], value: { extends: './.gspot/config/commitlint.config.cjs' } }],
            },
            {
                path: 'app/child/package.json',
                changes: [{ path: ['commitlint'], value: { extends: '../../.gspot/config/commitlint.config.cjs' } }],
            },
            {
                path: 'app/package.json',
                changes: [{ path: ['commitlint'], value: { extends: '../.gspot/config/commitlint.config.cjs' } }],
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
                changes: [{ path: ['stylelint'], value: { extends: '../.stylelintrc.json' } }],
            },
        ],
    },
])('a package.json field stays when its configuration leaves: $tool', async (row) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...row.project,
        'gspot.toml': settingsText(row.configurations, { level: 'all', tables: row.tables }),
    });
    if (row.hasGit) commitAll(sandbox.path);
    let session = await openSession(sandbox.path);
    const generated = emitAll(session);
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
    const installed = await readFile(join(sandbox.path, 'app/package.json'), 'utf8');
    await writeFile(join(sandbox.path, 'app/package.json'), installed.replace('native-project', 'edited-project'));
    await writeFile(join(sandbox.path, 'gspot.toml'), settingsText([], { level: row.leaveLevel }));
    session = await openSession(sandbox.path);
    expect(emitAll(session).fileEdits).toStrictEqual([]);
    {
        using log = openWriter(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
    }
    const root = JSON.parse(await readFile(join(sandbox.path, 'package.json'), 'utf8')) as Record<string, unknown>;
    expect(root[row.tool]).toBeDefined();
    expect(await readFile(join(sandbox.path, 'app/package.json'), 'utf8')).toBe(
        installed.replace('native-project', 'edited-project'),
    );
});
