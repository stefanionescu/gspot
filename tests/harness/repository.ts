// Sandbox for framework checks with installed tool projects, selected configurations, and the initial level.
import { join } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
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
    RepositorySetup,
    RepositoryScenario,
    OwnedTestRepository,
    RuntimeEvidenceCase,
} from '#tests/types/harness/repository.ts';

// The manifest a sandbox with dependencies starts from.
function buildManifest(dependencies: Record<string, string> | undefined): Record<string, string> {
    if (dependencies === undefined) return {};
    const manifest = {
        name: 'example',
        version: '1.0.0',
        private: true,
        description: 'A sandbox.',
        type: 'module',
        dependencies,
    };
    return { 'package.json': `${JSON.stringify(manifest, null, 4)}\n` };
}

// Initializes the configurations with their tool projects installed, selects the level, and returns the command environment.
async function installTools(root: string, sandbox: RepositorySetup): Promise<Record<string, string>> {
    const environment = { PATH: buildSandboxPath(['typos', 'ec', 'ast-grep', ...(sandbox.tools ?? [])]) };
    const argv = ['init', '--yes', '--configurations', ...sandbox.configurations, ...(sandbox.init ?? QUIET_INIT)];
    await initRepository(root, argv, environment, {
        without: sandbox.without ?? [],
        level: sandbox.level ?? 'all',
    });
    return environment;
}

/**
 * Creates a repository, installs its configurations and tool projects, and returns the command environment.
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
        ...(sandbox.tsconfig === undefined
            ? {}
            : { 'tsconfig.json': JSON.stringify(sandbox.tsconfig, null, 4) + '\n' }),
        ...sandbox.files,
    });
    if (sandbox.modules !== false) await linkInstalledModules(join(root, 'node_modules'));
    await sandbox.before?.(root);
    commitAll(root);
    if (sandbox.installs !== false) return installTools(root, sandbox);
    // Checks gspot runs itself need only the policy: no generated file, tool project, or lockfile.
    await Bun.write(join(root, 'gspot.toml'), buildPolicy(sandbox.configurations, { level: sandbox.level ?? 'all' }));
    return {};
}

/**
 * Create and prepare one owned repository for a scenario's sample and fix cases.
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
