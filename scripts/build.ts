// Bun builds both npm packages and prepares the grammar files they ship.
// Bun builds both npm packages and prepares the grammar files they ship.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { assertManifests } from './manifests.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import plugin from '../packages/eslint-plugin/src/plugin.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { GRAMMARS_FOLDER } from '#cli/config/system/assets.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { TOOL_VERSIONS_FILE } from '#cli/config/configurations.ts';
import { buildJsonSchema } from '#cli/settings/schema/gspot-toml.ts';
import { ESLINT_RULE_LEVELS_FILE } from '#cli/config/generation/eslint.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { rm, mkdir, chmod, copyFile, readFile, writeFile } from 'node:fs/promises';

import {
    LICENSES_FOLDER,
    GRAMMAR_PACKAGES,
    SWIFT_GRAMMAR_PIN,
    SWIFT_GRAMMAR_FILE,
    CHECKSUM_ALGORITHM,
    SWIFT_LICENSE_FILE,
    PACKAGE_LICENSE_FILE,
} from './config/grammars.ts';
import {
    CLI_BANNER,
    JSON_INDENT,
    DIST_FOLDER,
    LICENSE_FILE,
    CLI_EXECUTABLE,
    EXECUTABLE_FILE,
    CLI_ENTRY_POINTS,
    THIRD_PARTY_NOTICE,
    ESLINT_PLUGIN_ENTRY,
    ESLINT_PLUGIN_EXECUTABLE,
} from './config/build.ts';

/**
 * Download a grammar asset when its stored bytes do not match the pinned hash.
 * @param path the destination file
 * @param url the download URL
 * @param checksum the expected SHA-256
 */
async function downloadPinnedFile(path: string, url: string, checksum: string): Promise<void> {
    const cached = await readFile(path).catch((error: unknown) => {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
        return undefined;
    });
    if (cached !== undefined && createHash(CHECKSUM_ALGORITHM).update(cached).digest('hex') === checksum) return;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Grammar download failed: HTTP ${String(response.status)}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (createHash(CHECKSUM_ALGORITHM).update(bytes).digest('hex') !== checksum)
        throw new Error(`Grammar checksum mismatch: ${url}.`);
    await writeFile(path, bytes);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const cliFolder = join(root, 'packages/cli');
const pluginFolder = join(root, 'packages/eslint-plugin');
const grammars = join(cliFolder, GRAMMARS_FOLDER);
const requireFromCli = createRequire(join(cliFolder, 'package.json'));
await mkdir(join(grammars, LICENSES_FOLDER), { recursive: true });
for (const [name, source] of Object.entries(GRAMMAR_PACKAGES)) {
    await copyFile(requireFromCli.resolve(source), join(grammars, name));
    const packageName = source.slice(0, source.indexOf('/'));
    await copyFile(
        join(dirname(requireFromCli.resolve(`${packageName}/package.json`)), PACKAGE_LICENSE_FILE),
        join(grammars, LICENSES_FOLDER, `${packageName}.txt`),
    );
}
await downloadPinnedFile(join(grammars, SWIFT_GRAMMAR_FILE), SWIFT_GRAMMAR_PIN.url, SWIFT_GRAMMAR_PIN.checksum);
await downloadPinnedFile(
    join(grammars, LICENSES_FOLDER, SWIFT_LICENSE_FILE),
    SWIFT_GRAMMAR_PIN.license.url,
    SWIFT_GRAMMAR_PIN.license.checksum,
);
const [cliEntry, ...auxiliaryEntries] = CLI_ENTRY_POINTS;
const cliDistribution = join(cliFolder, DIST_FOLDER);
await rm(cliDistribution, { recursive: true, force: true });
await mkdir(cliDistribution, { recursive: true });
await writeFile(
    join(cliFolder, TOOL_VERSIONS_FILE),
    JSON.stringify({ [eslintPluginPackage.name]: eslintPluginPackage.version }, null, JSON_INDENT) + '\n',
);
await writeFile(
    join(cliFolder, ESLINT_RULE_LEVELS_FILE),
    JSON.stringify(
        Object.fromEntries(Object.entries(plugin.rules).map(([name, rule]) => [name, rule.meta.docs.level])),
        null,
        JSON_INDENT,
    ) + '\n',
);
const manifests = readManifests(createReadCache(root));
assertManifests(manifests);
const cliBuild = await Bun.build({
    entrypoints: [join(cliFolder, cliEntry)],
    outdir: cliDistribution,
    naming: CLI_EXECUTABLE,
    format: 'esm',
    target: 'node',
    external: Object.keys(cliPackage.dependencies),
    banner: CLI_BANNER,
});
if (!cliBuild.success) throw new Error(cliBuild.logs.map((log) => log.message).join('\n'));
const auxiliary = await Bun.build({
    entrypoints: auxiliaryEntries.map((path) => join(cliFolder, path)),
    outdir: cliDistribution,
    naming: '[name].js',
    format: 'esm',
    target: 'node',
    external: Object.keys(cliPackage.dependencies),
});
if (!auxiliary.success) throw new Error(auxiliary.logs.map((log) => log.message).join('\n'));
await chmod(join(cliDistribution, CLI_EXECUTABLE), EXECUTABLE_FILE);
await writeFile(join(cliDistribution, 'THIRD-PARTY-NOTICES.md'), THIRD_PARTY_NOTICE);
await writeFile(join(cliFolder, 'gspot.schema.json'), JSON.stringify(buildJsonSchema(), null, JSON_INDENT) + '\n');
const pluginDistribution = join(pluginFolder, DIST_FOLDER);
await rm(pluginDistribution, { recursive: true, force: true });
const eslintPlugin = await Bun.build({
    entrypoints: [join(pluginFolder, ESLINT_PLUGIN_ENTRY)],
    outdir: pluginDistribution,
    naming: ESLINT_PLUGIN_EXECUTABLE,
    format: 'esm',
    target: 'node',
    external: Object.keys(eslintPluginPackage.dependencies),
});
if (!eslintPlugin.success) throw new Error(eslintPlugin.logs.map((log) => log.message).join('\n'));
const declarations = Bun.spawn(
    [
        process.execPath,
        createRequire(import.meta.url).resolve('typescript/bin/tsc'),
        '--project',
        join(pluginFolder, 'tsconfig.json'),
        '--emitDeclarationOnly',
        '--noEmit',
        'false',
    ],
    { stdout: 'inherit', stderr: 'inherit' },
);
if ((await declarations.exited) !== 0) throw new Error('ESLint plugin declaration generation failed.');
const declarationPath = join(pluginDistribution, 'plugin.d.ts');
const declaration = await readFile(declarationPath, 'utf8');
const ruleTypes = await readFile(join(pluginDistribution, 'types/rules.d.ts'), 'utf8');
await writeFile(
    declarationPath,
    ruleTypes.replaceAll('export type ', 'type ') + declaration.replaceAll('import("./types/rules.ts").', ''),
);
for (const folder of ['rules', 'types', 'config'])
    await rm(join(pluginDistribution, folder), { recursive: true, force: true });
for (const name of ['create-rule.d.ts', 'paths.d.ts', 'syntax.d.ts'])
    await rm(join(pluginDistribution, name), { force: true });
for (const distribution of [cliDistribution, pluginDistribution])
    await copyFile(join(root, LICENSE_FILE), join(distribution, LICENSE_FILE));
