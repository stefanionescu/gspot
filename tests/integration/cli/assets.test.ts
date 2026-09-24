import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { readFileSync, symlinkSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const CHECKOUT = 'workspace % café';
const SOURCES = [
    'packages/cli/package.json',
    'packages/cli/src/parsers/grammars.ts',
    'packages/cli/src/platform/assets.ts',
    'packages/cli/src/platform/paths.ts',
    'packages/cli/src/platform/environment.ts',
    'packages/cli/src/repository/hooks.ts',
];
const CONFIGURATION = '[configuration]\nname = "bash"\n';
const PROBE = `import { readAsset, listAssets } from './packages/cli/src/platform/assets.ts';
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
        });
        const cwd = join(sandbox.path, CHECKOUT);
        symlinkSync(join(ROOT, 'packages/cli/node_modules'), join(cwd, 'packages/cli/node_modules'), 'junction');
        const result = Bun.spawnSync([process.execPath, '--no-install', join(cwd, 'probe.ts')], {
            cwd,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        expect(JSON.parse(result.stdout.toString())).toStrictEqual({
            text: CONFIGURATION,
            files: ['packages/cli/configurations/language/bash/manifest.toml'],
        });
    });
});
