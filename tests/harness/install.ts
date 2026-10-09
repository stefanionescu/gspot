import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { readPolicy } from '#cli/policy/public.ts';
import { emitAll } from '#cli/generation/public.ts';
import { compact } from '#cli/platform/contracts.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { join, dirname, delimiter } from 'node:path';
import { openSession } from '#cli/commands/public.ts';
import { openRoot } from '#cli/platform/root/public.ts';
import { rootView } from '#cli/policy/settings/public.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { applicableManifests } from '#cli/planning/public.ts';
import { packageToolProject } from '#cli/tools/npm/public.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { TOOL_CACHE_FOLDER } from '#tests/config/harness/install.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { planReplacement } from '#cli/lifecycle/ownership/contracts.ts';
import { createInstallationRegistry } from '#tests/harness/registry.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';
import { applyPlan, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { toolPin, toolProjectPackage } from '#cli/configurations/contracts.ts';
import { installTree, readInstalledTree } from '#cli/lifecycle/ownership/state/public.ts';
import { hasValePackages, installValePackages } from '#cli/lifecycle/install/contracts.ts';
import type { SharedToolProject, SandboxInstallation } from '#tests/types/harness/install.ts';
import { testModules, installedModules, sourceLauncherDirectory } from '#tests/harness/environment.ts';

import {
    UV_LOCKFILE,
    VALE_CONFIG,
    TOOL_PYTHON_PROJECT,
    TOOL_PACKAGE_PROJECT,
    VALE_PACKAGE_DIRECTORY,
    NODE_MODULES_DIRECTORY,
} from '#cli/config/platform/locations.ts';

/**
 * Remove optional sandbox configurations through the public mutation pipeline.
 * @param cwd the initialized sandbox repository.
 * @param configurations the configurations the sandbox removes.
 * @param environment the sandbox's isolated environment.
 */
async function removeConfigurations(
    cwd: string,
    configurations: string[],
    environment: Record<string, string>,
): Promise<void> {
    const selected = new Set(readPolicy(cwd).policy.configurations);
    const chosen = configurations.filter((name) => selected.has(name));
    for (const configuration of chosen) {
        const removed = await spawnGspot(cwd, ['remove', configuration], environment);
        if (removed.code !== 0)
            throw new Error(
                `Sandbox removal of ${configuration} failed with status ${String(removed.code)}: ${removed.stderr}${removed.stdout}`,
            );
    }
}

const npmProjects = new Map<string, Promise<SharedToolProject>>();
const valeProjects = new Map<string, Promise<string>>();

// The runner owns these files until every native test and child command has finished.
function cacheDirectory(inputs: string[]): string {
    const archives = environmentVariables()['GSPOT_PACKAGE_ARCHIVES'];
    if (archives === undefined) throw new Error('Run native tool tests through mise run test:tools.');
    const key = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
    return join(dirname(archives), TOOL_CACHE_FOLDER, key);
}

// Cache the first actual public installation, whose native descriptors validate locks and tools.
async function prepareNpmProject(root: string, inputs: GeneratedFile[]): Promise<SharedToolProject> {
    const directory = cacheDirectory(inputs.flatMap(({ path, content }) => [path, content]));
    let prepared = npmProjects.get(directory);
    if (prepared === undefined) {
        prepared = (async () => {
            await installToolProjects(root);
            await mkdir(directory, { recursive: true });
            using files = openRoot(root);
            using log = openOwnership(directory);
            const path = packageToolProject.lockfilePath(packageToolProject.parse(inputs[0]!.content));
            const lockfile: GeneratedFile = { path, content: files.read(path)!.bytes.toString('utf8'), kind: 'lock' };
            for (const file of [...inputs, lockfile])
                applyPlan(
                    log,
                    planReplacement(log, {
                        path: file.path,
                        next: { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE },
                        kind: file.kind === 'lock' ? 'lock' : 'tool_file',
                    }),
                );
            installTree(log, 'npm', readInstalledTree(files.realPath(NODE_MODULES_DIRECTORY), 'npm'));
            return { directory, lockfile };
        })();
        npmProjects.set(directory, prepared);
    }
    return prepared;
}

// Only upstream packages are cached; each fixture keeps its own generated styles and vocabulary.
async function prepareValeProject(session: ToolSession): Promise<string> {
    using files = openRoot(session.root);
    const tool = toolPin(applicableManifests(session), 'vale');
    const directory = cacheDirectory([JSON.stringify(tool), files.read(VALE_CONFIG)!.bytes.toString('utf8')]);
    let prepared = valeProjects.get(directory);
    if (prepared === undefined) {
        prepared = (async () => {
            await mkdir(directory, { recursive: true });
            using log = openOwnership(directory);
            if (hasValePackages(session.root, session.policyFiles.policy.level)) {
                installTree(log, 'vale', readInstalledTree(files.realPath(VALE_PACKAGE_DIRECTORY), 'vale'));
                return directory;
            }
            const problem = await installValePackages({
                owner: {
                    read: files.read.bind(files),
                    installTree: (kind, source) => {
                        installTree(log, kind, readInstalledTree(source, kind));
                    },
                },
                search: session,
                tool,
                level: session.policyFiles.policy.level,
                timeoutSeconds: Number(rootView(session.scopes).settings['tool_timeout_seconds']),
            });
            if (problem !== undefined) throw new Error(problem);
            return directory;
        })();
        valeProjects.set(directory, prepared);
    }
    return await prepared;
}

/**
 * A PATH for pinned mise tools and workspace commands; sandboxes own their tool projects.
 * @param names the tool names as mise knows them (`taplo`, `npm:v8r`).
 * @returns the PATH value.
 */
export function buildToolsPath(names: string[]): string {
    const manifests = [...configurationManifests().values()];
    const bins = [testModules, installedModules].map((folder) => join(folder, '.bin'));
    const path = [...bins, environmentVariables()['PATH'] ?? ''].join(delimiter);
    for (const name of names) {
        const tool = toolPin(manifests, name.replace(/^[a-z]+:/u, ''));
        if (tool.system === true || toolProjectPackage(tool) !== undefined) continue;
        // A pin without a build for this machine is skipped by the checks that need it, so no PATH entry is owed.
        if (!hasToolBuild(tool.name)) continue;
        if (Bun.which(tool.name, { PATH: path }) === null)
            throw new Error(`Required test tool ${name} is unavailable. Run mise run test:tools.`);
    }
    return path;
}

/**
 * Build the complete sandbox PATH with the source launcher and test package bins first.
 * @param names the pinned native tools required by the scenario.
 * @returns the sandbox PATH.
 */
export function buildSandboxPath(names: string[]): string {
    const tools = buildToolsPath(names);
    return [sourceLauncherDirectory, tools].join(delimiter);
}

/**
 * Run gspot init. Remove the named configurations and install the tool projects.
 * @param cwd the sandbox, with one commit.
 * @param argv the init command line.
 * @param environment verbatim variables, such as the PATH of the tools.
 * @param settings the configurations to omit and the level to select before installing tools.
 */
export async function initRepository(
    cwd: string,
    argv: string[],
    environment: Record<string, string>,
    settings: SandboxInstallation = {},
): Promise<void> {
    const outcome = await spawnGspot(cwd, [...argv, '--no-install'], environment);
    if (outcome.code !== 0)
        throw new Error(`Sandbox init failed with status ${String(outcome.code)}: ${outcome.stderr}${outcome.stdout}`);
    const { without = [], level } = settings;
    if (level !== undefined) {
        const selected = await spawnGspot(cwd, ['set', 'level', level], environment);
        if (selected.code !== 0)
            throw new Error(`The ${level} level was not selected: ${selected.stdout}${selected.stderr}`);
    }
    await removeConfigurations(cwd, without, environment);
    const shared = await shareToolProjects(cwd);
    Object.assign(environment, shared);
    if (shared['PATH'] !== undefined) environment['PATH'] = [sourceLauncherDirectory, shared['PATH']].join(delimiter);
}

/** Install generated, locked tool projects through the public command. */
export async function installToolProjects(cwd: string): Promise<void> {
    await using registry = await createInstallationRegistry(cwd, runTestCommand);
    const outcome = await spawnGspot(cwd, ['install'], registry.environment);
    if (outcome.code !== 0)
        throw new Error(
            `Sandbox installation failed with status ${String(outcome.code)}: ${outcome.stderr}${outcome.stdout}`,
        );
}

/**
 * Prepare selected native tool projects from this suite's managed installations.
 * @param root the initialized native-check fixture
 * @returns the actual Python environment, or no additional environment without Python tools
 */
export async function shareToolProjects(root: string): Promise<Record<string, string>> {
    let environment: Record<string, string> = {};
    {
        using files = openRoot(root);
        if (files.read(TOOL_PYTHON_PROJECT) !== undefined) environment = await sharePythonTools(root);
    }
    let npm: SharedToolProject | undefined;
    {
        using files = openRoot(root);
        const inputs: GeneratedFile[] = [TOOL_PACKAGE_PROJECT, ...packageToolProject.additionalPaths].flatMap(
            (path) => {
                const file = files.read(path);
                return file === undefined ? [] : [{ path, content: file.bytes.toString('utf8'), kind: 'tool_file' }];
            },
        );
        if (inputs.some(({ path }) => path === TOOL_PACKAGE_PROJECT)) npm = await prepareNpmProject(root, inputs);
    }
    const session = await openSession(root);
    const generated = emitAll(session);
    using log = openOwnership(root);
    const pythonLock = log.files.read(UV_LOCKFILE);
    if (pythonLock !== undefined)
        generated.files.push({
            path: UV_LOCKFILE,
            content: pythonLock.bytes.toString('utf8'),
            kind: 'lock',
            read: pythonLock,
        });
    if (npm !== undefined)
        generated.files.push({ ...npm.lockfile, ...compact({ read: log.files.read(npm.lockfile.path) }) });
    writeGeneratedFiles(session, generated, log);
    if (npm !== undefined)
        installTree(log, 'npm', readInstalledTree(join(npm.directory, '.gspot/node_modules'), 'npm'));
    if (generated.files.some(({ path }) => path === VALE_CONFIG) && session.policyFiles.policy.level === 'all') {
        const vale = await prepareValeProject(session);
        installTree(log, 'vale', readInstalledTree(join(vale, VALE_PACKAGE_DIRECTORY), 'vale'));
    }
    return environment;
}
