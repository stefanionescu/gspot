import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { readSettings } from '#cli/settings/read.ts';
import type { ApplyReport } from '#cli/types/apply.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { recordNpmCommands } from '#tests/setup/system/fakes.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    API_BASH_FILES,
    TOOLS_CHANGED_NOTE,
    ALWAYS_SELECTED_RESULTS,
    UNKNOWN_CONFIGURATION_REFUSALS,
    INHERITED_CONFIGURATION_SETTINGS,
} from '#tests/data/commands/configurations.ts';

test('add --scope writes the scope list and applies it without an npm install', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['markdown'], { scopes: [{ path: 'api', configurations: [] }] }),
        'README.md': '# Example\n',
        'api/entry.sh': 'echo api\n',
    });
    commitAll(sandbox.path);
    const initial = await runGspot(sandbox.path, ['apply']);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/language/bash/shellcheckrc'))).toBe(false);
    using npm = recordNpmCommands();
    const result = await runGspot(sandbox.path, ['add', 'bash', '--scope', 'api', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { written, removed, notes } = JSON.parse(result.stdout) as ApplyReport;
    expect({ written, removed, notes }).toStrictEqual({
        written: [...API_BASH_FILES, '.gspot/mise.toml'],
        removed: [],
        notes: [TOOLS_CHANGED_NOTE],
    });
    expect(npm.installations).toStrictEqual([]);
    const saved = readSettings(sandbox.path).settings;
    expect(saved.scopes['api']!.configurations).toStrictEqual(['bash']);
    expect(saved.configurations).toStrictEqual(['markdown']);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/language/bash/shellcheckrc'))).toBe(true);
    expect(await isOnDisk(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gspot/package-lock.json'))).toBe(false);
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
        await using sandbox = await testdir({
            'gspot.toml': INHERITED_CONFIGURATION_SETTINGS,
            'api/entry.sh': 'echo api\n',
        });
        const before = await readTree(sandbox.path);
        const result = await runGspot(sandbox.path, ['add', 'bash', '--scope', 'api', ...(json ? ['--json'] : [])]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stderr).toBe('');
        if (json) expect(JSON.parse(result.stdout)).toStrictEqual({ changed: false });
        else expect(result.stdout).toBe('No change: bash is already selected.\n');
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test('add names every unknown configuration before changing the settings', async () => {
    const text = 'configurations = []\n';
    await using sandbox = await testdir({ 'gspot.toml': text });
    const result = await runGspot(sandbox.path, ['add', 'not-a-real-config-a', 'not-a-real-config-b']);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(UNKNOWN_CONFIGURATION_REFUSALS);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(text);
});

test('add bash --scope api reports no change when the root already selects bash', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { scopes: [{ path: 'api' }] }),
        'api/entry.sh': 'echo api\n',
    });
    const before = await readTree(sandbox.path);
    expect(await runGspot(sandbox.path, ['add', 'bash', '--scope', 'api'])).toStrictEqual({
        code: 0,
        stdout: 'No change: bash is already selected.\n',
        stderr: '',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
