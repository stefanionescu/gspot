import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { cp, symlink, readFile } from 'node:fs/promises';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { RUNTIME_WASM, GRAMMAR_PACKAGES, SWIFT_GRAMMAR_FILE } from '#cli/config/platform/assets.ts';
import { CHECKOUT, ASSET_READER_SCRIPT, ASSETS_CONFIGURATION } from '#tests/config/cli/platform/assets.ts';

/**
 * Writes the copied checkout whose native asset reader both cases execute.
 * @param directory the sandbox folder
 * @returns the copied checkout folder
 */
async function writeCheckout(directory: string): Promise<string> {
    await createFileTree(directory, {
        [`${CHECKOUT}/packages/cli/package.json`]: await readFile(join(root, 'packages/cli/package.json'), 'utf8'),
        [`${CHECKOUT}/packages/cli/configurations/language/bash/manifest.toml`]: ASSETS_CONFIGURATION,
        [`${CHECKOUT}/assets-reader.ts`]: ASSET_READER_SCRIPT,
        [`${CHECKOUT}/packages/cli/configurations/.index.json`]: '{}',
        [`${CHECKOUT}/packages/cli/configurations/language/bash/.meta/state.json`]: '{}',
        [`${CHECKOUT}/packages/cli/grammars/undeclared.wasm`]: 'not a declared asset',
    });
    const cwd = join(directory, CHECKOUT);
    // The whole source tree, so the copy follows every import the asset reader makes.
    await cp(join(root, 'packages/cli/src'), join(cwd, 'packages/cli/src'), { recursive: true });
    await symlink(join(root, 'packages/cli/node_modules'), join(cwd, 'packages/cli/node_modules'), 'junction');
    await symlink(join(root, 'node_modules'), join(cwd, 'node_modules'), 'junction');
    return cwd;
}

describe('development assets', () => {
    test('a missing grammar refuses source execution', async () => {
        await using sandbox = await testdir();
        const cwd = await writeCheckout(sandbox.path);
        const missing = runTestCommandBlocking([process.execPath, '--no-install', join(cwd, 'assets-reader.ts')], {
            cwd,
        });
        expect(missing.code).toBe(1);
        expect(missing.stderr).toContain('The WebAssembly file bash.wasm is missing');
    });

    test('a checkout with spaces, percent signs and Unicode reads assets, validates grammars and refuses undeclared grammar names', async () => {
        await using sandbox = await testdir();
        const cwd = await writeCheckout(sandbox.path);
        await cp(join(root, 'packages/cli/grammars'), join(cwd, 'packages/cli/grammars'), { recursive: true });
        const result = runTestCommandBlocking([process.execPath, '--no-install', join(cwd, 'assets-reader.ts')], {
            cwd,
        });
        expect(result.code, result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toStrictEqual({
            grammars: Object.fromEntries(
                [...Object.keys(GRAMMAR_PACKAGES), ...Object.keys(RUNTIME_WASM), SWIFT_GRAMMAR_FILE].map((name) => [
                    name,
                    true,
                ]),
            ),
            undeclared: 'No WebAssembly file named undeclared.wasm ships with gspot.',
            text: ASSETS_CONFIGURATION,
            files: [
                'configurations/.index.json',
                'configurations/language/bash/.meta/state.json',
                'configurations/language/bash/manifest.toml',
            ],
        });
    });
});
