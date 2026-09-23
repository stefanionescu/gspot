import { join } from 'node:path';
import { readFileSync, symlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const CHECKOUT = 'workspace % café';
const SOURCES = [
    'packages/cli/package.json',
    'packages/cli/src/naming/grammars-definitions.ts',
    'packages/cli/src/platform/assets.ts',
    'packages/cli/src/platform/paths.ts',
    'packages/cli/src/platform/environment.ts',
    'packages/cli/src/checks/integrity-definitions.ts',
];
const PRESET = '[preset]\nname = "bash"\n';
const PROBE = `import { readAsset, listAssets } from './packages/cli/src/platform/assets.ts';
console.log(JSON.stringify({ text: readAsset('presets/language/bash/manifest.toml'), files: listAssets('presets') }));
`;

describe('development assets', () => {
    test('resolve a checkout containing spaces, percent signs, and Unicode', async () => {
        const sources = Object.fromEntries(
            SOURCES.map((path) => [`${CHECKOUT}/${path}`, readFileSync(join(ROOT, path), 'utf8')]),
        );
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...sources,
            [`${CHECKOUT}/presets/language/bash/manifest.toml`]: PRESET,
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
        expect(JSON.parse(result.stdout.toString())).toEqual({
            text: PRESET,
            files: ['presets/language/bash/manifest.toml'],
        });
    });
});
