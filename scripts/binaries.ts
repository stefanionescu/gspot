// Compile the CLI, bundle its Node coverage worker, and package the tool assets.
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { run } from '#cli/platform/spawn.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { workspaceRoot } from '#automation/workspace.ts';
import { ARGUMENT_START } from '#automation/config/paths.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { ESLINT_WORKER_FILES } from '#cli/config/tools/eslint.ts';
import { assertManifests } from '#cli/configurations/problems.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { validateEslintPresets } from '#cli/generation/eslint/presets.ts';
import { buildEslintWorker } from '../packages/cli/scripts/eslint-worker.ts';
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ARCHIVE_ENV, BINARY_TARGETS, ARCHIVE_TIMEOUT_MS, STANDALONE_DEFINES } from '#automation/config/release.ts';

const cli = join(workspaceRoot, 'packages/cli');
const destination = join(cli, 'dist-binaries');
const requested = process.argv.slice(ARGUMENT_START);
const selected = Object.entries(BINARY_TARGETS).filter(([name]) => requested.length === 0 || requested.includes(name));
for (const name of requested)
    if (!Object.hasOwn(BINARY_TARGETS, name)) throw new Error(`Unsupported standalone target: ${name}.`);
assertManifests(configurationManifests());
validateEslintPresets(configurationManifests());
mkdirSync(destination, { recursive: true });
const checksums: string[] = [];
using work = scratchFolder('gspot-worker-build-');
await buildEslintWorker(work.path);
for (const [name, target] of selected) {
    const folder = `gspot-${packageManifest.version}-${name}`;
    const stage = join(destination, folder);
    rmSync(stage, { recursive: true, force: true });
    mkdirSync(stage);
    const outfile = join(stage, `gspot${name.startsWith('windows-') ? '.exe' : ''}`);
    const result = await Bun.build({
        entrypoints: [join(cli, 'src/main.ts')],
        compile: { target, outfile },
        define: STANDALONE_DEFINES,
        minify: true,
        sourcemap: 'none',
    });
    if (!result.success) throw new Error(result.logs.map((log) => log.message).join('\n'));
    cpSync(join(work.path, ESLINT_WORKER_FILES.bundle), join(stage, ESLINT_WORKER_FILES.bundle));
    for (const asset of ['configurations', 'grammars', 'package.json'])
        cpSync(join(cli, asset), join(stage, asset), { recursive: true });
    cpSync(join(workspaceRoot, 'LICENSE.md'), join(stage, 'LICENSE.md'));
    const archive = `${folder}.tar.gz`;
    const packaged = await run(['tar', '--exclude=._*', '-czf', archive, folder], {
        cwd: destination,
        env: ARCHIVE_ENV,
        timeoutMs: ARCHIVE_TIMEOUT_MS,
    });
    if (packaged.code !== 0) throw new Error(`Archive ${archive} failed: ${packaged.stdout}${packaged.stderr}`);
    const checksum = createHash('sha256')
        .update(readFileSync(join(destination, archive)))
        .digest('hex');
    checksums.push(`${checksum}  ${archive}`);
    console.log(`built ${archive}`);
}
writeFileSync(join(destination, 'SHA256SUMS'), `${checksums.join('\n')}\n`);
