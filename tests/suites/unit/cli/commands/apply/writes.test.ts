import * as fs from 'node:fs';
import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { generate } from '#cli/generation/generate.ts';
import { type ApplyReport } from '#cli/types/apply.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { planReplacement } from '#cli/apply/write-plans.ts';
import { openWriter, writePlans } from '#cli/apply/writer.ts';
import { writeGeneratedFiles } from '#cli/apply/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { runGit, commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runGspot, buildInitArguments } from '#tests/setup/cli/commands.ts';
import { rm, stat, chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { findFileTarget, findRuleFileTarget } from '#tests/setup/cli/config-files.ts';
import { FORMAT_SETTINGS, PRETTIER_PATH_IGNORE } from '#tests/config/commands/apply/writes.ts';
import { SETTINGS_FILE, SCHEMA_DIRECTIVE, SCHEMA_DIRECTIVE_LINE } from '#cli/config/settings/file.ts';

function writeStrayFile(root: string): void {
    using writer = openWriter(root);

    writePlans(writer, [
        planReplacement(writer, {
            path: `${DOT_GSPOT}/obsolete/old.txt`,
            next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
        }),
    ]);
}

test('apply leaves generated files writable, keeps their bytes, and deletes a stray owned file and its folder', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: '[rules]\nenabled = true\n' }),
    });

    writeStrayFile(sandbox.path);
    runGitStep(sandbox.path, ['init', '-q']);
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code).toBe(0);
    expect(await isOnDisk(join(sandbox.path, `${DOT_GSPOT}/obsolete/old.txt`))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, `${DOT_GSPOT}/obsolete`))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gitattributes'))).toBe(true);
    const written = (JSON.parse(applied.stdout) as ApplyReport).written;
    const rulePath = findRuleFileTarget('engineering', 'WORKING.md');
    expect(written).toContain(rulePath);
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
    expect(await isOnDisk(join(sandbox.path, rulePath))).toBe(false);
});
test('apply removes a stray directory link without following it', async () => {
    await using sandbox = await testdir({
        'project/gspot.toml': buildSandboxSettings([]),
        'outside/old.txt': 'outside bytes\n',
    });

    const root = join(sandbox.path, 'project');
    writeStrayFile(root);
    await rm(join(root, `${DOT_GSPOT}/obsolete`), { recursive: true });
    await symlink('../../outside', join(root, `${DOT_GSPOT}/obsolete`));
    expect(await runGspot(root, ['apply'])).toHaveProperty('code', 0);
    expect(await isOnDisk(join(root, `${DOT_GSPOT}/obsolete`))).toBe(false);
    expect(await readFile(join(sandbox.path, 'outside/old.txt'), 'utf8')).toBe('outside bytes\n');
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
    const config = findFileTarget('bash', 'shellcheckrc');
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
test('apply rewrites an edited generated file, deletes unknown files in .gspot, and leaves gspot.toml as it was', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['bash']), 'entry.sh': 'echo example\n' });

    commitAll(sandbox.path);
    const initial = await runGspot(sandbox.path, ['apply']);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    const settingsPath = join(sandbox.path, 'gspot.toml');
    const settings = await readFile(settingsPath, 'utf8');
    await writeFile(join(sandbox.path, 'added.py'), 'print("example")\n');
    const generated = join(sandbox.path, findFileTarget('bash', 'shellcheckrc'));
    const edited = `${await readFile(generated, 'utf8')}# Authored after installation.\n`;
    await chmod(generated, 0o644);
    await writeFile(generated, edited);
    await writeFile(join(sandbox.path, `${DOT_GSPOT}/authored.txt`), 'Preserve this file.\n');
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await readFile(generated, 'utf8')).not.toContain('# Authored after installation.');
    expect(await isOnDisk(join(sandbox.path, `${DOT_GSPOT}/authored.txt`))).toBe(false);
    expect(await readFile(settingsPath, 'utf8')).toBe(settings);
});
test('removing rules from a fresh clone removes the managed AGENTS.md block', async () => {
    await using sandbox = await testdir();
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
    expect(await runGspot(checkout, ['apply'])).toHaveProperty('code', 0);
    expect(await readFile(join(checkout, 'AGENTS.md'), 'utf8')).toBe(authored);
});
test('a check ignored on all its paths leaves the plan, the needed tools, and its generated files', async () => {
    await using sandbox = await testdir({ 'gspot.toml': FORMAT_SETTINGS, 'sample.json': '{"value":1}\n' });

    const initial = await openSession(sandbox.path);
    using writer = openWriter(initial.root);
    writeGeneratedFiles(initial, generate(initial), writer);
    expect(await isOnDisk(join(sandbox.path, '.prettierignore'))).toBe(true);
    expect(await isOnDisk(join(sandbox.path, findFileTarget('format', 'prettier.json')))).toBe(true);
    await writeFile(join(sandbox.path, 'gspot.toml'), FORMAT_SETTINGS + PRETTIER_PATH_IGNORE);
    const excluded = await openSession(sandbox.path);
    const plans = planChecks(excluded, { stage: 'commit', only: ['format/prettier'] });
    expect(plans[0]?.skip?.cause).toBe('ignore');
    expect(excluded.configuredChecks.map((check) => check.check.id)).not.toContain('format/prettier');
    expect(
        excluded.neededToolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
    ).not.toContain('prettier');
    const generated = generate(excluded);
    expect(generated.files.map((file) => file.path)).not.toContain(findFileTarget('format', 'prettier.json'));
    const removed = writeGeneratedFiles(excluded, generated, writer);
    expect(removed.removed).toContain('.prettierignore');
    expect(await isOnDisk(join(sandbox.path, '.prettierignore'))).toBe(false);
    const settled = await openSession(sandbox.path);
    expect(settled.configuredChecks.map((check) => check.check.id)).not.toContain('format/prettier');
    const repeated = writeGeneratedFiles(settled, generate(settled), writer);
    expect(repeated.written).toStrictEqual([]);
    expect(repeated.removed).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(FORMAT_SETTINGS + PRETTIER_PATH_IGNORE);
    expect(await readFile(join(sandbox.path, 'sample.json'), 'utf8')).toBe('{"value":1}\n');
});
test('a failed version pin write in apply leaves the old version', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        [GSPOT_PATHS.versionPin]: '0.0.1\n',
    });

    const rename = fs.renameSync;
    using _failed = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(sandbox.path, GSPOT_PATHS.versionPin)) throw new Error('Pin write denied');
        rename(source, target);
    });

    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe(
        'gspot stopped because of an internal error: Pin write denied. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.\n',
    );
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.versionPin), 'utf8')).toBe('0.0.1\n');
});
test('apply puts the schema directive first in a gspot.toml without one, then leaves the file alone', async () => {
    const settings = buildSandboxSettings([]).replace(SCHEMA_DIRECTIVE_LINE, '');
    await using sandbox = await testdir({ [SETTINGS_FILE]: settings });

    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect((JSON.parse(applied.stdout) as ApplyReport).updated).toStrictEqual([SETTINGS_FILE]);
    expect(await readFile(join(sandbox.path, SETTINGS_FILE), 'utf8')).toBe(`${SCHEMA_DIRECTIVE}\n${settings}`);
    const repeated = await runGspot(sandbox.path, ['apply', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as ApplyReport).updated).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, SETTINGS_FILE), 'utf8')).toBe(`${SCHEMA_DIRECTIVE}\n${settings}`);
});
