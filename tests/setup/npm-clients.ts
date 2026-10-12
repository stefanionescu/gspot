// Creates npm client sandboxes and reads their generated project files.
import { fileURLToPath } from 'node:url';
import { git } from '#tests/setup/git.ts';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSession } from '#cli/commands/session.ts';
import type { ApplyReport } from '#cli/types/apply.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { NpmRegistry } from '#tests/types/e2e.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { createNpmRegistry } from '#tests/setup/install.ts';
import type { NpmClientSandbox } from '#tests/types/npm.ts';
import { collectPins } from '#cli/configurations/tool-pins.ts';
import type { NpmClient } from '#cli/types/parsers/dependency-files.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };

import {
    PNPM_WORKSPACE,
    NPM_SANDBOX_FILES,
    NPM_REGISTRY_TOKEN,
    NPM_SANDBOX_PACKAGE,
    NPM_SANDBOX_IGNORES,
    YARN_VERSION_THRESHOLD,
} from '#tests/config/npm.ts';

async function writeNpmClientSandbox(options: {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    installer: NpmClient['name'];
    projectPath: string;
}): Promise<Pick<NpmClientSandbox, 'rootPackage' | 'yarnConfiguration' | 'version'>> {
    const { root, artifacts, registry, installer, projectPath } = options;
    const version = await runCommand([installer, '--version'], { cwd: artifacts });
    if (version.code !== 0) throw new Error(`Package installer version failed: ${version.stdout}${version.stderr}`);
    const rootPackage = JSON.stringify({
        ...NPM_SANDBOX_PACKAGE,
        packageManager: `${installer}@${version.stdout.trim()}`,
    });
    await createFileTree(root, {
        [projectPath]: rootPackage,
        ...(projectPath === 'package.json' ? { 'pnpm-workspace.yaml': PNPM_WORKSPACE } : {}),
        '.npmrc': `registry=${registry.url}/\nalways-auth=true\n${registry.url.replace('http:', '')}/:_authToken=${NPM_REGISTRY_TOKEN}\n`,
        'gspot.toml': settingsText(['format'], {
            ignore: {
                checks: NPM_SANDBOX_IGNORES,
                reason: 'The sandbox tests package-manager installation and preserves authored dependencies.',
            },
            level: 'recommended',
        }),
        ...NPM_SANDBOX_FILES,
    });
    const yarnConfiguration =
        installer === 'yarn' && Number(version.stdout.trim().split('.', 1)[0]) >= YARN_VERSION_THRESHOLD
            ? `npmRegistryServer: "${registry.url}"\nnpmAuthToken: "${NPM_REGISTRY_TOKEN}"\nnpmAlwaysAuth: true\nunsafeHttpWhitelist: ["127.0.0.1"]\n`
            : undefined;
    if (yarnConfiguration !== undefined) await writeFile(join(root, '.yarnrc.yml'), yarnConfiguration, { mode: 0o600 });
    const initialized = git(root, ['init', '--quiet']);
    if (initialized.code !== 0) throw new Error(`Package project Git setup failed: ${initialized.stderr}`);
    return { rootPackage, yarnConfiguration, version: version.stdout.trim() };
}

/** Creates an authenticated registry and an authored project for a package manager. */
export async function createNpmClientSandbox(
    installer: NpmClient['name'],
    projectPath: string,
): Promise<NpmClientSandbox> {
    const resources = new AsyncDisposableStack();
    try {
        const directory = resources.use(await testdir());
        const root = join(directory.path, 'repository');
        const artifacts = join(directory.path, 'artifacts');
        await mkdir(artifacts);
        const registry = resources.use(
            await createNpmRegistry(artifacts, {
                declarations: [
                    {
                        name: prettierManifest.name,
                        source: dirname(fileURLToPath(import.meta.resolve('prettier/package.json'))),
                        version: prettierManifest.version,
                        bin: { [prettierManifest.name]: prettierManifest.bin },
                    },
                ],
                execute: runCommand,
                token: NPM_REGISTRY_TOKEN,
            }),
        );
        const authored = await writeNpmClientSandbox({ root, artifacts, registry, installer, projectPath });
        const result = await spawnGspot(root, ['apply', '--json']);
        if (result.code !== 0) throw new Error(`Package sandbox apply failed: ${result.stdout}${result.stderr}`);
        const preserved = (JSON.parse(result.stdout) as ApplyReport).notes.filter((note) =>
            note.startsWith('preserved'),
        );
        if (preserved.length > 0)
            throw new Error(`Package sandbox preserved conflicting inputs: ${preserved.join('\n')}`);
        const awaitedSession = await openSession(root);
        return {
            root,
            artifacts,
            registry,
            tools: collectPins(awaitedSession.neededToolManifests),
            ...authored,
            async [Symbol.asyncDispose]() {
                await resources.disposeAsync();
            },
        };
    } catch (error) {
        await resources.disposeAsync();
        throw error;
    }
}
