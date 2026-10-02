import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { GRAMMAR_FILES } from '#cli/config/platform/platform.ts';
import { cpSync, symlinkSync, copyFileSync, readFileSync } from 'node:fs';

const ASSETS_CONFIGURATION = '[kit]\nname = "bash"\n';

const CHECKOUT = 'workspace % café';

const ASSET_READER_SCRIPT = `import { readAsset, listAssets, grammarPath, GRAMMAR_NAMES } from './packages/cli/src/platform/assets.ts';
for (const name of GRAMMAR_NAMES) {
    if (!WebAssembly.validate(await Bun.file(grammarPath(name)).arrayBuffer())) throw new Error(name);
}
try { grammarPath('undeclared.wasm'); throw new Error('Undeclared asset was accepted.'); }
catch (error) { if (!String(error).includes('No grammar is called')) throw error; }
console.log(JSON.stringify({ text: readAsset('kits/language/bash/manifest.toml'), files: listAssets('kits') }));
`;

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
describe('development assets', () => {
    test('resolve a checkout containing spaces, percent signs, and Unicode', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            [`${CHECKOUT}/packages/cli/package.json`]: readFileSync(join(ROOT, 'packages/cli/package.json'), 'utf8'),
            [`${CHECKOUT}/packages/cli/kits/language/bash/manifest.toml`]: ASSETS_CONFIGURATION,
            [`${CHECKOUT}/assets-reader.ts`]: ASSET_READER_SCRIPT,
            [`${CHECKOUT}/packages/cli/grammars/undeclared.wasm`]: 'not a declared asset',
        });
        const cwd = join(sandbox.path, CHECKOUT);
        // The whole source tree, so the copy follows every import the asset reader makes.
        cpSync(join(ROOT, 'packages/cli/src'), join(cwd, 'packages/cli/src'), { recursive: true });
        symlinkSync(join(ROOT, 'packages/cli/node_modules'), join(cwd, 'packages/cli/node_modules'), 'junction');
        symlinkSync(join(ROOT, 'node_modules'), join(cwd, 'node_modules'), 'junction');
        const missing = Bun.spawnSync([process.execPath, '--no-install', join(cwd, 'assets-reader.ts')], {
            cwd,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(missing.exitCode).toBe(1);
        expect(missing.stderr.toString()).toContain('Reinstall @gspothq/cli.');
        for (const name of GRAMMAR_FILES)
            copyFileSync(join(ROOT, 'packages/cli/grammars', name), join(cwd, 'packages/cli/grammars', name));
        const result = Bun.spawnSync([process.execPath, '--no-install', join(cwd, 'assets-reader.ts')], {
            cwd,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        expect(JSON.parse(result.stdout.toString())).toStrictEqual({
            text: ASSETS_CONFIGURATION,
            files: ['kits/language/bash/manifest.toml'],
        });
    });
});
