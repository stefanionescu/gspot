import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { cpSync, symlinkSync, readFileSync } from 'node:fs';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { CHECKOUT, ASSET_READER_SCRIPT, ASSETS_CONFIGURATION } from '#tests/config/cli/platform/assets.ts';

describe('development assets', () => {
    test('resolve a checkout containing spaces, percent signs, and Unicode', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            [`${CHECKOUT}/packages/cli/package.json`]: readFileSync(join(root, 'packages/cli/package.json'), 'utf8'),
            [`${CHECKOUT}/packages/cli/configurations/language/bash/manifest.toml`]: ASSETS_CONFIGURATION,
            [`${CHECKOUT}/assets-reader.ts`]: ASSET_READER_SCRIPT,
            [`${CHECKOUT}/packages/cli/configurations/.index.json`]: '{}',
            [`${CHECKOUT}/packages/cli/configurations/language/bash/.meta/state.json`]: '{}',
            [`${CHECKOUT}/packages/cli/grammars/undeclared.wasm`]: 'not a declared asset',
        });
        const cwd = join(sandbox.path, CHECKOUT);
        // The whole source tree, so the copy follows every import the asset reader makes.
        cpSync(join(root, 'packages/cli/src'), join(cwd, 'packages/cli/src'), { recursive: true });
        symlinkSync(join(root, 'packages/cli/node_modules'), join(cwd, 'packages/cli/node_modules'), 'junction');
        symlinkSync(join(root, 'node_modules'), join(cwd, 'node_modules'), 'junction');
        const missing = runTestCommandBlocking([process.execPath, '--no-install', join(cwd, 'assets-reader.ts')], {
            cwd,
        });
        // Source and packaged execution both require the WebAssembly files produced by setup.
        expect(missing.code).toBe(1);
        expect(missing.stderr).toContain('The WebAssembly file bash.wasm is missing');
        cpSync(join(root, 'packages/cli/grammars'), join(cwd, 'packages/cli/grammars'), { recursive: true });
        const result = runTestCommandBlocking([process.execPath, '--no-install', join(cwd, 'assets-reader.ts')], {
            cwd,
        });
        expect(result.code, result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toStrictEqual({
            text: ASSETS_CONFIGURATION,
            files: [
                'configurations/.index.json',
                'configurations/language/bash/.meta/state.json',
                'configurations/language/bash/manifest.toml',
            ],
        });
    });
});
