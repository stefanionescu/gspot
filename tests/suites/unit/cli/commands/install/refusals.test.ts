import { existsSync } from 'node:fs';
import { readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { ROOT_EDITORCONFIG } from '#tests/config/commands/reports.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('a broken managed block stops install before generated files change', async () => {
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
    const refused = await runGspot(sandbox.path, ['install']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toBe(
        'AGENTS.md has incomplete or repeated gspot block markers. Fix the markers, then run gspot install.\n',
    );
    expect(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8')).toBe(authored);
    const generated = join(sandbox.path, getManifestTarget('bash', 'shellcheckrc'));
    expect(existsSync(generated)).toBe(false);
});

test('install --json prints one error object when an unowned file blocks generation', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
        '.editorconfig': ROOT_EDITORCONFIG,
    });
    const refused = await runGspot(sandbox.path, ['install', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({
        error: 'writing',
        message: expect.stringContaining('.editorconfig') as string,
    });
    expect(await readFile(join(sandbox.path, '.editorconfig'), 'utf8')).toBe(ROOT_EDITORCONFIG);
});

test('a malformed reason reports a settings error and install preserves the authored settings', async () => {
    await using sandbox = await createGitSandbox({});
    const source = buildSandboxSettings(['site'], {
        tables: '[limits]\nmax_file_lines = { value = 1000, reason = 42 }\n',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': source });
    const applied = await runGspot(sandbox.path, ['install', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(JSON.parse(applied.stdout)).toMatchObject({
        error: 'settings',
        message: expect.stringContaining('gspot.toml:3: limits.max_file_lines.reason') as string,
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(source);
    expect(existsSync(join(sandbox.path, GSPOT_FOLDER))).toBe(false);
});

test('install refuses a gspot.toml that links outside the repository and writes nothing', async () => {
    const outside = 'configurations = []\n';
    await using sandbox = await testdir({ 'project/.gspot/configurations/.keep': '', outside });
    const project = join(sandbox.path, 'project');
    runGitStep(project, ['init', '--quiet']);
    await symlink(join(sandbox.path, 'outside'), join(project, 'gspot.toml'));
    const refused = await runGspot(project, ['install', '--json']);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'filesystem' });
    expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe(outside);
});
