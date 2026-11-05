import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import prettierPackage from 'prettier/package.json' with { type: 'json' };
import { createFileTree, testdir } from 'testdirs';

import type { ToolPackageManager } from '#cli/types/tools.ts';
import {
    NPM_PROJECT_FILES,
    NPM_PROJECT_IGNORES,
    NPM_PROJECT_ROOT_PACKAGE,
    NPM_REGISTRY_TOKEN,
    PNPM_WORKSPACE,
} from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { startNpmRegistry } from '#tests/setup/runner/npm-registry.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { NpmProject, NpmRegistry } from '#tests/types/setup.ts';

async function writeNpmProject(options: {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    packageManager: ToolPackageManager['name'];
    projectPath: string;
}): Promise<string> {
    const { root, artifacts, registry, packageManager, projectPath } = options;
    const version = await runCommand([packageManager, '--version'], { cwd: artifacts });
    if (version.code !== 0) throw new Error(`Package manager version failed: ${version.stdout}${version.stderr}`);
    const rootPackage = JSON.stringify({
        ...NPM_PROJECT_ROOT_PACKAGE,
        packageManager: `${packageManager}@${version.stdout.trim()}`,
    });
    await createFileTree(root, {
        [projectPath]: rootPackage,
        ...(projectPath === 'package.json' && { 'pnpm-workspace.yaml': PNPM_WORKSPACE }),
        '.npmrc': `registry=${registry.url}/\nalways-auth=true\n${registry.url.replace('http:', '')}/:_authToken=${NPM_REGISTRY_TOKEN}\n`,
        'gspot.toml': buildSandboxSettings(['format'], {
            ignore: {
                checks: NPM_PROJECT_IGNORES,
                reason: 'The sandbox tests package-manager installation and preserves authored dependencies.',
            },
            level: 'basic',
        }),
        ...NPM_PROJECT_FILES,
    });
    runGitStep(root, ['init', '--quiet']);
    return rootPackage;
}

/**
Create an authenticated registry and an authored project for a package manager.
*/
export async function createNpmProject(
    packageManager: ToolPackageManager['name'],
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
    const registry = resources.use(await startNpmRegistry(artifacts, installPlan));
    const rootPackage = await writeNpmProject({ root, artifacts, registry, packageManager, projectPath });
    await applyGeneratedFiles(root);
    const owned = resources.move();
    return {
        root,
        artifacts,
        registry,
        rootPackage,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}
