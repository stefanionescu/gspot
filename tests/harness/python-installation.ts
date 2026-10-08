// Bun serves the local Python index used only by private-index credential tests.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createFileTree } from 'testdirs';
import { compact } from '#cli/platform/objects.ts';
import { installUv } from '#cli/tools/python/uv.ts';
import { join, dirname, delimiter } from 'node:path';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { missingBuild } from '#cli/planning/skips.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { environmentBin } from '#cli/platform/paths.ts';
import { pythonProject } from '#cli/generation/python.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { installToolProjects } from '#tests/harness/install.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { pythonToolProject } from '#cli/tools/python/project.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import { emitAll, gitignoreBlock } from '#cli/generation/outputs.ts';
import { proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { RUNNER_POLICY, NO_AGENT_RULES } from '#tests/config/harness/policy.ts';
import { hostPlatform, environmentVariables } from '#cli/platform/environment.ts';
import type { PythonRegistry, RegistryCommand } from '#tests/types/harness/registry.ts';
import { installTree, readInstalledTree } from '#cli/lifecycle/ownership/installations.ts';
import { installToolProject, prepareToolProject, prepareToolProjects } from '#cli/tools/project.ts';
import { RUFF_VERSION_OUTPUT, PYTHON_REGISTRY_CREDENTIALS } from '#tests/config/harness/registry.ts';
import type { PythonInstallation, PythonInstallationOptions } from '#tests/types/harness/python-installation.ts';
import { UV_LOCKFILE, TOOL_PYTHON_PROJECT, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/platform/locations.ts';

import {
    REDIRECTED,
    AUTHORED_FILES,
    SUITE_PYTHON_FOLDER,
    EXCLUDED_PYTHON_CHECKS,
} from '#tests/config/harness/python-installation.ts';

const pythonLockfiles = new Map<string, Promise<string>>();

// Shared native checks select the complete sandbox environment ahead of the suite's tool bins.
function pythonEnvironment(root: string) {
    return {
        PATH: [environmentBin(join(root, PYTHON_ENVIRONMENT_DIRECTORY)), environmentVariables()['PATH'] ?? ''].join(
            delimiter,
        ),
    };
}

/**
 * Install the suite's one Python environment while its runner owns cancellation and cleanup.
 * @param root the suite-owned managed project
 * @param cancelSignal the suite run cancellation
 * @returns the managed environment bin before the declared tool bins
 */
export async function installSuitePythonTools(root: string, cancelSignal: AbortSignal): Promise<string> {
    await mkdir(root, { recursive: true });
    const generated = pythonProject(
        [...configurationManifests().values()].map((manifest) => ({
            ...manifest,
            tools: manifest.tools.filter((tool) => missingBuild(tool, hostPlatform(), process.arch) === undefined),
        })),
    );
    const executable = await installUv(root, undefined, cancelSignal);
    using log = openOwnership(root);
    await prepareToolProjects(
        { root, pythonInstaller: () => Promise.resolve(executable), cancelSignal },
        generated,
        log.files,
        {
            refreshLockfiles: false,
        },
    );
    for (const file of generated)
        applyPlan(
            log,
            proposeReplacement(log, {
                path: file.path,
                next: { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE },
                kind: file.kind === 'lock' ? 'lock' : 'config',
            }),
        );
    console.log(
        await installToolProject(
            pythonToolProject,
            {
                read: log.files.read.bind(log.files),
                installTree: (kind, directory) => {
                    installTree(log, kind, readInstalledTree(directory, kind));
                },
            },
            { root, executable, cancelSignal },
        ),
    );
    return pythonEnvironment(root).PATH;
}

/**
 * Generate the sandbox's selected configuration and share the suite's managed Python installation.
 * @param root the authored native-check repository
 * @returns the sandbox environment bin before every other tool path
 */
export async function sharePythonTools(root: string): Promise<Record<string, string>> {
    const archives = environmentVariables()['GSPOT_PACKAGE_ARCHIVES'];
    if (archives === undefined) throw new Error('Run native Python tests through mise run test:tools.');
    const session = await openSession(root);
    const generated = emitAll(session);
    const project = generated.files.find((file) => file.path === TOOL_PYTHON_PROJECT);
    if (project === undefined) throw new Error('The selected native checks need no Python tool project.');
    using log = openOwnership(root);
    const original = log.files.read(UV_LOCKFILE);
    let resolved = pythonLockfiles.get(project.content);
    if (resolved === undefined) {
        resolved = prepareToolProject(pythonToolProject, project, log.files, { refreshLockfiles: false }, session).then(
            (lockfile) => lockfile.content,
        );
        pythonLockfiles.set(project.content, resolved);
    }
    generated.files.push({
        path: UV_LOCKFILE,
        content: await resolved,
        kind: 'lock',
        ...compact({ read: original }),
    });
    writeOutputs(session, log, undefined, generated);
    installTree(
        log,
        'python',
        readInstalledTree(join(dirname(archives), SUITE_PYTHON_FOLDER, PYTHON_ENVIRONMENT_DIRECTORY), 'python'),
    );
    return pythonEnvironment(root);
}

/** Creates an authored Python project, generated lockfile, and isolated uv environment selectors. */
export async function preparePythonInstallation(
    root: string,
    options: PythonInstallationOptions,
): Promise<PythonInstallation> {
    const { indexFile, indexUrl, runner } = options;
    const ignores = EXCLUDED_PYTHON_CHECKS.map(
        (check) =>
            `[[ignore]]\ncheck = "${check}"\nreason = "This installation scenario exercises the pinned Ruff installation."\n`,
    ).join('\n');
    await createFileTree(root, {
        '.gitignore': `${gitignoreBlock()}\n.venv/\n`,
        'gspot.toml': buildPolicy(['python'], {
            tables: `${RUNNER_POLICY[runner]}${NO_AGENT_RULES}${ignores}`,
            level: 'recommended',
        }),
        ...AUTHORED_FILES,
    });
    const previous = ['UV_DEFAULT_INDEX', ...REDIRECTED].map((name) => [name, environmentVariables()[name]] as const);
    const resources = new AsyncDisposableStack();
    resources.defer(() => {
        for (const [name, value] of previous) setEnvironmentVariable(name, value);
    });
    try {
        for (const name of REDIRECTED)
            setEnvironmentVariable(name, name === 'UV_PROJECT_ENVIRONMENT' ? join(root, '.venv') : root);
        setEnvironmentVariable('UV_DEFAULT_INDEX', undefined);
        const indexPrefix = indexFile === 'pyproject.toml' ? 'tool.uv.' : '';
        const index =
            indexUrl === undefined
                ? ''
                : `[[${indexPrefix}index]]\nname = "gspot-test"\nurl = "${indexUrl}"\ndefault = true\n`;
        const authored = indexFile === 'pyproject.toml' ? await readFile(join(root, indexFile), 'utf8') : '';
        await writeFile(join(root, indexFile), authored + index);
        const rootProject = await readFile(join(root, 'pyproject.toml'));
        const rootConfiguration = await readFile(join(root, indexFile));
        const applied = await spawnGspot(root, ['apply']);
        if (applied.code !== 0) throw new Error(`Python sandbox apply failed: ${applied.stdout}${applied.stderr}`);
        return {
            root,
            rootProject,
            rootConfiguration,
            async [Symbol.asyncDispose]() {
                await resources.disposeAsync();
            },
        };
    } catch (error) {
        await resources.disposeAsync();
        throw error;
    }
}

/**
 * Install the generated pinned Python project and select its companion executables for native checks.
 * @param root the sandbox containing an applied Python tool project
 * @returns the private environment ahead of host executable shims
 */
export async function installGeneratedPythonTools(root: string): Promise<Record<string, string>> {
    await installToolProjects(root);
    return pythonEnvironment(root);
}

/**
 * Serve a wheel containing Ruff from PATH and a relocatable console entry point.
 * @param work the temporary folder receiving the wheel
 * @param execute the caller's bounded command runner
 * @returns an authenticated registry serving the wheel
 */
export async function createPythonRegistry(work: string, execute: RegistryCommand): Promise<PythonRegistry> {
    const binary = Bun.which('ruff');
    if (binary === null) throw new Error('Ruff is unavailable on PATH.');
    const inspected = await execute([binary, '--version'], { cwd: work });
    if (inspected.code !== 0) throw new Error(`Ruff version failed: ${inspected.stderr}`);
    const version = RUFF_VERSION_OUTPUT.exec(inspected.stdout.trim())?.groups?.['version'];
    if (version === undefined) throw new Error('Ruff version output is invalid.');
    const wheel = `ruff-${version}-py3-none-any.whl`;
    const packed = await execute(
        ['python3', fileURLToPath(new URL('ruff_wheel.py', import.meta.url)), binary, join(work, wheel), version],
        {
            cwd: work,
        },
    );
    if (packed.code !== 0) throw new Error(`Ruff wheel packaging failed: ${packed.stderr}`);
    const archive = await Bun.file(join(work, wheel)).bytes();
    const digest = createHash('sha256').update(archive).digest('hex');
    const { user, password } = PYTHON_REGISTRY_CREDENTIALS;
    const credentials = `${user}:${password}`;
    const authentication = `Basic ${Buffer.from(credentials).toString('base64')}`;
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            if (request.headers.get('authorization') !== authentication)
                return new Response('Authentication required', { status: 401 });
            if (new URL(request.url).pathname.endsWith('.whl')) return new Response(archive);
            return new Response(`<a href="/${wheel}#sha256=${digest}">${wheel}</a>`, {
                headers: { 'content-type': 'text/html' },
            });
        },
    });
    return {
        version,
        url: `http://${user}:${password}@127.0.0.1:${String(server.port)}/simple`,
        async [Symbol.asyncDispose]() {
            await server.stop(true);
        },
    };
}
