import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { join, dirname, delimiter } from 'node:path';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { onPosix } from '#tests/harness/cli/platforms.ts';
import { chmodSync, existsSync, readFileSync } from 'node:fs';
import packageManifest from '#cli-package' with { type: 'json' };
import type { InstallJson } from '#cli/types/commands/install.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';
import { MISE_CONFIG_PATH, MISE_MIN_VERSION } from '#cli/config/generation/generation.ts';

const { version: GSPOT_VERSION } = packageManifest;

const CLI = fileURLToPath(new URL('../../../../packages/cli/src/main.ts', import.meta.url));

if (onPosix)
    test('mise executes the pinned CLI with its arguments, and install rejects an old runner before corrected setup succeeds', async () => {
        await using repository = await testdir();
        await using state = await testdir();
        const policy = policyOf([], '[guides]\ninstall = false\n[runner]\ntool = "mise"\n', 'recommended');
        await createFileTree(repository.path, { 'gspot.toml': policy, '.gspot/authored.txt': 'keep authored content' });
        await createFileTree(state.path, {
            'bin/gspot': '#!/bin/sh\nexec "$GSPOT_TEST_BUN" "$GSPOT_TEST_CLI" "$@"\n',
            'old/mise': '#!/bin/sh\nif [ "$1" = --version ]; then printf "2026.5.15\\n"; exit 0; fi\nexit 42\n',
        });
        chmodSync(join(state.path, 'bin/gspot'), 0o755);
        chmodSync(join(state.path, 'old/mise'), 0o755);
        await writeOutputs(await openSession(repository.path));
        const generated = readFileSync(join(repository.path, MISE_CONFIG_PATH));
        runOwnedLifecycle(repository.path, (owner) => {
            owner.replace('.gspot/obsolete.json', { bytes: Buffer.from('{}\n'), mode: 0o444 }, 'config');
        });
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
        const options = { cwd: repository.path, env };
        const refused = await run([process.execPath, CLI, 'install', '--json'], {
            cwd: repository.path,
            env: { ...env, PATH: `${join(state.path, 'old')}${delimiter}${env.PATH}` },
        });
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect((JSON.parse(refused.stdout) as InstallJson).error).toContain(MISE_MIN_VERSION);
        expect(readFileSync(join(repository.path, MISE_CONFIG_PATH))).toStrictEqual(generated);
        expect(await run(['mise', 'link', `npm:@gspothq/cli@${GSPOT_VERSION}`, state.path], options)).toMatchObject({
            code: 0,
        });
        const installed = await run([process.execPath, CLI, 'install', '--json'], options);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect((JSON.parse(installed.stdout) as InstallJson).installed).toBe(true);
        expect({
            generated: readFileSync(join(repository.path, MISE_CONFIG_PATH)),
            policy: readFileSync(join(repository.path, 'gspot.toml'), 'utf8'),
        }).toStrictEqual({ generated, policy });
        const invalid = await run(['mise', 'exec', '--', 'gspot', 'apply', '--invalid'], options);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect(invalid.stdout + invalid.stderr).toContain('--invalid');
        expect(existsSync(join(repository.path, '.gspot/obsolete.json'))).toBe(true);
        const applied = await run(['mise', 'exec', '--', 'gspot', 'apply'], options);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(existsSync(join(repository.path, '.gspot/obsolete.json'))).toBe(false);
        expect(readFileSync(join(repository.path, '.gspot/authored.txt'), 'utf8')).toBe('keep authored content');
    }, 60_000);
