import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { readSettings } from '#cli/settings/read.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { CONFIGURATIONS_SETTINGS } from '#tests/config/toml.ts';
import { listNpmInstallFiles } from '#tests/setup/cli/tools.ts';
import { recordNpmCommands } from '#tests/setup/system/fakes.ts';
import type { ApplyReport } from '#cli/types/generation/files.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
    expect(await isOnDisk(join(sandbox.path, getManifestTarget('bash', 'shellcheckrc')))).toBe(false);
    using npm = recordNpmCommands();
    const result = await runGspot(sandbox.path, ['add', 'bash', '--scope', 'api', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { written, removed, notes } = JSON.parse(result.stdout) as ApplyReport;
    expect({ written, removed, notes }).toStrictEqual({
        written: [
            ...BASH_CONFIG_FILE_NAMES.map((file) => getManifestTarget('bash', file)),
            GSPOT_PATHS.miseProject,
            GSPOT_PATHS.pythonProject,
        ],
        removed: [],
        notes: [TOOLS_CHANGED_NOTE],
    });
    expect(npm.commands).toStrictEqual([]);
    const saved = readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
    expect(saved.scopes.get('api')!.configurations).toStrictEqual(['bash']);
    expect(saved.configurations).toStrictEqual(['markdown']);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, getManifestTarget('bash', 'shellcheckrc')))).toBe(true);
    expect(await listNpmInstallFiles(sandbox.path)).toStrictEqual([]);
});

test('add security exits 2, names gspot set level, and writes nothing', async () => {
    await using sandbox = await createGitSandbox({
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
            stdout: json
                ? '{\n  "changed": false,\n  "summary": "No change: bash is already selected."\n}\n'
                : 'No change: bash is already selected.\n',
            stderr: '',
        });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test('add names every unknown configuration before changing the settings', async () => {
    const text = CONFIGURATIONS_SETTINGS;
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
    const settings = readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path).configurations;
    expect(settings).toStrictEqual(['bash', 'markdown']);
});

test('add names a repeated configuration once and saves it once', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['python']) });
    const result = await runGspot(sandbox.path, ['add', 'pytest', 'pytest']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.split('\n', 1)[0]).toBe('Added pytest.');
    expect(
        readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path).configurations,
    ).toStrictEqual(['python', 'pytest']);
});

test('add without names exits 2 and writes nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'main.py': 'PORT = 8080\n',
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['add']);
    expect(result).toStrictEqual({
        code: 2,
        stdout: '',
        stderr: "Missing required argument 'configuration'\n",
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('add --scope on a project folder writes its scope record', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'py/pyproject.toml': '[project]\nname = "api"\nversion = "1.0.0"\n',
        'py/main.py': 'PORT = 8080\n',
    });
    const result = await runGspot(sandbox.path, ['add', 'fastapi', '--scope', 'py']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(
        readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path).scopes.get('py')
            ?.configurations,
    ).toStrictEqual(['fastapi']);
});
