// A test repository with its private tools installed: the files, the selected configurations, and the level each framework test starts from.
import { join } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import { install, buildSandboxPath } from '#tests/harness/install.ts';
import type { CheckCommand } from '#tests/types/harness/check-case.ts';
import type { RepositorySetup, RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';

// The manifest a fixture with dependencies starts from.
function buildManifest(dependencies: Record<string, string> | undefined): Record<string, string> {
    if (dependencies === undefined) return {};
    const manifest = {
        name: 'example',
        version: '1.0.0',
        private: true,
        description: 'A test repository.',
        type: 'module',
        dependencies,
    };
    return { 'package.json': `${JSON.stringify(manifest, null, 4)}\n` };
}

// Initializes the configurations with their private tools installed, selects the level, and returns the command environment.
async function installTools(root: string, sandbox: RepositorySetup): Promise<Record<string, string>> {
    const environment = { PATH: buildSandboxPath(['typos', 'ec', 'ast-grep', ...(sandbox.tools ?? [])]) };
    const argv = ['init', '--yes', '--configurations', ...sandbox.configurations, ...(sandbox.init ?? QUIET_INIT)];
    await install(root, argv, environment, {
        without: sandbox.without ?? ['naming', 'spelling'],
        level: sandbox.level ?? 'all',
    });
    return environment;
}

/**
 * Creates a repository, installs its configurations and private tools, and returns the command environment.
 * @param root the empty sandbox
 * @param sandbox what the repository holds and selects
 * @returns the PATH every gspot command of the test runs with
 */
export async function prepareTestRepository(
    root: string,
    sandbox: RepositoryScenario,
): Promise<Record<string, string>> {
    await createFileTree(root, {
        '.gitignore': 'node_modules\n',
        ...buildManifest(sandbox.dependencies),
        ...sandbox.files,
    });
    if (sandbox.modules !== false) linkInstalledModules(join(root, 'node_modules'));
    sandbox.before?.(root);
    commitAll(root);
    if (sandbox.installs !== false) return installTools(root, sandbox);
    // Checks gspot runs itself need only the policy: no generated file, private tool, or lockfile.
    await Bun.write(join(root, 'gspot.toml'), buildPolicy(sandbox.configurations, { level: sandbox.level ?? 'all' }));
    return {};
}

/**
 * Create and prepare one owned repository for a scenario's defect and correction cases.
 * @param repository authored inputs, selected configurations, and setup callbacks
 * @param run the public CLI invocation selected by the test
 * @returns the installed repository and ownership of its temporary directory
 */
export async function createTestRepository(
    repository: RepositoryScenario,
    run: CheckCommand,
): Promise<OwnedTestRepository> {
    const sandbox = await testdir({}, repository.dirname === undefined ? {} : { dirname: repository.dirname });
    try {
        const environment = await prepareTestRepository(sandbox.path, repository);
        await repository.prepare?.(sandbox.path, environment);
        return {
            root: sandbox.path,
            environment,
            run,
            async [Symbol.asyncDispose]() {
                await sandbox[Symbol.asyncDispose]();
            },
        };
    } catch (error) {
        await sandbox[Symbol.asyncDispose]();
        throw error;
    }
}
