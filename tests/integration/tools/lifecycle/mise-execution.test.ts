import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { run } from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { delimiter, dirname, join } from 'node:path';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { chmodSync, existsSync, readFileSync } from 'node:fs';
import packageManifest from '#cli-package' with { type: 'json' };
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { MISE_CONFIG_PATH, MISE_MIN_VERSION } from '#cli/tools/mise.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const { version: GSPOT_VERSION } = packageManifest;

const CLI = fileURLToPath(new URL('../../../../packages/cli/src/main.ts', import.meta.url));

test('mise executes generated tasks with their arguments, and install rejects an old runner before corrected setup succeeds', async () => {
    await using repository = await testdir();
    await using state = await testdir();
    let policy = 'version = 1\nlevel = "recommended"\nconfigurations = []\n[rules]\ninstall = false\n';
    await createFileTree(repository.path, { 'gspot.toml': policy, '.gspot/authored.txt': 'keep authored content' });
    await createFileTree(state.path, {
        'bin/gspot': '#!/bin/sh\nexec "$GSPOT_TEST_BUN" "$GSPOT_TEST_CLI" "$@"\n',
        'old/mise': '#!/bin/sh\nif [ "$1" = --version ]; then printf "2026.5.15\\n"; exit 0; fi\nexit 42\n',
    });
    chmodSync(join(state.path, 'bin/gspot'), 0o755);
    chmodSync(join(state.path, 'old/mise'), 0o755);
    const rejected = await run([process.execPath, CLI, 'set', 'runner.tool', 'unsupported', '--json'], {
        cwd: repository.path,
    });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(2);
    expect(readFileSync(join(repository.path, 'gspot.toml'), 'utf8')).toBe(policy);
    const selected = await run([process.execPath, CLI, 'set', 'runner.tool', 'mise', '--json'], {
        cwd: repository.path,
    });
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    policy = readFileSync(join(repository.path, 'gspot.toml'), 'utf8');
    await applyAll(await openSession(repository.path));
    const generated = readFileSync(join(repository.path, MISE_CONFIG_PATH));
    const owner = openLifecycleOwner(repository.path);
    try {
        owner.replace('.gspot/obsolete.json', { bytes: Buffer.from('{}\n'), mode: 0o444 }, 'config');
    } finally {
        owner.close();
    }
    const env = {
        PATH: `${join(state.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
        GSPOT_TEST_BUN: process.execPath,
        GSPOT_TEST_CLI: CLI,
        MISE_CONFIG_DIR: join(state.path, 'config'),
        MISE_DATA_DIR: join(state.path, 'data'),
        MISE_STATE_DIR: join(state.path, 'state'),
        MISE_CACHE_DIR: join(state.path, 'cache'),
        MISE_OFFLINE: '1',
        MISE_CEILING_PATHS: dirname(repository.path),
        MISE_TRUSTED_CONFIG_PATHS: repository.path,
    };
    const refused = await run([process.execPath, CLI, 'install', '--json'], {
        cwd: repository.path,
        env: { ...env, PATH: `${join(state.path, 'old')}${delimiter}${env.PATH}` },
    });
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout).error).toContain(MISE_MIN_VERSION);
    expect(readFileSync(join(repository.path, MISE_CONFIG_PATH))).toStrictEqual(generated);
    const linked = await run(['mise', 'link', `github:stefanionescu/gspot@${GSPOT_VERSION}`, state.path], {
        cwd: repository.path,
        env,
    });
    expect(linked.code, linked.stdout + linked.stderr).toBe(0);
    const installed = await run([process.execPath, CLI, 'install', '--json'], { cwd: repository.path, env });
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(JSON.parse(installed.stdout).installed).toBe(true);
    expect(readFileSync(join(repository.path, MISE_CONFIG_PATH))).toStrictEqual(generated);
    expect(readFileSync(join(repository.path, 'gspot.toml'), 'utf8')).toBe(policy);
    const invalid = await run(['mise', 'run', '--quiet', 'gspot:apply', '--', '--invalid'], {
        cwd: repository.path,
        env,
    });
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect(invalid.stdout + invalid.stderr).toContain('--invalid');
    expect(existsSync(join(repository.path, '.gspot/obsolete.json'))).toBe(true);
    const applied = await run(['mise', 'run', '--quiet', 'gspot:apply'], { cwd: repository.path, env });
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(existsSync(join(repository.path, '.gspot/obsolete.json'))).toBe(false);
    expect(readFileSync(join(repository.path, '.gspot/authored.txt'), 'utf8')).toBe('keep authored content');
}, 60_000);
