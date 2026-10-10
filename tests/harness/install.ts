import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { readPolicy } from '#cli/policy/public.ts';
import { emitAll } from '#cli/generation/public.ts';
import { compact } from '#cli/platform/contracts.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { join, dirname, delimiter } from 'node:path';
import { openSession } from '#cli/commands/public.ts';
import { openRoot } from '#cli/platform/root/public.ts';
import { copyInto } from '#cli/execution/copy/public.ts';
import { rootView } from '#cli/policy/settings/public.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { applicableManifests } from '#cli/planning/public.ts';
import { packageToolProject } from '#cli/tools/npm/public.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { TOOL_CACHE_FOLDER } from '#tests/config/harness/install.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { createInstallationRegistry } from '#tests/harness/registry.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';
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

const npmProjects = new Map<string, Promise<Required<SharedToolProject>>>();
const valeProjects = new Map<string, Promise<string>>();

// The runner owns these files until every native test and child command has finished.
function cacheDirectory(inputs: string[]): string {
    const archives = environmentVariables()['GSPOT_PACKAGE_ARCHIVES'];
    if (archives === undefined) throw new Error('Run native tool tests through mise run test:tools.');
    const key = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
    return join(dirname(archives), TOOL_CACHE_FOLDER, key);
}

// Cache native installations on disk; the first sandbox needs no copy.
async function prepareNpmProject(root: string, inputs: GeneratedFile[]): Promise<SharedToolProject> {
    const directory = cacheDirectory(inputs.flatMap(({ path, content }) => [path, content]));
    let prepared = npmProjects.get(directory);
    if (prepared === undefined) {
        prepared = (async () => {
            await installToolProjects(root);
            using files = openRoot(root);
            const path = packageToolProject.lockfilePath(packageToolProject.parse(inputs[0]!.content));
            const lockfile: GeneratedFile = { path, content: files.read(path)!.bytes.toString('utf8'), kind: 'lock' };
            readInstalledTree(join(root, NODE_MODULES_DIRECTORY), 'npm');
            await copyInto({
                root,
                target: directory,
                files: [],
                dependencies: [{ path: NODE_MODULES_DIRECTORY, operation: 'clone' }],
            });
            return { lockfile, directory };
        })();
        npmProjects.set(directory, prepared);
        const { lockfile } = await prepared;
        return { lockfile };
    }
    return prepared;
}

// Only upstream packages are cached; each sandbox keeps its own generated styles and vocabulary.
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
                await installTree(log, 'vale', readInstalledTree(files.realPath(VALE_PACKAGE_DIRECTORY), 'vale'));
                return directory;
            }
            const problem = await installValePackages({
                owner: {
                    read: files.read.bind(files),
                    installTree: (kind, source) => {
                        return installTree(log, kind, readInstalledTree(source, kind));
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
 * @param names the pinned executable tools required by the scenario.
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
 * @param root the initialized native-check sandbox
 * @returns the managed native command environment for the sandbox
 */
export async function shareToolProjects(root: string): Promise<Record<string, string>> {
    let environment: Record<string, string> = { PATH: buildToolsPath([]) };
    let npm: SharedToolProject | undefined;
    {
        using files = openRoot(root);
        if (files.read(TOOL_PYTHON_PROJECT) !== undefined) environment = await sharePythonTools(root);
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
    const pythonLockfile = log.files.read(UV_LOCKFILE);
    if (pythonLockfile !== undefined)
        generated.files.push({
            path: UV_LOCKFILE,
            content: pythonLockfile.bytes.toString('utf8'),
            kind: 'lock',
            read: pythonLockfile,
        });
    let directory: string | undefined;
    if (npm !== undefined) {
        generated.files.push({ ...npm.lockfile, ...compact({ read: log.files.read(npm.lockfile.path) }) });
        directory = npm.directory;
        environment['PATH'] = [join(root, NODE_MODULES_DIRECTORY, '.bin'), environment['PATH']].join(delimiter);
    }
    writeGeneratedFiles(session, generated, log);
    if (directory !== undefined)
        await installTree(log, 'npm', readInstalledTree(join(directory, NODE_MODULES_DIRECTORY), 'npm'));
    if (generated.files.some(({ path }) => path === VALE_CONFIG) && session.policyFiles.policy.level === 'all') {
        const vale = await prepareValeProject(session);
        await installTree(log, 'vale', readInstalledTree(join(vale, VALE_PACKAGE_DIRECTORY), 'vale'));
    }
    return environment;
}
