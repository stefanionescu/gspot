import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { symlinkSync, copyFileSync, readFileSync } from 'node:fs';

import {
    SOURCES,
    CHECKOUT,
    ASSET_READER_SCRIPT,
    ASSETS_CONFIGURATION,
} from '#tests/config/integration/cli/platform.ts';

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
describe('development assets', () => {
    test('resolve a checkout containing spaces, percent signs, and Unicode', async () => {
        const sources = Object.fromEntries(
            SOURCES.map((path) => [`${CHECKOUT}/${path}`, readFileSync(join(ROOT, path), 'utf8')]),
        );
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...sources,
            [`${CHECKOUT}/packages/cli/kits/language/bash/manifest.toml`]: ASSETS_CONFIGURATION,
            [`${CHECKOUT}/assets-reader.ts`]: ASSET_READER_SCRIPT,
            [`${CHECKOUT}/packages/cli/.build/undeclared.wasm`]: 'not a declared asset',
        });
        const cwd = join(sandbox.path, CHECKOUT);
        symlinkSync(join(ROOT, 'packages/cli/node_modules'), join(cwd, 'packages/cli/node_modules'), 'junction');
        const missing = Bun.spawnSync([process.execPath, '--no-install', join(cwd, 'assets-reader.ts')], {
            cwd,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(missing.exitCode).toBe(1);
        expect(missing.stderr.toString()).toContain('run mise run prepare:grammar');
        copyFileSync(join(ROOT, 'packages/cli/.build/swift.wasm'), join(cwd, 'packages/cli/.build/swift.wasm'));
        const result = Bun.spawnSync([process.execPath, '--no-install', join(cwd, 'assets-reader.ts')], {
            cwd,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        expect(JSON.parse(result.stdout.toString())).toStrictEqual({
            text: ASSETS_CONFIGURATION,
            files: ['packages/cli/kits/language/bash/manifest.toml'],
        });
    });
});
