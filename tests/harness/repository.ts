// Sandbox for framework checks with installed tool projects, selected configurations, and the initial level.
import { join } from 'node:path';
import { afterAll, beforeAll } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/packages.ts';
import type { CheckCommand } from '#tests/types/harness/check-case.ts';
import type { CaseChanges } from '#tests/types/harness/preservation.ts';
import { initRepository, buildSandboxPath } from '#tests/harness/install.ts';

import type {
    InProcessScenario,
    InstalledScenario,
    RepositoryScenario,
    OwnedTestRepository,
    RuntimeEvidenceCase,
} from '#tests/types/harness/repository.ts';

// Write each scenario's authored project inputs before its suite prepares execution.
function writeRepository(root: string, sandbox: RepositoryScenario): Promise<void> {
    const manifest = {
        name: 'example',
        version: '1.0.0',
        private: true,
        description: 'A sandbox.',
        type: 'module',
        dependencies: sandbox.dependencies,
    };
    return createFileTree(root, {
        '.gitignore': 'node_modules\n',
        ...(sandbox.dependencies === undefined ? {} : { 'package.json': JSON.stringify(manifest, null, 4) + '\n' }),
        ...(sandbox.tsconfig === undefined
            ? {}
            : { 'tsconfig.json': JSON.stringify(sandbox.tsconfig, null, 4) + '\n' }),
        ...sandbox.files,
    });
}

/**
 * Prepare source and policy for checks that run in this process.
 * @param root the empty sandbox
 * @param sandbox authored inputs and selected configurations
 * @returns the empty command environment; no modules or tools are installed
 */
export async function prepareCliRepository(root: string, sandbox: InProcessScenario): Promise<Record<string, string>> {
    await writeRepository(root, sandbox);
    await sandbox.before?.(root);
    commitAll(root);
    await Bun.write(join(root, 'gspot.toml'), buildPolicy(sandbox.configurations, { level: sandbox.level ?? 'all' }));
    return {};
}

/**
 * Prepare a sandbox with initialized configurations and installed tool projects.
 * @param root the empty sandbox
 * @param sandbox authored inputs and native installation choices
 * @returns the PATH used by its commands
 */
export async function prepareTestRepository(root: string, sandbox: InstalledScenario): Promise<Record<string, string>> {
    await writeRepository(root, sandbox);
    await linkInstalledModules(join(root, 'node_modules'));
    await sandbox.before?.(root);
    commitAll(root);
    const environment = {
        PATH: buildSandboxPath(['typos', 'editorconfig-checker', 'ast-grep', ...(sandbox.tools ?? [])]),
    };
    const argv = ['init', '--yes', '--configurations', ...sandbox.configurations, ...(sandbox.init ?? QUIET_INIT)];
    await initRepository(root, argv, environment, {
        without: sandbox.without ?? [],
        level: sandbox.level ?? 'all',
    });
    return environment;
}

/**
 * Prepare one owned repository for sample and fix cases.
 * @param repository authored inputs and setup callbacks.
 * @param run the public CLI invocation.
 * @param prepareRepository the suite preparation.
 * @returns the repository and temporary directory ownership.
 */
export async function createTestRepository<Scenario extends RepositoryScenario>(
    repository: Scenario,
    run: CheckCommand,
    prepareRepository: (root: string, scenario: Scenario) => Promise<Record<string, string>>,
): Promise<OwnedTestRepository> {
    const sandbox = await testdir();
    try {
        const environment = await prepareRepository(sandbox.path, repository);
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

/**
 * Restore source, policy, index and generated outputs after commands mutate a shared sandbox.
 * @param repository the prepared repository and public command runner
 * @param changes the authored files and policy changed by the test
 * @returns cleanup of the test's source and generated state
 */
export async function preserveRepositoryChanges(
    repository: OwnedTestRepository,
    changes: CaseChanges,
): Promise<AsyncDisposable> {
    const { root, environment, run } = repository;
    const tree = gitOutput(root, ['write-tree']).trim();
    const restore = await applyChanges(root, changes);
    return {
        async [Symbol.asyncDispose]() {
            await restore();
            gitOutput(root, ['read-tree', tree]);
            const applied = await run(root, ['apply'], environment);
            if (applied.code !== 0) throw new Error(`Sandbox restoration failed: ${applied.stdout}${applied.stderr}`);
        },
    };
}

/**
 * Build runtime evidence rows from the declared JavaScript runtimes.
 * @returns each runtime's detection forms and one undeclared JavaScript source
 */
export function runtimeEvidenceCases(): RuntimeEvidenceCase[] {
    return [
        ...JAVASCRIPT_RUNTIMES.flatMap((runtime) => [
            {
                name: `${runtime} engine`,
                runtime,
                package: { engines: { [runtime]: '>=1' } },
                source: '',
                detected: true,
            },
            {
                name: `${runtime} script`,
                runtime,
                package: { scripts: { start: `${runtime} run entry.js` } },
                source: '',
                detected: true,
            },
            {
                name: `${runtime} shebang`,
                runtime,
                package: {},
                source: `#!/usr/bin/env ${runtime}\nconsole.log(1);\n`,
                detected: true,
            },
            {
                name: `${runtime} quoted script text`,
                runtime,
                package: { scripts: { start: `echo "${runtime} entry.js"` } },
                source: '',
                detected: false,
            },
            {
                name: `${runtime} type dependency`,
                runtime,
                package: { devDependencies: { [`@types/${runtime}`]: '1.0.0' } },
                source: '',
                detected: false,
            },
            {
                name: `${runtime} tool-project manifest`,
                runtime,
                package: {},
                source: '',
                toolProjectManifest: { engines: { [runtime]: '>=1' } },
                detected: false,
            },
        ]),
        {
            name: 'JavaScript without a declared runtime',
            runtime: 'node',
            package: {},
            source: 'console.log(1);\n',
            detected: false,
        },
    ];
}

/**
 * Share one installed sandbox for the tests registered by its caller.
 * @param scenario the authored inputs calculated when suite preparation starts
 * @returns the prepared sandbox, available after beforeAll
 */
export function shareRepository(scenario: () => InstalledScenario): () => OwnedTestRepository {
    const resources = new AsyncDisposableStack();
    let repository: OwnedTestRepository;
    beforeAll(async () => {
        repository = resources.use(await createTestRepository(scenario(), spawnGspot, prepareTestRepository));
    });
    afterAll(() => resources.disposeAsync());
    return () => repository;
}
