import { existsSync } from 'node:fs';
import { chmod, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { installOutputSchema } from '#cli/schemas/commands.ts';
import { openFiles } from '#cli/system/files/open.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { FORMAT_SETTINGS, PRETTIER_PATH_IGNORE } from '#tests/config/commands/edits.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { getManifestTarget, getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';

test('install leaves generated files writable, keeps their bytes, and deletes a stray owned file and its folder', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
    });

    await createFileTree(sandbox.path, { [`${GSPOT_FOLDER}/obsolete/old.txt`]: 'installed\n' });
    const applied = await runGspot(sandbox.path, ['install', '--json']);
    expect(applied.code).toBe(0);
    expect(installOutputSchema.parse(JSON.parse(applied.stdout)).deleted).toContain(`${GSPOT_FOLDER}/obsolete/old.txt`);
    expect(existsSync(join(sandbox.path, `${GSPOT_FOLDER}/obsolete/old.txt`))).toBe(false);
    expect(existsSync(join(sandbox.path, `${GSPOT_FOLDER}/obsolete`))).toBe(false);
    expect(existsSync(join(sandbox.path, '.gitattributes'))).toBe(true);
    const rulePath = getRuleFilePath('engineering', 'WORKING.md');
    const bytes = await readFile(join(sandbox.path, rulePath), 'utf8');
    const attributes = await stat(join(sandbox.path, rulePath));
    expect(attributes.mode & 0o200).toBe(0o200);
    await chmod(join(sandbox.path, rulePath), 0o444);
    const reapplied = await runGspot(sandbox.path, ['install']);
    expect(reapplied.code).toBe(0);
    const refreshed = await stat(join(sandbox.path, rulePath));
    expect(refreshed.mode & 0o200).toBe(0o200);
    expect(await readFile(join(sandbox.path, rulePath), 'utf8')).toBe(bytes);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([]));
    const pruned = await runGspot(sandbox.path, ['install']);
    expect(pruned.code).toBe(0);
    expect(pruned.stdout).toMatch(/removed\s+\d+ generated files in \.gspot\//u);
    expect(pruned.stdout).not.toContain(rulePath);
    expect(existsSync(join(sandbox.path, rulePath))).toBe(false);
});

test('install removes a stray link to a folder without following it', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({
        'project/gspot.toml': buildSandboxSettings([]),
        'outside/old.txt': 'outside bytes\n',
    });

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '--quiet']);
    await createFileTree(root, { [`${GSPOT_FOLDER}/obsolete/old.txt`]: 'installed\n' });
    await rm(join(root, `${GSPOT_FOLDER}/obsolete`), { recursive: true });
    await symlink('../../outside', join(root, `${GSPOT_FOLDER}/obsolete`));
    expect(await runGspot(root, ['install'])).toHaveProperty('code', 0);
    expect(existsSync(join(root, `${GSPOT_FOLDER}/obsolete`))).toBe(false);
    expect(await readFile(join(sandbox.path, 'outside/old.txt'), 'utf8')).toBe('outside bytes\n');
});

test('a fresh Git clone keeps the committed generated files byte for byte and mode for mode', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using original = await testdir();
    await using clone = await testdir();
    await createFileTree(original.path, { 'entry.sh': 'echo example\n' });
    commitAll(original.path);
    const initialized = await runGspot(original.path, ['init', '--configurations', 'bash']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const reconciled = await runGspot(original.path, ['install', '--json']);
    expect(reconciled.code, reconciled.stdout + reconciled.stderr).toBe(0);
    commitAll(original.path);
    const cloned = runBlockingCommand(['git', 'clone', '--quiet', '--no-local', original.path, clone.path], {
        cwd: original.path,
        env: {},
    });
    expect(cloned.code, cloned.stderr).toBe(0);
    const files = openFiles(clone.path);
    const config = getManifestTarget('bash', 'shellcheckrc');
    const initial = files.read(config)!;
    const applied = await runGspot(clone.path, ['install', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(
        installOutputSchema.parse(JSON.parse(applied.stdout)).notes.filter((note) => note.includes('shellcheckrc')),
    ).toStrictEqual([]);
    const restored = files.read(config)!;
    expect(restored.bytes).toStrictEqual(initial.bytes);
    expect(restored.mode).toBe(initial.mode);
    const repeated = await runGspot(clone.path, ['install', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(installOutputSchema.parse(JSON.parse(repeated.stdout)).written).toStrictEqual([]);
    const unchanged = runBlockingCommand(['git', 'diff', '--exit-code'], { cwd: clone.path, env: {} });
    expect(unchanged.code, unchanged.stdout + unchanged.stderr).toBe(0);
});

test('removing rules from a fresh clone removes the managed AGENTS.md block', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({});
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    const authored = '# Your instructions\n';
    await createFileTree(source, { 'gspot.toml': buildSandboxSettings([], { rules: true }), 'AGENTS.md': authored });
    commitAll(source);
    expect(await runGspot(source, ['install'])).toHaveProperty('code', 0);
    commitAll(source);
    runGitStep(sandbox.path, ['clone', '--quiet', source, checkout]);
    expect(await runGspot(checkout, ['install'])).toHaveProperty('code', 0);
    await writeFile(join(checkout, 'gspot.toml'), buildSandboxSettings([]));
    const removed = await runGspot(checkout, ['install', '--json']);
    expect(removed.code).toBe(0);
    const report = installOutputSchema.parse(JSON.parse(removed.stdout));
    expect(report.updated).toContain('AGENTS.md');
    expect(report.deleted).not.toContain('AGENTS.md');
    expect(await readFile(join(checkout, 'AGENTS.md'), 'utf8')).toBe(authored);
});

test('an ignore of every path skips the check and keeps its configured tool and files', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ 'gspot.toml': FORMAT_SETTINGS, 'sample.json': '{"value":1}\n' });
    const initial = await runGspot(sandbox.path, ['install', '--json']);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    await writeFile(join(sandbox.path, 'gspot.toml'), FORMAT_SETTINGS + PRETTIER_PATH_IGNORE);
    const removed = await runGspot(sandbox.path, ['install', '--json']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const report = installOutputSchema.parse(JSON.parse(removed.stdout));
    expect(report.written).toStrictEqual(['.prettierignore']);
    expect(await readFile(join(sandbox.path, '.prettierignore'), 'utf8')).toContain('**/*.json');
    expect(report.deleted).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toContain('prettier');
    const generated = join(sandbox.path, getManifestTarget('format', 'prettier.json'));
    expect(existsSync(generated)).toBe(true);
    expect(existsSync(join(sandbox.path, 'prettier.config.mjs'))).toBe(true);
    const checked = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'format/prettier', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([{ check: 'format/prettier', status: 'skipped', cause: 'ignore' }]);
    const repeated = await runGspot(sandbox.path, ['install', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    const settled = installOutputSchema.parse(JSON.parse(repeated.stdout));
    expect(settled.unchanged.filter((path) => path === '.prettierignore')).toStrictEqual(['.prettierignore']);
    expect({ written: settled.written, deleted: settled.deleted }).toStrictEqual({ written: [], deleted: [] });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(FORMAT_SETTINGS + PRETTIER_PATH_IGNORE);
    expect(await readFile(join(sandbox.path, 'sample.json'), 'utf8')).toBe('{"value":1}\n');
});
