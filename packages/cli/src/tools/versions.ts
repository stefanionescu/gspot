import semver from 'semver';
import { realpathSync } from 'node:fs';
import { toPosix } from '#cli/system/paths.ts';
import { stripVTControlCharacters } from 'node:util';
import { runBlocking } from '#cli/system/processes.ts';
import { NPM_BIN_FOLDER } from '#cli/config/tools/find.ts';
import { openSafeFolder } from '#cli/system/files/open.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { toolTimeoutMilliseconds } from '#cli/tools/run.ts';
import { join, dirname, basename, relative } from 'node:path';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { SafeFolder } from '#cli/types/system/safe-folder.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { installedPackage } from '#cli/repository/dependency-files.ts';
import { TOOL_ENV, NO_VERSION, VERSION_FLAG } from '#cli/config/tools/run.ts';
import type { ToolInspection, ParsedToolVersion } from '#cli/types/tools/find.ts';

// The version the first package.json above a folder declares for the named package, searching upward.
function versionAbove(files: SafeFolder | undefined, root: string, start: string, name: string): string | undefined {
    for (let folder = start; folder !== dirname(folder); folder = dirname(folder)) {
        const manifest = join(folder, 'package.json');
        if (files !== undefined && !toPosix(relative(root, manifest)).startsWith(`${DOT_GSPOT}/`)) return undefined;
        const parsed = installedPackage(files, root, manifest);
        if (parsed?.name === name) return parsed.version;
    }
    return undefined;
}

/**
 * The version a package.json above the real file of an npm tool holds, for the package the pin names.
 *
 * @param root the repository root.
 * @param path the executable.
 * @param name the package name, or undefined for tools outside npm.
 *
 * @returns the declared version, or undefined when no package.json above the file names the package.
 */
function packageVersion(root: string, path: string, name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    using files = toPosix(relative(root, path)).startsWith(`${DOT_GSPOT}/`) ? openSafeFolder(root) : undefined;
    const folder = dirname(files === undefined ? realpathSync(path) : files.realPath(toPosix(relative(root, path))));
    // A Windows shim in node_modules/.bin has its own file, so find its package
    // found by name beside that folder.
    const start = basename(folder) === basename(NPM_BIN_FOLDER) ? join(dirname(folder), name) : folder;
    return versionAbove(files, root, start, name);
}

function parsedVersion(text: string, tool: ToolDeclaration): string | undefined {
    if (tool.version_pattern === undefined) return semver.coerce(text)?.version;
    const match = new RegExp(tool.version_pattern, 'u').exec(text);
    return match?.[1] ?? match?.[0];
}

function versionFailure(
    result: SpawnResult,
    tool: ToolDeclaration,
    text: string,
    version: string | undefined,
): ParsedToolVersion | undefined {
    if (result.isTimedOut === true) return { state: 'error', note: `${tool.name} version inspection timed out.` };
    if (result.missing) return { state: 'missing', note: text };
    // A shim with no selected version starts nothing, regardless of other mise installations.
    if (text.includes(NO_VERSION)) return { state: 'missing', note: 'not installed' };
    if (result.code !== (tool.version_exit_code ?? 0))
        return { state: 'error', note: `${tool.name} version inspection exited ${String(result.code)}: ${text}` };
    if (version === undefined && tool.kind === 'library')
        return { state: 'missing', note: `${tool.name} is not reported by its host version command.` };
    return undefined;
}

/**
 * Classify a reported version against its pin and floor.
 *
 * @param found the version the tool reported.
 * @param want the pinned version.
 * @param floor the lowest version the configuration accepts.
 *
 * @returns ok, outdated below the floor, newer above the pin, or error for no version.
 */
export function toolVersionState(
    found: string,
    want: string | undefined,
    floor: string | undefined,
): ToolInspection['state'] {
    if (want === undefined) return isBelowFloor(found, floor) ? 'outdated' : 'system';
    const version = semver.coerce(found);
    if (version === null) return 'error';
    if (isBelowFloor(found, floor)) return 'outdated';
    const pinned = semver.coerce(want);
    return pinned !== null && semver.gt(version, pinned) ? 'newer' : 'ok';
}

/**
 * Read version output, using installed npm metadata when the declared package supplies the executable.
 *
 * @param root the installation root.
 * @param cwd the project working folder.
 * @param path the resolved executable.
 * @param tool the declared version query and package.
 * @param timeoutSeconds the tool timeout in seconds.
 *
 * @returns the version or the query failure.
 */
export function readToolVersion(
    root: string,
    cwd: string,
    path: string,
    tool: ToolDeclaration,
    timeoutSeconds: number,
): ParsedToolVersion {
    const npm = tool.installers['npm'];
    const installedVersion = packageVersion(root, path, npm?.name);
    const result = runBlocking([path, ...(tool.version_command ?? [VERSION_FLAG])], {
        cwd,
        timeoutMs: toolTimeoutMilliseconds(timeoutSeconds),
        env: { ...TOOL_ENV, ...tool.env },
    });
    return parseVersionOutput(tool, result, installedVersion);
}

// The accepted floor applies equally to host tools and pinned tool-project tools.
/**
 * Compare a version with its accepted floor.
 *
 * @param found the observed version.
 * @param floor the accepted minimum.
 *
 * @returns whether the observed version falls below the floor.
 */
export function isBelowFloor(found: string | undefined, floor: string | undefined): boolean {
    const version = semver.coerce(found);
    const lowest = semver.coerce(floor);
    return version !== null && lowest !== null && semver.lt(version, lowest);
}

/**
 * Read a declared tool version from captured process output.
 *
 * @param tool the declared tool and its installation pin.
 * @param result the completed process result.
 * @param installedPackage the installed package path.
 *
 * @returns the parsed version or its inspection failure.
 */
export function parseVersionOutput(
    tool: ToolDeclaration,
    result: SpawnResult,
    installedPackage?: string,
): ParsedToolVersion {
    const npm = tool.installers['npm'];
    const text = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim();
    // An npm tool reports the version its package declares.
    const version = (npm?.version === tool.version ? installedPackage : undefined) ?? parsedVersion(text, tool);
    const failure = versionFailure(result, tool, text, version);
    if (failure !== undefined) return failure;
    if (version === undefined || semver.coerce(version) === null)
        return { state: 'error', note: `${tool.name} did not report a valid version: ${text}` };
    return { version };
}
