// Read and compare installed tool versions.
import semver from 'semver';
import { realpathSync } from 'node:fs';
import { stripVTControlCharacters } from 'node:util';
import { openFiles } from '#cli/system/files/open.ts';
import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import type { Files } from '#cli/types/system/files.ts';
import type { Tool } from '#cli/types/configurations.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { join, dirname, basename, relative } from 'node:path';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { NPM_BIN_FOLDER } from '#cli/config/tools/inspection.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependencies.ts';
import { TOOL_ENV, NO_VERSION, VERSION_FLAG } from '#cli/config/tools/run.ts';
import { readHostPackage, readToolProjectPackage } from '#cli/repository/npm/installed-packages.ts';
import type { InspectedTool, ToolInspection, ParsedToolVersion } from '#cli/types/tools/inspection.ts';

// Find the version that the first package.json above a folder declares for the named package, searching upward.
function findVersionAbove(files: Files | undefined, root: string, start: string, name: string): string | undefined {
    for (let folder = start; folder !== dirname(folder); folder = dirname(folder)) {
        const packageJsonPath = join(folder, PACKAGE_JSON);
        if (files !== undefined && !convertToPosixPath(relative(root, packageJsonPath)).startsWith(`${DOT_GSPOT}/`))
            return undefined;
        const parsed =
            files === undefined
                ? readHostPackage(packageJsonPath)
                : readToolProjectPackage(files, root, packageJsonPath);
        if (parsed?.name === name) return parsed.version;
    }
    return undefined;
}

/**
 * Read the version that a package.json above the real file of an npm tool holds, for the package that the pin names.
 *
 * @param repositoryRoot the boundary for reading the package.json files of managed tools.
 * @param path the executable.
 * @param name the npm package, or undefined for tools outside npm.
 * @returns the declared version, or undefined when no package.json above the file names the package.
 */
function readPackageVersion(repositoryRoot: string, path: string, name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    using files = convertToPosixPath(relative(repositoryRoot, path)).startsWith(`${DOT_GSPOT}/`)
        ? openFiles(repositoryRoot)
        : undefined;
    const folder = dirname(
        files === undefined
            ? realpathSync(path)
            : files.readRealPath(convertToPosixPath(relative(repositoryRoot, path))),
    );
    // A Windows shim in node_modules/.bin has its own file, so look for its package by name
    // next to that folder.
    const start = basename(folder) === basename(NPM_BIN_FOLDER) ? join(dirname(folder), name) : folder;
    return findVersionAbove(files, repositoryRoot, start, name);
}

function extractVersion(text: string, tool: Tool): string | undefined {
    if (tool.version_pattern === undefined) return semver.coerce(text)?.version;
    const match = new RegExp(tool.version_pattern, 'u').exec(text);
    return match?.[1] ?? match?.[0];
}

function findVersionFailure(
    result: SpawnResult,
    tool: Tool,
    text: string,
    version: string | undefined,
): ParsedToolVersion | undefined {
    if (result.timedOut) return { state: 'error', note: `Reading the version of ${tool.name} timed out.` };
    if (result.missing) return { state: 'missing', note: text };
    // A shim without a set version starts nothing, whatever other mise installs exist.
    if (text.includes(NO_VERSION)) return { state: 'missing', note: 'not installed' };
    if (result.code !== (tool.version_exit_code ?? 0))
        return { state: 'error', note: `The version command of ${tool.name} exited ${String(result.code)}: ${text}` };
    if (version === undefined && tool.kind === 'library')
        return { state: 'missing', note: `The version command of the host tool does not list ${tool.name}.` };
    return undefined;
}

/**
 * Classify a reported version against its pin and minimum version.
 *
 * @param found the version the tool reported.
 * @param want the pinned version.
 * @param minimum the lowest version the configuration accepts.
 * @returns ok, outdated below the minimum, newer above the pin, system without a pin, or error for no version.
 */
export function classifyToolVersion(
    found: string,
    want: string | undefined,
    minimum: string | undefined,
): ToolInspection['state'] {
    if (want === undefined) return isBelowMinimum(found, minimum) ? 'outdated' : 'system';
    const version = semver.coerce(found);
    if (version === null) return 'error';
    if (isBelowMinimum(found, minimum)) return 'outdated';
    const pinned = semver.coerce(want);
    return pinned !== null && semver.gt(version, pinned) ? 'newer' : 'ok';
}

/**
 * Read version output, using the installed package.json when the declared package supplies the executable.
 *
 * @param inspected the tool, installed metadata boundary, working folder, and query timeout.
 * @param path the resolved executable.
 * @returns the version or the query failure.
 */
export function readToolVersion(inspected: InspectedTool, path: string): ParsedToolVersion {
    const { root, cwd, tool, timeoutSeconds } = inspected;
    const npm = tool.installers['npm'];
    const installedVersion = readPackageVersion(root, path, npm?.name);
    // A program of the gspot tool project reports its version from the gspot folder. A config file of that tool in
    // the repository then cannot break the query.
    const isToolProjectProgram = convertToPosixPath(relative(root, path)).startsWith(`${DOT_GSPOT}/`);
    const result = spawnProcessBlocking([path, ...(tool.version_command ?? [VERSION_FLAG])], {
        cwd: isToolProjectProgram ? join(root, DOT_GSPOT) : cwd,
        timeoutSeconds,
        env: TOOL_ENV,
    });
    return parseVersionOutput(tool, result, installedVersion);
}

/**
 * Compare a version with its minimum.
 *
 * @param found the observed version.
 * @param minimum the accepted minimum.
 * @returns whether the observed version falls below the minimum.
 */
function isBelowMinimum(found: string | undefined, minimum: string | undefined): boolean {
    const version = semver.coerce(found);
    const lowest = semver.coerce(minimum);
    return version !== null && lowest !== null && semver.lt(version, lowest);
}

/**
 * Read a declared tool version from captured process output.
 *
 * @param tool the tool and its pin.
 * @param result what the process printed, and its exit code.
 * @param installedVersion what the package.json of the install declares.
 * @returns the parsed version or its inspection failure.
 */
function parseVersionOutput(tool: Tool, result: SpawnResult, installedVersion: string | undefined): ParsedToolVersion {
    const npm = tool.installers['npm'];
    const text = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim();
    // An npm tool reports the version its package declares.
    const version = (npm?.version === tool.version ? installedVersion : undefined) ?? extractVersion(text, tool);
    const failure = findVersionFailure(result, tool, text, version);
    if (failure !== undefined) return failure;
    if (version === undefined || semver.coerce(version) === null)
        return { state: 'error', note: `${tool.name} did not report a valid version: ${text}` };
    return { version };
}
