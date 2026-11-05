import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each(['packages/api'])(
    'settings commands resolve scope %s from the repository root in a subfolder',
    async (scope) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'packages/api', configurations: [] }] }),
            'packages/api/run.sh': 'printf "example\\n"\n',
        });
        const cwd = join(sandbox.path, 'packages');
        const settingsPath = join(sandbox.path, SETTINGS_FILE);
        const added = await runGspot(cwd, ['add', 'bash', '--scope', scope]);
        expect(added.code, added.stdout + added.stderr).toBe(0);
        expect(
            readSettings(readFileSync(settingsPath, 'utf8'), sandbox.path).scopes.get('packages/api')?.configurations,
        ).toStrictEqual(['bash']);
        const set = await runGspot(cwd, ['set', 'limits.max_function_lines', '30', '--scope', scope]);
        expect(set.code, set.stdout + set.stderr).toBe(0);
        expect(
            readSettings(readFileSync(settingsPath, 'utf8'), sandbox.path).scopes.get('packages/api')?.limits
                ?.max_function_lines,
        ).toBe(30);
        const unset = await runGspot(cwd, ['unset', 'limits.max_function_lines', '--scope', scope]);
        expect(unset.code, unset.stdout + unset.stderr).toBe(0);
        expect(
            readSettings(readFileSync(settingsPath, 'utf8'), sandbox.path).scopes.get('packages/api')?.limits
                ?.max_function_lines,
        ).toBeUndefined();
        const removed = await runGspot(cwd, [
            'remove',
            'bash',
            '--scope',
            scope,
            '--reason',
            'The scope no longer contains shell scripts.',
        ]);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(
            readSettings(readFileSync(settingsPath, 'utf8'), sandbox.path).scopes.get('packages/api')?.configurations,
        ).toStrictEqual([]);
        expect(
            readSettings(readFileSync(settingsPath, 'utf8'), sandbox.path).scopes.get('packages/api')
                ?.removed_configurations,
        ).toStrictEqual(['bash']);
    },
);

test.each([
    { commandArguments: ['add', 'bash', '--scope', '.'] },
    { commandArguments: ['remove', 'bash', '--reason', 'The scope holds no shell scripts.', '--scope', '.'] },
    { commandArguments: ['set', 'limits.max_function_lines', '31', '--scope', '.'] },
    { commandArguments: ['set', 'limits.max_function_lines', '31', '--scope', '../packages/api'] },
    { commandArguments: ['unset', 'limits.max_function_lines', '--scope', '.'] },
])('$commandArguments from a subfolder is refused, and changes nothing', async ({ commandArguments }) => {
    const settings = buildSandboxSettings(['bash'], { scopes: [{ path: 'packages/api', configurations: [] }] });
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'packages/api/run.sh': 'printf "example\\n"\n',
    });
    const result = await runGspot(join(sandbox.path, 'packages'), [...commandArguments, '--json']);
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
    const settings = readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
    expect(settings.limits.max_function_lines).toBe(31);
});
