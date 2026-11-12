import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('settings commands resolve scope packages/api from the repository root in a subfolder', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'packages/api', configurations: [] }] }),
        'packages/api/run.sh': 'printf "example\\n"\n',
    });
    const cwd = join(sandbox.path, 'packages');
    const settingsPath = join(sandbox.path, SETTINGS_FILE);
    const added = await runGspot(cwd, ['add', 'bash', '--scope', 'packages/api']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    expect(
        parseSettings(readFileSync(settingsPath, 'utf8'), sandbox.path).scopes.get('packages/api')?.configurations,
    ).toStrictEqual(['bash']);
});

test('add bash --scope . from a subfolder is refused, and changes nothing', async () => {
    const settings = buildSandboxSettings(['bash'], { scopes: [{ path: 'packages/api', configurations: [] }] });
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'packages/api/run.sh': 'printf "example\\n"\n',
    });
    const result = await runGspot(join(sandbox.path, 'packages'), ['add', 'bash', '--scope', '.', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: '--scope takes the path from the repository root, such as services/b.',
    });
    expect(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8')).toBe(settings);
});

test('--scope . at the repository root names the root', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['set', 'limits.max_function_lines', '31', '--scope', '.']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const settings = parseSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
    expect(settings.limits.max_function_lines).toBe(31);
});
