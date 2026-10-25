import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listToolInstallFiles } from '#tests/setup/cli/tools.ts';
import { recordNpmCommands } from '#tests/setup/system/fakes.ts';
import type { ApplyReport } from '#cli/types/generation/files.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { commitAll, createGitSandbox } from '#tests/setup/system/git.ts';
import { readSandboxSettings, buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    API_SCOPE_FILES,
    TOOLS_CHANGED_NOTE,
    BASH_CONFIG_FILE_NAMES,
    ALWAYS_SELECTED_RESULTS,
    UNKNOWN_CONFIGURATION_REFUSALS,
    INHERITED_CONFIGURATION_SETTINGS,
} from '#tests/config/commands/samples.ts';

test('add --scope writes the scope list and applies it without an npm install', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { scopes: [{ path: 'api', configurations: [] }] }),
        ...API_SCOPE_FILES,
    });
    commitAll(sandbox.path);
    const initial = await runGspot(sandbox.path, ['apply']);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, findManifestTarget('bash', 'shellcheckrc')))).toBe(false);
    using npm = recordNpmCommands();
    const result = await runGspot(sandbox.path, ['add', 'bash', '--scope', 'api', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { written, removed, notes } = JSON.parse(result.stdout) as ApplyReport;
    expect({ written, removed, notes }).toStrictEqual({
        written: [...BASH_CONFIG_FILE_NAMES.map((file) => findManifestTarget('bash', file)), GSPOT_PATHS.miseProject],
        removed: [],
        notes: [TOOLS_CHANGED_NOTE],
    });
    expect(npm.commands).toStrictEqual([]);
    const saved = readSandboxSettings(sandbox.path);
    expect(saved.scopes['api']!.configurations).toStrictEqual(['bash']);
    expect(saved.configurations).toStrictEqual(['markdown']);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, findManifestTarget('bash', 'shellcheckrc')))).toBe(true);
    expect(await listToolInstallFiles(sandbox.path)).toStrictEqual([]);
});

test('add security exits 2, names gspot set level, and writes nothing', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        'source.py': 'PORT = 8080\n',
    });
    const before = await readTree(sandbox.path);
    expect(await runGspot(sandbox.path, ['add', 'security'])).toStrictEqual(ALWAYS_SELECTED_RESULTS.text);
    expect(await runGspot(sandbox.path, ['add', 'security', '--json'])).toStrictEqual(ALWAYS_SELECTED_RESULTS.json);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([false, true])(
    'add reports an inherited configuration as already selected and writes nothing (json: %j)',
    async (json) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': INHERITED_CONFIGURATION_SETTINGS,
            'api/entry.sh': 'echo api\n',
        });
        const before = await readTree(sandbox.path);
        const result = await runGspot(sandbox.path, ['add', 'bash', '--scope', 'api', ...(json ? ['--json'] : [])]);
        expect(result).toStrictEqual({
            code: 0,
            stdout: json ? '{\n  "changed": false\n}\n' : 'No change: bash is already selected.\n',
            stderr: '',
        });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test('add names every unknown configuration before changing the settings', async () => {
    const text = 'configurations = []\n';
    await using sandbox = await createGitSandbox({ 'gspot.toml': text });
    const result = await runGspot(sandbox.path, ['add', 'not-a-real-config-a', 'not-a-real-config-b']);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(UNKNOWN_CONFIGURATION_REFUSALS);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(text);
});

test('add names only added configurations in a mixed request', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash']) });
    const result = await runGspot(sandbox.path, ['add', 'bash', 'markdown']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.split('\n', 1)[0]).toBe('Added markdown. bash is already selected.');
    const settings = readSandboxSettings(sandbox.path).configurations;
    expect(settings).toStrictEqual(['bash', 'markdown']);
});
