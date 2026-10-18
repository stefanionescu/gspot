// Read and compare installed tool versions.
import semver from 'semver';
import { realpathSync } from 'node:fs';
import { stripVTControlCharacters } from 'node:util';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { NPM_BIN_FOLDER } from '#cli/config/tools/find.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { join, dirname, basename, relative } from 'node:path';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { TOOL_ENV, NO_VERSION, VERSION_FLAG } from '#cli/config/tools/run.ts';
import type { ToolInspection, ParsedToolVersion } from '#cli/types/tools/find.ts';
import { readHostPackage, readToolProjectPackage } from '#cli/repository/packages.ts';

// Find the version that the first package.json above a folder declares for the named package, searching upward.
function findVersionAbove(files: Files | undefined, root: string, start: string, name: string): string | undefined {
    for (let folder = start; folder !== dirname(folder); folder = dirname(folder)) {
        const manifest = join(folder, PACKAGE_JSON);
        if (files !== undefined && !isInGspotFolder(convertToPosixPath(relative(root, manifest)))) return undefined;
        const parsed = files === undefined ? readHostPackage(manifest) : readToolProjectPackage(files, root, manifest);
        if (parsed?.name === name) return parsed.version;
    }
    return undefined;
}

/**
 * Read the version that a package.json above the real file of an npm tool holds, for the package that the pin names.
 *
 * @param repositoryRoot the boundary for validating managed package metadata reads.
 * @param path the executable.
 * @param name the npm package, or undefined for tools outside npm.
 *
 * @returns the declared version, or undefined when no package.json above the file names the package.
 */
function readPackageVersion(repositoryRoot: string, path: string, name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    using files = isInGspotFolder(convertToPosixPath(relative(repositoryRoot, path)))
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

function extractVersion(text: string, tool: ToolDeclaration): string | undefined {
    if (tool.version_pattern === undefined) return semver.coerce(text)?.version;
    const match = new RegExp(tool.version_pattern, 'u').exec(text);
    return match?.[1] ?? match?.[0];
}

function findVersionFailure(
    result: SpawnResult,
    tool: ToolDeclaration,
    text: string,
    version: string | undefined,
): ParsedToolVersion | undefined {
    if (result.isTimedOut === true) return { state: 'error', note: `${tool.name} version inspection timed out.` };
    if (result.missing) return { state: 'missing', note: text };
    // A shim without a set version starts nothing, whatever other mise installs exist.
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
function classifyToolVersion(
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
 * @param installationRoot the boundary for validating installed npm metadata before the version query.
 * @param cwd the project working folder.
 * @param path the resolved executable.
 * @param tool the declared version query and package.
 * @param timeoutSeconds the maximum time allowed for the version query.
 *
 * @returns the version or the query failure.
 */
function readToolVersion(
    installationRoot: string,
    cwd: string,
    path: string,
    tool: ToolDeclaration,
    timeoutSeconds: number,
): ParsedToolVersion {
    const npm = tool.installers['npm'];
    const installedVersion = readPackageVersion(installationRoot, path, npm?.name);
    const result = spawnProcessBlocking([path, ...(tool.version_command ?? [VERSION_FLAG])], {
        cwd,
        timeoutSeconds: timeoutSeconds,
        env: { ...TOOL_ENV, ...tool.env },
    });
    return parseVersionOutput(tool, result, installedVersion);
}

/**
 * Compare a version with its accepted floor.
 *
 * @param found the observed version.
 * @param floor the accepted minimum.
 *
 * @returns whether the observed version falls below the floor.
 */
function isBelowFloor(found: string | undefined, floor: string | undefined): boolean {
    const version = semver.coerce(found);
    const lowest = semver.coerce(floor);
    return version !== null && lowest !== null && semver.lt(version, lowest);
}

/**
 * Read a declared tool version from captured process output.
 *
 * @param tool the declaration and its pin.
 * @param result what the process printed, and its exit code.
 * @param installedVersion what the package.json of the install declares.
 *
 * @returns the parsed version or its inspection failure.
 */
function parseVersionOutput(tool: ToolDeclaration, result: SpawnResult, installedVersion?: string): ParsedToolVersion {
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

export { readToolVersion, classifyToolVersion };
