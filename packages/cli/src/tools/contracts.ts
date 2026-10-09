import which from 'which';
import semver from 'semver';
import { isDeepStrictEqual } from 'node:util';
import { openRoot } from '#cli/platform/root/public.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import type { ToolRunOptions } from '#cli/types/tools/run.ts';
import { TOOL_DEADLINE } from '#cli/config/policy/settings.ts';
import { MS_PER_SECOND } from '#cli/config/platform/runtime.ts';
import { installedPackage } from '#cli/repository/contracts.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { getGitEnvironment } from '#cli/platform/git/contracts.ts';
import { parseVersionOutput } from '#cli/parsers/tool/contracts.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { join, dirname, basename, relative, isAbsolute } from 'node:path';
import type { ToolPin, ParsedToolVersion } from '#cli/types/parsers/tool.ts';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';
import { statSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import type { ToolProject, ToolProjectPlan } from '#cli/types/tools/project.ts';
import { misePin, isBelowFloor, toolProjectPackage } from '#cli/configurations/contracts.ts';
import { compact, toPosix, environmentBin, executableNames } from '#cli/platform/contracts.ts';
import { run, miseHome, GspotError, runBlocking, environmentVariables } from '#cli/platform/public.ts';
import type { ToolOwner, LocateOptions, ToolInspection, LockfilePreparation } from '#cli/types/tools/install.ts';

import {
    DOT_GSPOT,
    NODE_MODULES_DIRECTORY,
    INSTALLATION_DIRECTORIES,
    PYTHON_ENVIRONMENT_DIRECTORY,
} from '#cli/config/platform/locations.ts';
import {
    SETUP,
    TOOL_ENV,
    HOST_HINTS,
    URL_CREDENTIALS,
    VERSION_TIMEOUT_MS,
    AUTHORIZATION_HEADER,
    INSTALL_OUTPUT_LIMIT,
    CREDENTIAL_ASSIGNMENT,
    SECRET_ENVIRONMENT_KEY,
} from '#cli/config/tools/install.ts';

// The folders a tool-project executable, or a host tool, is located in. A copy has no tool projects or virtual
// environments of its own: they run from the working tree the copy stands for.
function searchDirectories(root: string, options: LocateOptions): string[] {
    const { searchFolders, toolProjectKind, installedRoot = root } = options;
    if (toolProjectKind === 'npm') return [join(installedRoot, NODE_MODULES_DIRECTORY, '.bin')];
    if (toolProjectKind === 'python') return [environmentBin(join(installedRoot, PYTHON_ENVIRONMENT_DIRECTORY))];
    // A copy's tool projects run from the original working tree.
    return [...new Set(searchFolders)].flatMap((folder) => [
        join(
            basename(folder) === DOT_GSPOT ? join(installedRoot, relative(root, folder)) : folder,
            'node_modules',
            '.bin',
        ),
        environmentBin(join(installedRoot, relative(root, folder), '.venv')),
    ]);
}

// Whether a candidate exists: a managed path must resolve through the root boundary, any other is read from disk.
function candidateExists(files: Root, root: string, path: string): boolean {
    const local = toPosix(relative(root, path));
    if (!local.startsWith(`${DOT_GSPOT}/`)) return statSync(path, { throwIfNoEntry: false }) !== undefined;
    try {
        files.assertInside(local);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return false;
    }
}

// The executables of the name that exist in the repository's search folders.
function repositoryCandidates(root: string, directories: string[], names: string[]): string[] {
    using files = openRoot(root);
    const paths = directories.flatMap((directory) => names.map((file) => join(directory, file)));
    return paths.filter((path) => candidateExists(files, root, path));
}

// Resolve mise shims in the repository before tools run inside isolated source copies.
function hostCandidates(root: string, name: string, names: string[]): string[] {
    const onPath = which.sync(name, { nothrow: true });
    const launcherDirectory = join(miseHome(), 'shims');
    const found = names
        .map((file) => join(launcherDirectory, file))
        .filter((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    const candidates = [...new Set(onPath === null ? found : [onPath, ...found])];
    const mise = which.sync('mise', { nothrow: true });
    return candidates.flatMap((path) => {
        if (!path.startsWith(`${launcherDirectory}/`) && !path.startsWith(`${launcherDirectory}\\`)) return [path];
        if (mise === null) return [];
        const resolved = runBlocking([mise, 'which', name], { cwd: root, timeoutMs: VERSION_TIMEOUT_MS });
        return resolved.code === 0 ? [resolved.stdout.trim()] : [];
    });
}

// The version the first package.json above a folder declares for the named package, searching upward.
function versionAbove(files: Root | undefined, root: string, start: string, name: string): string | undefined {
    for (let folder = start; folder !== dirname(folder); folder = dirname(folder)) {
        const manifest = join(folder, 'package.json');
        if (files !== undefined && !toPosix(relative(root, manifest)).startsWith(`${DOT_GSPOT}/`)) return undefined;
        const parsed = installedPackage(files, root, manifest);
        if (parsed?.name === name) return parsed.version;
    }
    return undefined;
}

/**
 * The install command for managed tools, or platform guidance for a host tool.
 * @param tool the pin
 * @param runner the declared installation integration
 * @returns the hint
 */
export function installHint(tool: ToolPin, runner?: string): string {
    if (toolProjectPackage(tool) !== undefined || (tool.system !== true && runner === 'mise'))
        return 'Run: gspot install';
    const [command] = OPERATING_SYSTEMS.filter(({ node }) => node === process.platform).flatMap((system) =>
        system.installers.flatMap(({ installer, command }) => {
            const pin = tool.installers[installer];
            return pin === undefined ? [] : [`${command} ${pin.name}`];
        }),
    );
    if (command !== undefined) return command;
    if (tool.system === true) return HOST_HINTS[tool.name] ?? `install ${tool.name}`;
    const pin = misePin(tool);
    if (pin === undefined) return `Install ${tool.name} using its supported installer.`;
    const requirement = [pin.name, pin.version].filter((value) => value !== undefined).join('@');
    return `Install mise (https://mise.jdx.dev/getting-started.html), then run: mise install ${requirement}`;
}

// A missing executable or outdated version needs the install command recorded by its inspection.
/**
 * Explain why the required tool cannot run.
 * @param tool the declared tool
 * @param inspection the observed installation
 * @returns the actionable installation note
 */
export function unavailableNote(tool: ToolPin, inspection: ToolInspection): string {
    const hint = inspection.hint ?? installHint(tool);
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    return inspection.state === 'outdated'
        ? `${tool.name} ${inspection.found ?? '?'} is below ${inspection.floor ?? '?'}. ${hint}`
        : `${tool.name}${version} is not installed. ${hint}`;
}

/**
 * Classify a reported version against its pin and floor.
 * @param found the version the tool reported
 * @param want the pinned version
 * @param floor the lowest version the configuration accepts
 * @returns ok, outdated below the floor, newer above the pin, or error for no version
 */
export function toolVersionState(
    found: string,
    want: string | undefined,
    floor: string | undefined,
): ToolInspection['state'] {
    if (want === undefined) return isBelowFloor(found, floor) ? 'outdated' : 'host';
    const version = semver.coerce(found);
    if (version === null) return 'error';
    if (isBelowFloor(found, floor)) return 'outdated';
    const pinned = semver.coerce(want);
    return pinned !== null && semver.gt(version, pinned) ? 'newer' : 'ok';
}

/**
 * Executables owned by the repository or its selected tool project installation, without PATH tools.
 * @param root the repository root
 * @param name the executable name
 * @param options the search folders and installation ownership
 * @returns repository candidates in preference order
 */
export function locateRepositoryCandidates(root: string, name: string, options: LocateOptions): string[] {
    if (isAbsolute(name)) return statSync(name, { throwIfNoEntry: false }) === undefined ? [] : [name];
    return repositoryCandidates(root, searchDirectories(root, options), executableNames(name));
}

/**
 * Every executable of the name, in the order gspot prefers them.
 * @param root the repository root.
 * @param name the executable name.
 * @param options the search folders and tool project installation ownership.
 * @returns the paths that exist.
 */
export function locateCandidates(root: string, name: string, options: LocateOptions): string[] {
    const found = locateRepositoryCandidates(root, name, options);
    if (isAbsolute(name) || options.toolProjectKind !== undefined) return found;
    return [...found, ...hostCandidates(options.installedRoot ?? root, name, executableNames(name))];
}

/**
 * The version a package.json above the real file of an npm tool holds, for the package the pin names.
 * @param root the repository root.
 * @param path the executable.
 * @param name the package name, or undefined when the tool is not an npm package.
 * @returns the declared version, or undefined when no package.json above the file names the package.
 */
export function packageVersion(root: string, path: string, name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    using files = toPosix(relative(root, path)).startsWith(`${DOT_GSPOT}/`) ? openRoot(root) : undefined;
    const folder = dirname(files === undefined ? realpathSync(path) : files.realPath(toPosix(relative(root, path))));
    // A Windows shim in node_modules/.bin is a file of its own, not a link into its package, so the package is
    // found by name beside that folder.
    const start = basename(folder) === '.bin' ? join(dirname(folder), name) : folder;
    return versionAbove(files, root, start, name);
}

/**
 * Preview the install command, lockfile, and environment phases without running them.
 * @param root the repository root.
 * @param description the project's native behavior.
 * @param proposed the generated manifest, or undefined to read its recorded bytes.
 * @param runner the authored installation integration.
 * @param options the lockfile preparation request.
 * @param options.refreshLockfiles resolve declared pins again.
 * @returns the native commands in their required phases.
 */
export function toolInstallationPlan<Parsed, Preparation, Installation>(
    root: string,
    description: ToolProject<Parsed, Preparation, Installation>,
    proposed: string | undefined,
    runner: string | undefined,
    { refreshLockfiles }: LockfilePreparation,
): ToolProjectPlan {
    using files = openRoot(root);
    const manifest = proposed ?? files.read(description.manifestPath)?.bytes.toString('utf8');
    if (manifest === undefined) return { installer: [], lockfile: [], environment: [] };
    const project = description.parse(manifest);
    const commands = description.commands(project, runner);
    if (
        !refreshLockfiles &&
        description.matches(project, files.read(description.lockfilePath(project))?.bytes.toString('utf8'))
    )
        commands.lockfile = [];
    return commands;
}

/**
 * Prepare one normal generated lockfile, retaining this root's observed original for its writer.
 * @param description the project's native behavior.
 * @param manifest the generated project bytes.
 * @param owner the repository reader.
 * @param options the lockfile preparation request.
 * @param options.refreshLockfiles resolve declared pins again.
 * @param preparation the native resolution inputs.
 * @returns the prepared lockfile and current root's expected read.
 */
export async function prepareToolProject<Parsed, Preparation, Installation>(
    description: ToolProject<Parsed, Preparation, Installation>,
    manifest: GeneratedFile,
    owner: Pick<ToolOwner, 'read'>,
    { refreshLockfiles }: LockfilePreparation,
    preparation: Preparation,
): Promise<GeneratedFile> {
    const project = description.parse(manifest.content);
    const path = description.lockfilePath(project);
    const original = owner.read(path);
    const recorded = refreshLockfiles ? undefined : original?.bytes.toString('utf8');
    let content = description.current(project, recorded, manifest.content, owner, preparation);
    if (content === undefined) {
        using work = scratchFolder(description.lockPrefix);
        writeFileSync(join(work.path, basename(description.manifestPath)), manifest.content);
        content = await description.createLockfile(work.path, preparation, recorded, project);
    }
    return { path, content, kind: 'lock', ...compact({ read: original }) };
}

/**
 * Install immutable project inputs in scratch and publish only a verified complete installation.
 * @param description the project's native behavior.
 * @param owner the reader and installation writer.
 * @param installation the native installer inputs.
 * @returns the installed-project summary, or an empty string without its manifest.
 */
export async function installToolProject<Parsed, Preparation, Installation>(
    description: ToolProject<Parsed, Preparation, Installation>,
    owner: ToolOwner,
    installation: Installation,
): Promise<string> {
    const manifest = owner.read(description.manifestPath);
    if (manifest === undefined) return '';
    const project = description.parse(manifest.bytes.toString('utf8'));
    const lockfilePath = description.lockfilePath(project);
    const lockfile = owner.read(lockfilePath);
    if (lockfile === undefined || !description.matches(project, lockfile.bytes.toString('utf8')))
        throw new GspotError('installation', SETUP);
    const inputs = new Map([
        [description.manifestPath, manifest],
        [lockfilePath, lockfile],
        ...description.additionalPaths.map((path) => [path, owner.read(path)] as const),
    ]);
    using work = scratchFolder(description.installPrefix);
    for (const [path, file] of inputs)
        if (file !== undefined) writeFileSync(join(work.path, basename(path)), file.bytes);
    const summary = await description.install(
        work.path,
        installation,
        {
            scratch: (message) => {
                if (
                    !readFileSync(join(work.path, basename(description.manifestPath))).equals(manifest.bytes) ||
                    !readFileSync(join(work.path, basename(lockfilePath))).equals(lockfile.bytes)
                )
                    throw new GspotError('installation', message);
            },
            source: (message) => {
                for (const [path, original] of inputs)
                    if (!isDeepStrictEqual(owner.read(path), original)) throw new GspotError('installation', message);
            },
        },
        project,
    );
    owner.installTree(description.kind, join(work.path, basename(INSTALLATION_DIRECTORIES[description.kind])));
    return summary;
}

/**
 * Runs a tool command with the shared output environment and configured deadline.
 * @param command the expanded argument vector
 * @param options the command directory, environment, deadline, and cancellation
 * @returns the completed process result
 */
export async function runTool(command: string[], options: ToolRunOptions): Promise<SpawnResult> {
    const { timeoutSeconds = TOOL_DEADLINE.default, cancelSignal, ...prepared } = options;
    if (cancelSignal?.aborted === true)
        return {
            code: 1,
            stdout: '',
            stderr: 'The command was canceled.',
            missing: false,
            duration: 0,
            isCanceled: true,
        };
    const selected = await getGitEnvironment(prepared.cwd, command, {
        env: { ...TOOL_ENV, ...prepared.env },
        timeoutMs: timeoutSeconds * MS_PER_SECOND,
        cancelSignal,
    });
    if ('failure' in selected) return selected.failure;
    return run(command, {
        ...prepared,
        env: selected.env,
        timeoutMs: timeoutSeconds * MS_PER_SECOND,
        cancelSignal,
    });
}

/**
 * Reject a generated lockfile containing a configured credential in either URL representation.
 * @param lockfile the native manager's lockfile output
 * @param credentials the raw and decoded registry credentials
 * @param failure the installation owner's error, without credential values
 */
export function assertCredentialFreeLockfile(lockfile: string, credentials: string[], failure: Error): void {
    for (const credential of credentials) {
        if (lockfile.includes(credential) || lockfile.includes(encodeURIComponent(credential))) throw failure;
    }
}

/**
 * Add a connection setting under an unused environment variable and return its reference.
 * @param env the installation environment receiving the value
 * @param prefix the variable prefix for this package manager
 * @param value the connection setting kept out of generated files
 * @returns a package-manager environment reference
 */
export function addEnvironmentReference(env: Record<string, string>, prefix: string, value: string): string {
    let index = 0;
    while (Object.hasOwn(env, `${prefix}${String(index)}`)) index += 1;
    const name = `${prefix}${String(index)}`;
    env[name] = value;
    return `\${${name}}`;
}

/**
 * Read both encoded and decoded passwords from a registry or proxy URL.
 * @param source the authored URL
 * @returns password representations excluded from generated lockfiles and diagnostics
 */
export function registryPasswords(source: string): string[] {
    const password = new URL(source).password;
    if (password.length === 0) return [];
    return [password, decodeURIComponent(password)];
}

/**
 * Retain bounded installation output after removing configured and printed credentials.
 * @param result the captured package-manager streams
 * @param credentials credentials read from repository registry settings
 * @returns the redacted tail, or an explicit absence of diagnostics
 */
export function installationDiagnostics(result: Pick<SpawnResult, 'stdout' | 'stderr'>, credentials: string[]): string {
    const inherited = Object.entries(environmentVariables())
        .filter(([key]) => SECRET_ENVIRONMENT_KEY.test(key))
        .map(([, value]) => value);
    const secrets = [...new Set([...credentials, ...inherited].filter((value) => value !== ''))]
        .flatMap((value) => [value, encodeURIComponent(value), Buffer.from(value).toString('base64')])
        .toSorted((left, right) => right.length - left.length);
    let output = `${result.stdout}\n${result.stderr}`;
    for (const secret of secrets) output = output.replaceAll(secret, '[redacted]');
    output = output
        .replace(URL_CREDENTIALS, '$1[redacted]@')
        .replace(CREDENTIAL_ASSIGNMENT, '$1[redacted]')
        .replace(AUTHORIZATION_HEADER, '$1[redacted]')
        .trim();
    if (output === '') return 'The package manager provided no diagnostics.';
    return output.length > INSTALL_OUTPUT_LIMIT
        ? `[Earlier output omitted]\n${output.slice(-INSTALL_OUTPUT_LIMIT)}`
        : output;
}

/**
 * Read native version output, using installed npm metadata when the declared package supplies the executable.
 * @param root the installation root
 * @param cwd the project working folder
 * @param path the resolved native executable
 * @param tool the declared version query and package
 * @returns the version or the native query failure
 */
export function readToolVersion(root: string, cwd: string, path: string, tool: ToolPin): ParsedToolVersion {
    const npm = tool.installers['npm'];
    const installedVersion = packageVersion(root, path, npm?.name);
    const result = runBlocking([path, ...(tool.version_command ?? ['--version'])], {
        cwd,
        timeoutMs: VERSION_TIMEOUT_MS,
        env: { NO_COLOR: '1', ...tool.env },
    });
    return parseVersionOutput(tool, result, installedVersion);
}
