import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import type { RegistryPackage } from '#tests/types/registry.ts';
import type { PackageClient } from '#tests/types/integration/tools.ts';
import { LOCKS } from '#tests/constants/integration/tools/packages.ts';
import { statSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createPackageRegistry } from '#tests/support/registry/packages.ts';
import { environmentVariables, setEnvironmentVariable } from '#cli/platform/environment.ts';
import type { ReadPackageInputsResult, CreatePackageProjectResult } from '#tests/types/results.ts';

// The authored files every package project starts from.
const AUTHORED_FILES = {
    'other/package.json': '{"private":true,"packageManager":"npm@99.0.0"}',
    'source.js': 'export const greeting="hello";',
    'node_modules/authored.txt': 'keep project dependencies',
};

const PRETTIER: RegistryPackage = {
    name: 'prettier',
    source: dirname(fileURLToPath(import.meta.resolve('prettier/package.json'))),
    version: '3.8.1',
    bin: { prettier: 'bin/prettier.cjs' },
};
const PACKAGES: Record<'mise' | 'none', RegistryPackage[]> = {
    mise: [PRETTIER],
    none: [
        PRETTIER,
        {
            name: 'editorconfig-checker',
            source: 'editorconfig-checker@7.0.0',
            version: '7.0.0',
            bin: { ec: 'dist/index.js', 'editorconfig-checker': 'dist/index.js' },
        },
    ],
};

const RUNNER_POLICY = { mise: '[runner]\ntool = "mise"\n', none: '' };

/** Captures the generated manifest, lock, and ownership bytes before an installation journey. */
export function readPackageInputs(root: string, client: PackageClient): ReadPackageInputsResult {
    const lockPath = join(root, '.gspot', LOCKS[client]);
    const ownershipPath = join(root, '.gspot/state/ownership.json');
    return {
        manifest: readFileSync(join(root, '.gspot/package.json')),
        lockPath,
        lock: readFileSync(lockPath),
        mode: statSync(lockPath).mode,
        ownershipPath,
        ownership: readFileSync(ownershipPath),
    };
}

/** Creates an authenticated registry and an authored project for a native package manager. */
export async function createPackageProject(
    client: PackageClient,
    projectPath: string,
    runner: 'mise' | 'none',
): Promise<CreatePackageProjectResult> {
    const resources = new AsyncDisposableStack();
    try {
        const directory = resources.use(await testdir());
        const root = join(directory.path, 'repository');
        const artifacts = join(directory.path, 'artifacts');
        mkdirSync(artifacts);
        const registry = resources.use(await createPackageRegistry(artifacts, PACKAGES[runner]));
        const previous = Object.fromEntries(
            ['YARN_CACHE_FOLDER', 'YARN_GLOBAL_FOLDER'].map((name) => [name, environmentVariables()[name]]),
        );
        resources.defer(() => {
            for (const [name, value] of Object.entries(previous)) setEnvironmentVariable(name, value);
        });
        setEnvironmentVariable('YARN_GLOBAL_FOLDER', join(artifacts, 'resolution-global'));
        setEnvironmentVariable('YARN_CACHE_FOLDER', join(artifacts, 'resolution-cache'));
        const version = await run([client, '--version'], { cwd: artifacts, timeoutMs: 15_000 });
        if (version.code !== 0) throw new Error(`Package manager fixture failed: ${version.stdout}${version.stderr}`);
        const rootPackage = JSON.stringify({
            private: true,
            packageManager: `${client}@${version.stdout.trim()}`,
            devDependencies: { eslint: '0.0.0-authored' },
            scripts: { test: 'authored-command' },
            workspaces: ['**'],
        });
        await createFileTree(root, {
            [projectPath]: rootPackage,
            ...(projectPath === 'package.json' ? { 'pnpm-workspace.yaml': 'packages:\n  - "**"\n' } : {}),
            '.npmrc': `registry=${registry.url}/\nalways-auth=true\n${registry.url.replace('http:', '')}/:_authToken=${registry.token}\n`,
            'gspot.toml': `version = 1\nlevel = "recommended"\nconfigurations = ["formatting"]\n${RUNNER_POLICY[runner]}[rules]\ninstall = false\n`,
            ...AUTHORED_FILES,
        });
        const yarnConfiguration =
            client === 'yarn' && Number(version.stdout.trim().split('.', 1)[0]) >= 2
                ? `npmRegistryServer: "${registry.url}"\nnpmAuthToken: "${registry.token}"\nnpmAlwaysAuth: true\nunsafeHttpWhitelist: ["127.0.0.1"]\n`
                : undefined;
        if (yarnConfiguration !== undefined)
            writeFileSync(join(root, '.yarnrc.yml'), yarnConfiguration, { mode: 0o600 });
        const initialized = await run(['git', 'init', '--quiet'], { cwd: root });
        if (initialized.code !== 0) throw new Error(`Package project Git setup failed: ${initialized.stderr}`);
        return {
            root,
            artifacts,
            registry,
            rootPackage,
            yarnConfiguration,
            version: version.stdout.trim(),
            async [Symbol.asyncDispose]() {
                await resources.disposeAsync();
            },
        };
    } catch (error) {
        await resources.disposeAsync();
        throw error;
    }
}
