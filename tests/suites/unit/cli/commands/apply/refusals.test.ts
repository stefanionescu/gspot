import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { symlink, readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { ROOT_EDITORCONFIG } from '#tests/config/commands/contents.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a broken managed block stops apply before generated files change', async () => {
    await using sandbox = await createGitSandbox({});
    const authored = `# Preserve this file
<!-- >>> gspot managed >>> -->
Unclosed instructions.
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'AGENTS.md': authored,
        'entry.sh': 'echo example\n',
    });
    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toBe(
        'AGENTS.md has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.\n',
    );
    expect(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8')).toBe(authored);
    const exists = await isOnDisk(join(sandbox.path, getManifestTarget('bash', 'shellcheckrc')));
    expect(exists).toBe(false);
});

test('apply --json prints one error object when an unowned file blocks generation', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
        '.editorconfig': ROOT_EDITORCONFIG,
    });
    const refused = await runGspot(sandbox.path, ['apply', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    const failure = JSON.parse(refused.stdout) as unknown;
    expect(failure).toStrictEqual({
        version: cliPackage.version,
        exitCode: 2,
        notes: [],
        error: 'writing',
        message: 'gspot did not overwrite these files: .editorconfig. Move them aside, then run the command again.',
    });
    expect(await readFile(join(sandbox.path, '.editorconfig'), 'utf8')).toBe(ROOT_EDITORCONFIG);
});

test('a malformed reason reports a settings error and apply preserves the authored settings', async () => {
    await using sandbox = await createGitSandbox({});
    const source = buildSandboxSettings(['site'], {
        tables: '[limits]\nfile_lines = { value = 1000, reason = 42 }\n',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': source });
    const message =
        'gspot.toml:3: limits.file_lines.reason: The value 42 is not valid for limits.file_lines.reason. Use a valid string value: Why this code needs more than the default; required when you raise the value.';
    const checked = await runGspot(sandbox.path, ['check', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(JSON.parse(checked.stdout)).toStrictEqual({
        version: cliPackage.version,
        exitCode: 2,
        notes: [],
        error: 'settings',
        message,
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stdout + applied.stderr).toBe(
        'gspot.toml:3: limits.file_lines.reason: The value 42 is not valid for limits.file_lines.reason. Use a valid string value: Why this code needs more than the default; required when you raise the value.\n',
    );
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(source);
    expect(await isOnDisk(join(sandbox.path, GSPOT_FOLDER))).toBe(false);
});

test('apply --dry-run refuses a gspot.toml that links outside the repository and writes nothing', async () => {
    const outside = 'configurations = []\n';
    await using sandbox = await testdir({ 'project/.gspot/configurations/.keep': '', outside });
    const project = join(sandbox.path, 'project');
    runGitStep(project, ['init', '--quiet']);
    await symlink(join(sandbox.path, 'outside'), join(project, 'gspot.toml'));
    const refused = await runGspot(project, ['apply', '--dry-run']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe('gspot.toml is not a regular file. Use a regular file.\n');
    expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe(outside);
});
