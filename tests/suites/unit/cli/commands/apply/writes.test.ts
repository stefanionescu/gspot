import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openFiles } from '#cli/system/files/open.ts';
import { SETTINGS_FILE } from '#cli/config/settings/settings.ts';
import { type ApplyReport } from '#cli/types/generation/files.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { UPDATED_AGENTS } from '#tests/config/commands/contents.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { rm, stat, chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { getRuleFilePath, getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { TOOLS_CHANGED_NOTE, STALE_LOCKFILE_NOTE } from '#cli/config/generation/generation.ts';

import {
    FORMAT_SETTINGS,
    PRETTIER_PATH_IGNORE,
    PRETTIER_ADDED_IGNORE,
    PRETTIER_INITIAL_IGNORE,
} from '#tests/config/commands/apply.ts';

test('apply leaves generated files writable, keeps their bytes, and deletes a stray owned file and its folder', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
    });

    await createFileTree(sandbox.path, { [`${GSPOT_FOLDER}/obsolete/old.txt`]: 'installed\n' });
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code).toBe(0);
    expect((JSON.parse(applied.stdout) as ApplyReport).removed).toContain(`${GSPOT_FOLDER}/obsolete/old.txt`);
    expect(await isOnDisk(join(sandbox.path, `${GSPOT_FOLDER}/obsolete/old.txt`))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, `${GSPOT_FOLDER}/obsolete`))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gitattributes'))).toBe(true);
    const rulePath = getRuleFilePath('engineering', 'WORKING.md');
    const bytes = await readFile(join(sandbox.path, rulePath), 'utf8');
    const attributes = await stat(join(sandbox.path, rulePath));
    expect(attributes.mode & 0o200).toBe(0o200);
    await chmod(join(sandbox.path, rulePath), 0o444);
    const reapplied = await runGspot(sandbox.path, ['apply']);
    expect(reapplied.code).toBe(0);
    const refreshed = await stat(join(sandbox.path, rulePath));
    expect(refreshed.mode & 0o200).toBe(0o200);
    expect(await readFile(join(sandbox.path, rulePath), 'utf8')).toBe(bytes);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([]));
    const pruned = await runGspot(sandbox.path, ['apply']);
    expect(pruned.code).toBe(0);
    expect(pruned.stdout).toContain(`removed  ${rulePath}`);
    expect(await isOnDisk(join(sandbox.path, rulePath))).toBe(false);
});

test('apply removes a stray link to a folder without following it', async () => {
    await using sandbox = await testdir({
        'project/gspot.toml': buildSandboxSettings([]),
        'outside/old.txt': 'outside bytes\n',
    });

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '--quiet']);
    await createFileTree(root, { [`${GSPOT_FOLDER}/obsolete/old.txt`]: 'installed\n' });
    await rm(join(root, `${GSPOT_FOLDER}/obsolete`), { recursive: true });
    await symlink('../../outside', join(root, `${GSPOT_FOLDER}/obsolete`));
    expect(await runGspot(root, ['apply'])).toHaveProperty('code', 0);
    expect(await isOnDisk(join(root, `${GSPOT_FOLDER}/obsolete`))).toBe(false);
    expect(await readFile(join(sandbox.path, 'outside/old.txt'), 'utf8')).toBe('outside bytes\n');
});

test('a fresh Git clone keeps the committed generated files byte for byte and mode for mode', async () => {
    await using original = await testdir();
    await using clone = await testdir();
    await createFileTree(original.path, { 'entry.sh': 'echo example\n' });
    commitAll(original.path);
    const initialized = await runGspot(original.path, ['init', '--yes', '--configurations', 'bash']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const reconciled = await runGspot(original.path, ['apply', '--json']);
    expect(reconciled.code, reconciled.stdout + reconciled.stderr).toBe(0);
    commitAll(original.path);
    const cloned = runCommandBlocking(['git', 'clone', '--quiet', '--no-local', original.path, clone.path], {
        cwd: original.path,
        env: {},
    });
    expect(cloned.code, cloned.stderr).toBe(0);
    const files = openFiles(clone.path);
    const config = getManifestTarget('bash', 'shellcheckrc');
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
    const unchanged = runCommandBlocking(['git', 'diff', '--exit-code'], { cwd: clone.path, env: {} });
    expect(unchanged.code, unchanged.stdout + unchanged.stderr).toBe(0);
});

test('apply rewrites an edited generated file, deletes unknown files in .gspot, and leaves gspot.toml as it was', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['bash']), 'entry.sh': 'echo example\n' });

    commitAll(sandbox.path);
    const initial = await runGspot(sandbox.path, ['apply']);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    const settingsPath = join(sandbox.path, 'gspot.toml');
    const settings = await readFile(settingsPath, 'utf8');
    await writeFile(join(sandbox.path, 'added.py'), 'print("example")\n');
    const generated = join(sandbox.path, getManifestTarget('bash', 'shellcheckrc'));
    const edited = `${await readFile(generated, 'utf8')}# Authored after installation.\n`;
    await chmod(generated, 0o644);
    await writeFile(generated, edited);
    await writeFile(join(sandbox.path, `${GSPOT_FOLDER}/authored.txt`), 'Preserve this file.\n');
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await readFile(generated, 'utf8')).not.toContain('# Authored after installation.');
    expect(await isOnDisk(join(sandbox.path, `${GSPOT_FOLDER}/authored.txt`))).toBe(false);
    expect(await readFile(settingsPath, 'utf8')).toBe(settings);
});

test('removing rules from a fresh clone removes the managed AGENTS.md block', async () => {
    await using sandbox = await createGitSandbox({});
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    const authored = '# Your instructions\n';
    await createFileTree(source, { 'gspot.toml': buildSandboxSettings([], { rules: true }), 'AGENTS.md': authored });
    commitAll(source);
    expect(await runGspot(source, ['apply'])).toHaveProperty('code', 0);
    commitAll(source);
    runGitStep(sandbox.path, ['clone', '--quiet', source, checkout]);
    expect(await runGspot(checkout, ['apply'])).toHaveProperty('code', 0);
    await writeFile(join(checkout, 'gspot.toml'), buildSandboxSettings([]));
    const removed = await runGspot(checkout, ['apply']);
    expect(removed.code).toBe(0);
    expect(removed.stdout).toContain(UPDATED_AGENTS);
    expect(removed.stdout).not.toContain('removed  AGENTS.md');
    expect(await readFile(join(checkout, 'AGENTS.md'), 'utf8')).toBe(authored);
});

test('apply counts the generated files in .gspot/ and names each file it writes outside it', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': FORMAT_SETTINGS, 'sample.json': '{"value":1}\n' });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const tree = await readTree(join(sandbox.path, GSPOT_FOLDER));
    const gspotFiles = Object.values(tree).filter((description) => description.includes(':file:'));
    expect(applied.stdout.split('\n').filter((line) => line.startsWith('wrote '))).toStrictEqual([
        `wrote    ${String(gspotFiles.length)} generated files in .gspot/`,
        'wrote    .editorconfig',
        'wrote    .prettierignore',
        'wrote    prettier.config.mjs',
    ]);
});

test('an ignore of every path skips the check and keeps its configured tool and files', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': FORMAT_SETTINGS, 'sample.json': '{"value":1}\n' });
    const initial = await runGspot(sandbox.path, ['apply', '--json']);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, '.prettierignore'), 'utf8')).toBe(PRETTIER_INITIAL_IGNORE);
    await writeFile(join(sandbox.path, 'gspot.toml'), FORMAT_SETTINGS + PRETTIER_PATH_IGNORE);
    const removed = await runGspot(sandbox.path, ['apply', '--json']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const report = JSON.parse(removed.stdout) as ApplyReport;
    expect(report.written).toStrictEqual(['.prettierignore']);
    expect(await readFile(join(sandbox.path, '.prettierignore'), 'utf8')).toBe(
        PRETTIER_INITIAL_IGNORE + PRETTIER_ADDED_IGNORE,
    );
    expect(report.removed).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toContain('prettier');
    expect(await isOnDisk(join(sandbox.path, getManifestTarget('format', 'prettier.json')))).toBe(true);
    expect(await isOnDisk(join(sandbox.path, 'prettier.config.mjs'))).toBe(true);
    const checked = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'format/prettier', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([{ check: 'format/prettier', status: 'skipped', cause: 'ignore' }]);
    const repeated = await runGspot(sandbox.path, ['apply', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    const settled = JSON.parse(repeated.stdout) as ApplyReport;
    expect(settled.unchanged.filter((path) => path === '.prettierignore')).toStrictEqual(['.prettierignore']);
    expect(await readFile(join(sandbox.path, '.prettierignore'), 'utf8')).toBe(
        PRETTIER_INITIAL_IGNORE + PRETTIER_ADDED_IGNORE,
    );
    expect({ written: settled.written, removed: settled.removed }).toStrictEqual({ written: [], removed: [] });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(FORMAT_SETTINGS + PRETTIER_PATH_IGNORE);
    expect(await readFile(join(sandbox.path, 'sample.json'), 'utf8')).toBe('{"value":1}\n');
});

test('apply leaves a settings file without a schema directive unchanged', async () => {
    const settings = buildSandboxSettings([]);
    await using sandbox = await createGitSandbox({ [SETTINGS_FILE]: settings });

    const preview = await runGspot(sandbox.path, ['apply', '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, SETTINGS_FILE), 'utf8')).toBe(settings);
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect((JSON.parse(applied.stdout) as ApplyReport).updated).not.toContain(SETTINGS_FILE);
    expect(await readFile(join(sandbox.path, SETTINGS_FILE), 'utf8')).toBe(settings);
    const repeated = await runGspot(sandbox.path, ['apply', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as ApplyReport).updated).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, SETTINGS_FILE), 'utf8')).toBe(settings);
});

test('repeated apply names a missing lockfile without reporting changed tools', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true}',
    });
    const first = await runGspot(sandbox.path, ['apply', '--json']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect((JSON.parse(first.stdout) as ApplyReport).notes).toContain(TOOLS_CHANGED_NOTE);
    const repeated = await runGspot(sandbox.path, ['apply', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as ApplyReport).notes).toStrictEqual([STALE_LOCKFILE_NOTE]);
});

test('apply restores a committed .gitattributes that was deleted, as it restores AGENTS.md', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'entry.sh': 'echo example\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    commitAll(sandbox.path);
    const attributes = await readFile(join(sandbox.path, '.gitattributes'), 'utf8');
    const agents = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    await rm(join(sandbox.path, '.gitattributes'));
    await rm(join(sandbox.path, 'AGENTS.md'));
    const restored = await runGspot(sandbox.path, ['apply']);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, '.gitattributes'), 'utf8')).toBe(attributes);
    expect(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8')).toBe(agents);
});
