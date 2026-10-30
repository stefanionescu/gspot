import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { readSettings } from '#cli/settings/read.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { listNpmInstallFiles } from '#tests/setup/cli/tools.ts';
import { recordNpmCommands } from '#tests/setup/system/fakes.ts';
import type { ApplyReport } from '#cli/types/generation/files.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { API_SCOPE_FILES, TOOLS_CHANGED_NOTE, BASH_CONFIG_FILE_NAMES } from '#tests/config/commands/samples.ts';

import {
    SCOPE_REMOVALS,
    API_LANGUAGE_REASON,
    PARENT_REQUIREMENT_SETTINGS,
    EXCLUDED_CONFIGURATION_SETTINGS,
} from '#tests/config/commands/remove.ts';

test.each([...SCOPE_REMOVALS])('remove bash --scope $scope: $name', async ({ settings, files, scope, expected }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings, ...files });
    const result = await runGspot(sandbox.path, [
        'remove',
        'bash',
        '--scope',
        scope,
        '--reason',
        API_LANGUAGE_REASON,
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: true });
    const written = readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
    expect({ ...written, scopes: Object.fromEntries(written.scopes) }).toMatchObject(expected);
});

test('remove refuses a dependency required by a parent configuration and leaves all files unchanged', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': PARENT_REQUIREMENT_SETTINGS,
        'api/entry.ts': 'export const VALUE = 1;\n',
        'api/child/entry.sh': 'echo child\n',
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        'remove',
        'javascript',
        '--scope',
        'api/child',
        '--reason',
        API_LANGUAGE_REASON,
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toStrictEqual({
        version: cliPackage.version,
        exitCode: 2,
        notes: [],
        error: 'arguments',
        message:
            'Cannot remove javascript: typescript requires javascript. Remove typescript first, or keep javascript.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('remove --scope writes removed_configurations with its reason and applies it without an npm install', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { scopes: [{ path: 'api', configurations: ['bash'] }] }),
        ...API_SCOPE_FILES,
    });
    commitAll(sandbox.path);
    const initial = await runGspot(sandbox.path, ['apply']);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, getManifestTarget('bash', 'shellcheckrc')))).toBe(true);
    using npm = recordNpmCommands();
    const reason = 'The API scope no longer uses Bash.';
    const result = await runGspot(sandbox.path, ['remove', 'bash', '--scope', 'api', '--reason', reason, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { written, removed, notes } = JSON.parse(result.stdout) as ApplyReport;
    expect({ written, removed, notes }).toStrictEqual({
        written: [GSPOT_PATHS.miseProject, GSPOT_PATHS.pythonProject],
        removed: BASH_CONFIG_FILE_NAMES.map((file) => getManifestTarget('bash', file)),
        notes: [TOOLS_CHANGED_NOTE],
    });
    expect(npm.commands).toStrictEqual([]);
    const saved = readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
    expect(saved.scopes.get('api')!.configurations).toStrictEqual([]);
    expect(saved.configurations).toStrictEqual(['markdown']);
    const contents = (parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable)['scope'];
    expect(contents).toStrictEqual([{ path: 'api', configurations: [], removed_configurations: { bash: reason } }]);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, getManifestTarget('bash', 'shellcheckrc')))).toBe(false);
    expect(await listNpmInstallFiles(sandbox.path)).toStrictEqual([]);
});

test('remove reports no change for a configuration the root does not list', async () => {
    const settings = buildSandboxSettings(['typescript'], { scopes: [{ path: 'api', configurations: ['bash'] }] });
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings, 'api/entry.sh': 'echo api\n' });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const message = 'No change: bash is not selected.';
    const commandArguments = ['remove', 'bash', '--reason', 'The project no longer uses Bash.'];
    const result = await runGspot(sandbox.path, commandArguments);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toBe(`${message}\n`);
    expect(result.stderr).toBe('');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...commandArguments, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        version: cliPackage.version,
        exitCode: 0,
        notes: [],
        changed: false,
        summary: 'No change: bash is not selected.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('remove checks requirements against the scope selection', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': EXCLUDED_CONFIGURATION_SETTINGS,
        'api/entry.sh': 'echo api\n',
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        'remove',
        'javascript',
        '--scope',
        'api',
        '--reason',
        'The API scope does not use JavaScript.',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toBe('No change: javascript is not selected.\n');
    expect(result.stderr).toBe('');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
