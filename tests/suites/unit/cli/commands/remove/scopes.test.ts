import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import {
    API_LANGUAGE_REASON,
    EXCLUDED_CONFIGURATION_SETTINGS,
    PARENT_REQUIREMENT_SETTINGS,
    SCOPE_REMOVALS,
} from '#tests/config/commands/edits.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { commitAll } from '#tests/setup/system/git.ts';

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
    const written = parseSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
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
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message:
            'Cannot remove javascript: typescript requires javascript. Remove typescript first, or keep javascript.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('remove reports no change for a configuration the root does not list', async () => {
    const settings = buildSandboxSettings(['typescript'], { scopes: [{ path: 'api', configurations: ['bash'] }] });
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings, 'api/entry.sh': 'echo api\n' });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        'remove',
        'bash',
        '--reason',
        'The project no longer uses Bash.',
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: false });
    expect(result.stderr).toBe('');
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
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: false });
    expect(result.stderr).toBe('');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
