import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { mkdir, writeFile } from 'node:fs/promises';
import { runGitStep } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { spawnGspot, runGspotStep } from '#tests/setup/cli/commands.ts';
import { createNpmRegistry } from '#tests/setup/runner/npm-registry.ts';
import type { NpmProject, NpmRegistry } from '#tests/types/packages.ts';
import prettierPackage from 'prettier/package.json' with { type: 'json' };
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';

import {
    REGISTRY_HOST,
    PNPM_WORKSPACE,
    NPM_PROJECT_FILES,
    NPM_REGISTRY_TOKEN,
    NPM_PROJECT_IGNORES,
    YARN_VERSION_THRESHOLD,
    NPM_PROJECT_ROOT_PACKAGE,
} from '#tests/config/setup/sandboxes.ts';

async function writeNpmProject(options: {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    packageManager: PackageManager['name'];
    projectPath: string;
}): Promise<Pick<NpmProject, 'rootPackage' | 'yarnConfiguration' | 'environment'>> {
    const { root, artifacts, registry, packageManager, projectPath } = options;
    const version = await runCommand([packageManager, '--version'], { cwd: artifacts });
    if (version.code !== 0) throw new Error(`Package manager version failed: ${version.stdout}${version.stderr}`);
    const rootPackage = JSON.stringify({
        ...NPM_PROJECT_ROOT_PACKAGE,
        packageManager: `${packageManager}@${version.stdout.trim()}`,
    });
    const npmrc = `registry=${registry.url}/\nalways-auth=true\n${registry.url.replace('http:', '')}/:_authToken=${NPM_REGISTRY_TOKEN}\n`;
    const userSettings = join(artifacts, 'user.npmrc');
    await writeFile(userSettings, npmrc, { mode: 0o600 });
    await createFileTree(root, {
        [projectPath]: rootPackage,
        ...(projectPath === 'package.json' && { 'pnpm-workspace.yaml': PNPM_WORKSPACE }),
        '.npmrc': npmrc,
        'gspot.toml': buildSandboxSettings(['format'], {
            ignore: {
                checks: NPM_PROJECT_IGNORES,
                reason: 'The sandbox tests package-manager installation and preserves authored dependencies.',
            },
            level: 'basic',
        }),
        ...NPM_PROJECT_FILES,
    });
    const yarnConfiguration =
        packageManager === 'yarn' && Number(version.stdout.trim().split('.', 1)[0]) >= YARN_VERSION_THRESHOLD
            ? `npmRegistryServer: "${registry.url}"\nnpmAuthToken: "${NPM_REGISTRY_TOKEN}"\nnpmAlwaysAuth: true\nunsafeHttpWhitelist: ["${REGISTRY_HOST}"]\n`
            : undefined;
    if (yarnConfiguration !== undefined) await writeFile(join(root, '.yarnrc.yml'), yarnConfiguration, { mode: 0o600 });
    runGitStep(root, ['init', '--quiet']);
    return { rootPackage, yarnConfiguration, environment: { NPM_CONFIG_USERCONFIG: userSettings } };
}

/**
Create an authenticated registry and an authored project for a package manager.
*/
export async function createNpmProject(
    packageManager: PackageManager['name'],
    projectPath: string,
): Promise<NpmProject> {
    await using resources = new AsyncDisposableStack();
    const folder = resources.use(await testdir());
    const root = join(folder.path, 'repository');
    const artifacts = join(folder.path, 'artifacts');
    await mkdir(artifacts);
    const installPlan = {
        packages: [
            {
                name: prettierPackage.name,
                source: dirname(fileURLToPath(import.meta.resolve('prettier/package.json'))),
                version: prettierPackage.version,
                bin: { [prettierPackage.name]: prettierPackage.bin },
            },
        ],

        token: NPM_REGISTRY_TOKEN,
    };
    const registry = resources.use(await createNpmRegistry(artifacts, installPlan));
    const authored = await writeNpmProject({ root, artifacts, registry, packageManager, projectPath });
    await runGspotStep(
        { root, run: (cwd, commandArguments) => spawnGspot(cwd, commandArguments, authored.environment) },
        ['apply'],
    );
    const owned = resources.move();
    return {
        root,
        artifacts,
        registry,
        ...authored,
        toolPackageManager: packageManager === 'yarn' ? 'npm' : packageManager,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}
