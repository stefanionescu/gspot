// Creates a project for one package manager, with an authenticated local npm registry.
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { runGit } from '#tests/setup/system/git.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import type { ApplyReport } from '#cli/types/apply.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { spawnGspot, runGspotStep } from '#tests/setup/cli/commands.ts';
import type { NpmProject, NpmRegistry } from '#tests/types/packages.ts';
import prettierPackage from 'prettier/package.json' with { type: 'json' };
import { createNpmRegistry } from '#tests/setup/sandboxes/npm/registry.ts';
import type { PackageManager } from '#cli/types/repository/package-manager.ts';

import {
    REGISTRY_HOST,
    PNPM_WORKSPACE,
    NPM_PROJECT_FILES,
    NPM_REGISTRY_TOKEN,
    NPM_PROJECT_IGNORES,
    YARN_VERSION_THRESHOLD,
    NPM_PROJECT_ROOT_PACKAGE,
} from '#tests/data/setup/sandboxes.ts';

async function writeNpmProject(options: {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    packageManager: PackageManager['name'];
    projectPath: string;
}): Promise<Pick<NpmProject, 'rootPackage' | 'yarnConfiguration'>> {
    const { root, artifacts, registry, packageManager, projectPath } = options;
    const version = await runCommand([packageManager, '--version'], { cwd: artifacts });
    if (version.code !== 0) throw new Error(`Package manager version failed: ${version.stdout}${version.stderr}`);
    const rootPackage = JSON.stringify({
        ...NPM_PROJECT_ROOT_PACKAGE,
        packageManager: `${packageManager}@${version.stdout.trim()}`,
    });
    await createFileTree(root, {
        [projectPath]: rootPackage,
        ...(projectPath === 'package.json' ? { 'pnpm-workspace.yaml': PNPM_WORKSPACE } : {}),
        '.npmrc': `registry=${registry.url}/\nalways-auth=true\n${registry.url.replace('http:', '')}/:_authToken=${NPM_REGISTRY_TOKEN}\n`,
        'gspot.toml': buildSandboxSettings(['format'], {
            ignore: {
                checks: NPM_PROJECT_IGNORES,
                reason: 'The sandbox tests package-manager installation and preserves authored dependencies.',
            },
            level: 'recommended',
        }),
        ...NPM_PROJECT_FILES,
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

/** Create an authenticated registry and an authored project for a package manager. */
export async function createNpmProject(
    packageManager: PackageManager['name'],
    projectPath: string,
): Promise<NpmProject> {
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
        const authored = await writeNpmProject({ root, artifacts, registry, packageManager, projectPath });
        const result = await runGspotStep({ root, environment: {}, run: spawnGspot }, ['apply', '--json']);
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
