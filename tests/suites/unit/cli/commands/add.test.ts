import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { getTable } from '#cli/settings/scopes.ts';
import { existsSync, readFileSync } from 'node:fs';
import { openSession } from '#cli/engine/session.ts';
import { readSettings } from '#cli/settings/read.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { API_SCOPE_FILES } from '#tests/config/commands/reports.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';

import {
    CONFIGURATIONS_SETTINGS,
    SITE_PACKAGE_MANAGER_CASES,
    UNKNOWN_CONFIGURATION_REFUSALS,
    INHERITED_CONFIGURATION_SETTINGS,
} from '#tests/config/commands/edits.ts';

test('add --scope writes the scope list and applies the generated files', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { scopes: [{ path: 'api', configurations: [] }] }),
        ...API_SCOPE_FILES,
    });
    commitAll(sandbox.path);
    await applyGeneratedFiles(sandbox.path);
    const generated = join(sandbox.path, getManifestTarget('bash', 'shellcheckrc'));
    expect(existsSync(generated)).toBe(false);
    const result = await runGspot(sandbox.path, ['add', 'bash', '--scope', 'api', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const saved = readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
    expect(saved.scopes.get('api')!.configurations).toStrictEqual(['bash']);
    expect(saved.configurations).toStrictEqual(['markdown']);
    await applyGeneratedFiles(sandbox.path);
    expect(existsSync(generated)).toBe(true);
});

test('add security exits 2, names gspot set level, and writes nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        'source.py': 'PORT = 8080\n',
    });
    await assertRefusalWithoutWrites(sandbox.path, ['add', 'security'], {
        error: 'arguments',
        message:
            'gspot selects security by itself when the repository needs it, so you cannot add or remove it. To run more or fewer of its checks, run gspot set level. To ignore one check, run gspot ignore.',
    });
});

test('add reports an inherited configuration as already selected and writes nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': INHERITED_CONFIGURATION_SETTINGS,
        'api/entry.sh': 'echo api\n',
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['add', 'bash', '--scope', 'api', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        changed: false,
        summary: 'No change: bash is already selected.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

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
    const saved = readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
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
    const saved = readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path);
    expect(saved.scopes.get('py')?.configurations).toStrictEqual(['fastapi']);
});

test.each(
    SITE_PACKAGE_MANAGER_CASES.flatMap(([name, files, installer]) =>
        (installer === 'npm' ? [''] : ['', 'app']).map((scope) => ({ name, files, installer, scope })),
    ),
)('add site writes the $installer build command in "$scope" ($name)', async ({ files, installer, scope }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: scope === '' ? [] : [{ path: scope, configurations: [] }] }),
        [join(scope, 'index.html')]: '<!doctype html><title>Site</title>',
        ...Object.fromEntries(Object.entries(files).map(([path, text]) => [join(scope, path), text])),
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['add', 'site', ...(scope === '' ? [] : ['--scope', scope])]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    const selected = session.scopes.find((each) => each.path === scope)!;
    expect(getTable(selected.settings, 'site').build_command).toStrictEqual([installer, 'run', 'build']);
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
