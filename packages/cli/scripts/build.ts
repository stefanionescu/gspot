// Builds the gspot package: the CLI and its configuration process as Node modules, beside the kits, guides, and grammars.
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { copyGrammars } from '#scripts/grammars.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { rmSync, chmodSync, copyFileSync } from 'node:fs';
import { validateManifests } from '#cli/kits/problems.ts';
import packageManifest from '#cli-package' with { type: 'json' };

// The mode of the command file: read and run by everyone, written by its owner.
const EXECUTABLE_MODE = 0o755;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distribution = join(root, 'dist');

// The package carries its grammars; a source checkout reads most of them from node_modules instead.
await copyGrammars(join(root, 'grammars'));
// A package never ships kits that contradict each other; the CLI does not check them again at start.
validateManifests(kitManifests());
rmSync(distribution, { recursive: true, force: true });
for (const [entry, name, banner] of [
    ['src/main.ts', 'gspot.js', '#!/usr/bin/env node'],
    ['src/lifecycle/preview/eslint/worker.ts', 'configuration.js', ''],
] as const) {
    const result = await Bun.build({
        entrypoints: [join(root, entry)],
        outdir: distribution,
        naming: name,
        format: 'esm',
        target: 'node',
        external: Object.keys(packageManifest.dependencies),
        banner,
        minify: false,
        sourcemap: 'none',
    });
    if (!result.success) throw new Error(result.logs.map((log) => log.message).join('\n'));
}
chmodSync(join(distribution, 'gspot.js'), EXECUTABLE_MODE);
copyFileSync(join(root, '../..', 'LICENSE.md'), join(distribution, 'LICENSE.md'));
console.log('built packages/cli/dist/gspot.js and configuration.js');
