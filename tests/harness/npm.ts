import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { collectPins } from '#cli/configurations/pins.ts';
import { packageLockFile } from '#cli/parsers/packages.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import type { LockName } from '#cli/types/parsers/lockfiles.ts';
import type { ApplyReport } from '#cli/types/lifecycle/output.ts';
import { createPackageRegistry } from '#tests/harness/registry.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import { PACKAGE_REGISTRY_TOKEN } from '#tests/config/harness/registry.ts';
import { statSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { applicableManifests } from '#cli/execution/planning/requirements.ts';
import { RUNNER_POLICY, NO_AGENT_RULES } from '#tests/config/harness/policy.ts';
import type { PackageInputs, PackageProject, PackageProjectOptions } from '#tests/types/harness/npm.ts';

import {
    AUTHORED_FILES,
    VERSION_TIMEOUT_MS,
    EDITORCONFIG_PACKAGE,
    EXCLUDED_PACKAGE_CHECKS,
} from '#tests/config/harness/npm.ts';

async function writePackageProject(
    options: PackageProjectOptions,
): Promise<Pick<PackageProject, 'rootPackage' | 'yarnConfiguration' | 'version'>> {
    const { root, artifacts, registry, installer, projectPath, runner } = options;
    const version = await runTestCommand([installer, '--version'], { cwd: artifacts, timeoutMs: VERSION_TIMEOUT_MS });
    if (version.code !== 0) throw new Error(`Package manager fixture failed: ${version.stdout}${version.stderr}`);
    const rootPackage = JSON.stringify({
        private: true,
        packageManager: `${installer}@${version.stdout.trim()}`,
        devDependencies: { eslint: '0.0.0-authored' },
        scripts: { test: 'authored-command' },
        workspaces: ['**'],
    });
    const ignoredChecks = EXCLUDED_PACKAGE_CHECKS.map(
        (check) =>
            `[[ignore]]\ncheck = "${check}"\nreason = "The fixture exercises package-manager installation and preserves authored application dependencies."\n`,
    ).join('\n');
    await createFileTree(root, {
        [projectPath]: rootPackage,
        ...(projectPath === 'package.json' ? { 'pnpm-workspace.yaml': 'packages:\n  - "**"\n' } : {}),
        '.npmrc': `registry=${registry.url}/\nalways-auth=true\n${registry.url.replace('http:', '')}/:_authToken=${PACKAGE_REGISTRY_TOKEN}\n`,
        'gspot.toml': buildPolicy(['format'], {
            tables: RUNNER_POLICY[runner] + NO_AGENT_RULES + ignoredChecks,
            level: 'recommended',
        }),
        ...AUTHORED_FILES,
    });
    const yarnConfiguration =
        installer === 'yarn' && Number(version.stdout.trim().split('.', 1)[0]) >= 2
            ? `npmRegistryServer: "${registry.url}"\nnpmAuthToken: "${PACKAGE_REGISTRY_TOKEN}"\nnpmAlwaysAuth: true\nunsafeHttpWhitelist: ["127.0.0.1"]\n`
            : undefined;
    if (yarnConfiguration !== undefined) writeFileSync(join(root, '.yarnrc.yml'), yarnConfiguration, { mode: 0o600 });
    const initialized = await runTestCommand(['git', 'init', '--quiet'], { cwd: root });
    if (initialized.code !== 0) throw new Error(`Package project Git setup failed: ${initialized.stderr}`);
    return { rootPackage, yarnConfiguration, version: version.stdout.trim() };
}

// Prepare the fixture through the public apply/install commands and refuse conflicting starting inputs.
async function prepareToolProject(root: string): Promise<void> {
    for (const command of ['apply', 'install']) {
        const result = await spawnGspot(root, [command, '--json']);
        if (result.code !== 0) throw new Error(`Package fixture ${command} failed: ${result.stdout}${result.stderr}`);
        if (command === 'apply') {
            const preserved = (JSON.parse(result.stdout) as ApplyReport).notes.filter((note) =>
                note.startsWith('preserved'),
            );
            if (preserved.length > 0)
                throw new Error(`Package fixture preserved conflicting inputs: ${preserved.join('\n')}`);
        }
    }
}

/** Captures the generated manifest, lock, and ownership bytes before an installation journey. */
export function readPackageInputs(root: string, installer: LockName): PackageInputs {
    const lockPath = join(root, '.gspot', packageLockFile(installer));
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
    installer: LockName,
    projectPath: string,
    runner: 'mise' | 'none',
): Promise<PackageProject> {
    const resources = new AsyncDisposableStack();
    try {
        const directory = resources.use(await testdir());
        const root = join(directory.path, 'repository');
        const artifacts = join(directory.path, 'artifacts');
        mkdirSync(artifacts);
        const registry = resources.use(
            await createPackageRegistry(artifacts, {
                declarations: [
                    {
                        name: prettierManifest.name,
                        source: dirname(fileURLToPath(import.meta.resolve('prettier/package.json'))),
                        version: prettierManifest.version,
                        bin: { [prettierManifest.name]: prettierManifest.bin },
                    },
                    ...(runner === 'none' ? [EDITORCONFIG_PACKAGE] : []),
                ],
                execute: runTestCommand,
                token: PACKAGE_REGISTRY_TOKEN,
            }),
        );
        const previous = Object.fromEntries(
            ['BUN_INSTALL_CACHE_DIR', 'YARN_CACHE_FOLDER', 'YARN_GLOBAL_FOLDER'].map((name) => [
                name,
                environmentVariables()[name],
            ]),
        );
        resources.defer(() => {
            for (const [name, value] of Object.entries(previous)) setEnvironmentVariable(name, value);
        });
        setEnvironmentVariable('YARN_GLOBAL_FOLDER', join(artifacts, 'resolution-global'));
        setEnvironmentVariable('YARN_CACHE_FOLDER', join(artifacts, 'resolution-cache'));
        setEnvironmentVariable('BUN_INSTALL_CACHE_DIR', join(artifacts, 'bun-cache'));
        const authored = await writePackageProject({ root, artifacts, registry, installer, projectPath, runner });
        await prepareToolProject(root);
        return {
            root,
            artifacts,
            registry,
            tools: collectPins(applicableManifests(await openSession(root))),
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
