import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import { getTable } from '#cli/settings/tables.ts';
import { INHERITED_CONFIGURATION_SETTINGS } from '#tests/config/commands/edits.ts';
import { assertRefusalWithoutWrites, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { commitAll } from '#tests/setup/system/git.ts';

test('add selects a configuration whose table stops every other command', async () => {
    const text = '[licenses]\nallowed = ["MIT"]\n';
    await using sandbox = await createGitSandbox({ 'gspot.toml': text });
    const refused = await runGspot(sandbox.path, ['list']);
    expect(refused.stderr).toContain('Run gspot add licenses.');
    const result = await runGspot(sandbox.path, ['add', 'licenses']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const saved = parseSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
    expect(saved.configurations).toContain('licenses');
});

test('add security exits 2, names gspot set level, and writes nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
    });
    const refusal = await assertRefusalWithoutWrites(sandbox.path, ['add', 'security'], 'arguments');
    expect(refusal.message).toContain('gspot set level');
});

test('add reports an inherited configuration as already selected and writes nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': INHERITED_CONFIGURATION_SETTINGS,
        'api/entry.sh': 'echo api\n',
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['add', 'bash', '--scope', 'api', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: false });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('add names only added configurations in a mixed request', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash']) });
    const result = await runGspot(sandbox.path, ['add', 'bash', 'markdown']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.split('\n', 1)[0]).toBe('Added markdown. bash is already selected.');
    const settings = parseSettings(
        readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'),
        sandbox.path,
    ).configurations;
    expect(settings).toStrictEqual(['bash', 'markdown']);
});

test('add names a repeated configuration once and saves it once', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['python']) });
    const result = await runGspot(sandbox.path, ['add', 'pytest', 'pytest']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.split('\n', 1)[0]).toBe('Added pytest.');
    const saved = parseSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
    expect(saved.configurations).toStrictEqual(['python', 'pytest']);
});

test('add --scope on a project folder writes its scope record', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'py/pyproject.toml': '[project]\nname = "api"\nversion = "1.0.0"\n',
        'py/main.py': 'PORT = 8080\n',
    });
    const result = await runGspot(sandbox.path, ['add', 'fastapi', '--scope', 'py']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const saved = parseSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
    expect(saved.scopes.get('py')?.configurations).toStrictEqual(['fastapi']);
});

test('add site writes only the configuration to the scope, and no build command', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'app', configurations: [] }] }),
        'app/index.html': '<!doctype html><title>Site</title>',
        'app/package.json': '{"packageManager":"bun@1.4.2"}',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['add', 'site', '--scope', 'app']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8');
    expect(parse(written)).toHaveProperty('scope', [{ path: 'app', configurations: ['site'] }]);
});

test('add cloudflare writes the OpenNext types', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': JSON.stringify({ private: true, devDependencies: { '@opennextjs/cloudflare': '1.0.0' } }),
        'wrangler.jsonc': '{ "name": "shop" }\n',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['add', 'cloudflare']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    expect(getTable(session.scopes[0]!.settings, 'cloudflare')).toMatchObject({
        types_file: 'cloudflare-env.d.ts',
        types_interface: 'CloudflareEnv',
    });
});

test('add names each new check that stays off until a setting has a value', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([], { level: 'all' }) });
    const result = await runGspot(sandbox.path, ['add', 'licenses']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('licenses/allowed stays off until you set licenses.allowed.');
});
