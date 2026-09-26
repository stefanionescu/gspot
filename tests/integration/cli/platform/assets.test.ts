import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { copyFileSync, readFileSync, symlinkSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const CHECKOUT = 'workspace % café';
const SOURCES = [
    'packages/cli/package.json',
    'packages/cli/src/platform/assets.ts',
    'packages/cli/src/platform/paths.ts',
    'packages/cli/src/platform/environment.ts',
    'packages/cli/src/repository/hooks.ts',
    'packages/cli/src/constants/platform.ts',
    'packages/cli/src/constants/repository/repository.ts',
];
const CONFIGURATION = '[configuration]\nname = "bash"\n';
const PROBE = `import { readAsset, listAssets, grammarPath, GRAMMAR_NAMES } from './packages/cli/src/platform/assets.ts';
for (const name of GRAMMAR_NAMES) {
    if (!WebAssembly.validate(await Bun.file(grammarPath(name)).arrayBuffer())) throw new Error(name);
}
try { grammarPath('undeclared.wasm'); throw new Error('Undeclared asset was accepted.'); }
catch (error) { if (!String(error).includes('No grammar is called')) throw error; }
console.log(JSON.stringify({ text: readAsset('packages/cli/configurations/language/bash/manifest.toml'), files: listAssets('packages/cli/configurations') }));
`;

describe('development assets', () => {
    test('resolve a checkout containing spaces, percent signs, and Unicode', async () => {
        const sources = Object.fromEntries(
            SOURCES.map((path) => [`${CHECKOUT}/${path}`, readFileSync(join(ROOT, path), 'utf8')]),
        );
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...sources,
            [`${CHECKOUT}/packages/cli/configurations/language/bash/manifest.toml`]: CONFIGURATION,
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
            text: CONFIGURATION,
            files: ['packages/cli/configurations/language/bash/manifest.toml'],
        });
    });
});
