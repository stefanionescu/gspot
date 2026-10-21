// Creates package manager sandboxes and reads their generated project files.
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { runGit } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { mkdir, writeFile } from 'node:fs/promises';
import type { ApplyReport } from '#cli/types/apply.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { runSandboxStep } from '#tests/setup/install.ts';
import { createNpmRegistry } from '#tests/setup/registry.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import prettierPackage from 'prettier/package.json' with { type: 'json' };
import type { PackageManager } from '#cli/types/repository/package-manager.ts';
import type { NpmRegistry, PackageManagerSandbox } from '#tests/types/packages.ts';

import {
    REGISTRY_HOST,
    PNPM_WORKSPACE,
    NPM_SANDBOX_FILES,
    NPM_REGISTRY_TOKEN,
    NPM_SANDBOX_IGNORES,
    NPM_SANDBOX_PACKAGE,
    YARN_VERSION_THRESHOLD,
} from '#tests/data/test-setup.ts';

async function writePackageManagerSandbox(options: {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    packageManager: PackageManager['name'];
    projectPath: string;
}): Promise<Pick<PackageManagerSandbox, 'rootPackage' | 'yarnConfiguration'>> {
    const { root, artifacts, registry, packageManager, projectPath } = options;
    const version = await runCommand([packageManager, '--version'], { cwd: artifacts });
    if (version.code !== 0) throw new Error(`Package manager version failed: ${version.stdout}${version.stderr}`);
    const rootPackage = JSON.stringify({
        ...NPM_SANDBOX_PACKAGE,
        packageManager: `${packageManager}@${version.stdout.trim()}`,
    });
    await createFileTree(root, {
        [projectPath]: rootPackage,
        ...(projectPath === 'package.json' ? { 'pnpm-workspace.yaml': PNPM_WORKSPACE } : {}),
        '.npmrc': `registry=${registry.url}/\nalways-auth=true\n${registry.url.replace('http:', '')}/:_authToken=${NPM_REGISTRY_TOKEN}\n`,
        'gspot.toml': buildSandboxSettings(['format'], {
            ignore: {
                checks: NPM_SANDBOX_IGNORES,
                reason: 'The sandbox tests package-manager installation and preserves authored dependencies.',
            },
            level: 'recommended',
        }),
        ...NPM_SANDBOX_FILES,
    });
    const yarnConfiguration =
        packageManager === 'yarn' && Number(version.stdout.trim().split('.', 1)[0]) >= YARN_VERSION_THRESHOLD
            ? `npmRegistryServer: "${registry.url}"\nnpmAuthToken: "${NPM_REGISTRY_TOKEN}"\nnpmAlwaysAuth: true\nunsafeHttpWhitelist: ["${REGISTRY_HOST}"]\n`
            : undefined;
    if (yarnConfiguration !== undefined) await writeFile(join(root, '.yarnrc.yml'), yarnConfiguration, { mode: 0o600 });
    const initialized = runGit(root, ['init', '--quiet']);
    if (initialized.code !== 0) throw new Error(`Package project Git setup failed: ${initialized.stderr}`);
    return { rootPackage, yarnConfiguration };
}

/** Creates an authenticated registry and an authored project for a package manager. */
export async function createPackageManagerSandbox(
    packageManager: PackageManager['name'],
    projectPath: string,
): Promise<PackageManagerSandbox> {
    const resources = new AsyncDisposableStack();
    try {
        const folder = resources.use(await testdir());
        const root = join(folder.path, 'repository');
        const artifacts = join(folder.path, 'artifacts');
        await mkdir(artifacts);
        const registry = resources.use(
            await createNpmRegistry(artifacts, {
                packages: [
                    {
                        name: prettierPackage.name,
                        source: dirname(fileURLToPath(import.meta.resolve('prettier/package.json'))),
                        version: prettierPackage.version,
                        bin: { [prettierPackage.name]: prettierPackage.bin },
                    },
                ],

                token: NPM_REGISTRY_TOKEN,
            }),
        );
        const authored = await writePackageManagerSandbox({ root, artifacts, registry, packageManager, projectPath });
        const result = await runSandboxStep({ root, environment: {}, run: spawnGspot }, ['apply', '--json']);
        const preserved = (JSON.parse(result.stdout) as ApplyReport).notes.filter((note) =>
            note.startsWith('preserved'),
        );
        if (preserved.length > 0)
            throw new Error(`Package sandbox preserved conflicting inputs: ${preserved.join('\n')}`);
        return {
            root,
            artifacts,
            registry,
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
