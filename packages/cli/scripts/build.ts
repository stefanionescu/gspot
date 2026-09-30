// Builds the gspot package: the CLI and its configuration process as Node modules, beside the kits, guides, and grammars.
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { GRAMMAR_FILES } from '#cli/config/platform.ts';
import packageManifest from '#package' with { type: 'json' };
import { rmSync, chmodSync, existsSync, copyFileSync } from 'node:fs';

// The mode of the command file: read and run by everyone, written by its owner.
const EXECUTABLE_MODE = 0o755;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distribution = join(root, 'dist');

for (const name of GRAMMAR_FILES)
    if (!existsSync(join(root, 'grammars', name)))
        throw new Error(`The grammar ${name} is missing. Run: mise run prepare:grammar`);
rmSync(distribution, { recursive: true, force: true });
for (const [entry, name, banner] of [
    ['src/main.ts', 'gspot.js', '#!/usr/bin/env node'],
    ['src/native/process.ts', 'configuration.js', ''],
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
