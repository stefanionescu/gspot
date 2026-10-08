// Build the CLI as a Node module beside its configurations, rules, and grammars.
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { rm, chmod, copyFile } from 'node:fs/promises';
import { EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';
import { assertManifests } from '#cli/configurations/errors.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { validateEslintPresets } from '#cli/generation/eslint/presets.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distribution = join(root, 'dist');

const schemaCheck = Bun.spawn([process.execPath, join(root, '../../scripts/setting-values.ts'), '--check'], {
    cwd: join(root, '../..'),
    stdout: 'inherit',
    stderr: 'inherit',
});
if ((await schemaCheck.exited) !== 0)
    throw new Error('The compiled policy schema is stale. Run bun scripts/setting-values.ts.');

// A package never ships configurations that contradict each other; the CLI does not check them again at start.
assertManifests(configurationManifests());
validateEslintPresets(configurationManifests());
await rm(distribution, { recursive: true, force: true });
const result = await Bun.build({
    entrypoints: [join(root, 'src/main.ts')],
    outdir: distribution,
    naming: 'gspot.js',
    format: 'esm',
    target: 'node',
    external: Object.keys(packageManifest.dependencies),
    banner: '#!/usr/bin/env node',
    minify: false,
    sourcemap: 'none',
});
if (!result.success) throw new Error(result.logs.map((log) => log.message).join('\n'));
await chmod(join(distribution, 'gspot.js'), EXECUTABLE_FILE);
await copyFile(join(root, '../..', 'LICENSE.md'), join(distribution, 'LICENSE.md'));
console.log('built packages/cli/dist/gspot.js');
