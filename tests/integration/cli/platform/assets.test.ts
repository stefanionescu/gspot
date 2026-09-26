import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { copyFileSync, readFileSync, symlinkSync } from 'node:fs';
import { ASSETS_CONFIGURATION, CHECKOUT, PROBE, SOURCES } from '#tests/constants/integration/cli/platform.ts';

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
describe('development assets', () => {
    test('resolve a checkout containing spaces, percent signs, and Unicode', async () => {
        const sources = Object.fromEntries(
            SOURCES.map((path) => [`${CHECKOUT}/${path}`, readFileSync(join(ROOT, path), 'utf8')]),
        );
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...sources,
            [`${CHECKOUT}/packages/cli/configurations/language/bash/manifest.toml`]: ASSETS_CONFIGURATION,
            [`${CHECKOUT}/probe.ts`]: PROBE,
            [`${CHECKOUT}/packages/cli/.build/undeclared.wasm`]: 'not a declared asset',
        });
        const cwd = join(sandbox.path, CHECKOUT);
        symlinkSync(join(ROOT, 'packages/cli/node_modules'), join(cwd, 'packages/cli/node_modules'), 'junction');
        const execute = () =>
            Bun.spawnSync([process.execPath, '--no-install', join(cwd, 'probe.ts')], {
                cwd,
                stdout: 'pipe',
                stderr: 'pipe',
            });
        const missing = execute();
        expect(missing.exitCode).toBe(1);
        expect(missing.stderr.toString()).toContain('run mise run prepare:grammar');
        copyFileSync(join(ROOT, 'packages/cli/.build/swift.wasm'), join(cwd, 'packages/cli/.build/swift.wasm'));
        const result = execute();
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        expect(JSON.parse(result.stdout.toString())).toStrictEqual({
            text: ASSETS_CONFIGURATION,
            files: ['packages/cli/configurations/language/bash/manifest.toml'],
        });
    });
});
