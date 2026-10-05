// Build the CLI and ESLint coverage worker as Node modules beside the configurations, rules, and grammars.
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { buildEslintWorker } from './eslint-worker.ts';
import { rmSync, chmodSync, copyFileSync } from 'node:fs';
import { EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { ESLINT_WORKER_FILES } from '#cli/config/tools/eslint.ts';
import { assertManifests } from '#cli/configurations/problems.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { validateEslintPresets } from '#cli/generation/eslint/presets.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distribution = join(root, 'dist');

// A package never ships configurations that contradict each other; the CLI does not check them again at start.
assertManifests(configurationManifests());
validateEslintPresets(configurationManifests());
rmSync(distribution, { recursive: true, force: true });
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
await buildEslintWorker(distribution);
chmodSync(join(distribution, 'gspot.js'), EXECUTABLE_FILE);
copyFileSync(join(root, '../..', 'LICENSE.md'), join(distribution, 'LICENSE.md'));
console.log(`built packages/cli/dist/gspot.js and ${ESLINT_WORKER_FILES.bundle}`);
