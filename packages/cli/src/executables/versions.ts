import semver from 'semver';
import { realpathSync } from 'node:fs';
import type { Tool } from '#cli/types/manifests.ts';
import { stripVTControlCharacters } from 'node:util';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { join, dirname, basename, relative } from 'node:path';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import type { SpawnResult } from '#cli/types/system/system.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { readHostPackage, readToolProjectPackage } from '#cli/executables/packages.ts';
import { NO_VERSION, VERSION_FLAG, NPM_BIN_FOLDER, TOOL_ENVIRONMENT } from '#cli/config/executables.ts';
import type { InspectedTool, ToolInspection, ParsedToolVersion } from '#cli/types/executables/inspection.ts';

function findVersionAbove(files: Files | undefined, root: string, start: string, name: string): string | undefined {
    for (let folder = start; folder !== dirname(folder); folder = dirname(folder)) {
        const packageJsonPath = join(folder, PACKAGE_JSON);
        if (files !== undefined && !convertToPosixPath(relative(root, packageJsonPath)).startsWith(`${GSPOT_FOLDER}/`))
            return undefined;
        const parsed =
            files === undefined
                ? readHostPackage(packageJsonPath)
                : readToolProjectPackage(files, root, packageJsonPath);
        if (parsed?.name === name) return parsed.version;
    }
    return undefined;
}

function readPackageVersion(root: string, path: string, name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    const files = convertToPosixPath(relative(root, path)).startsWith(`${GSPOT_FOLDER}/`) ? openFiles(root) : undefined;
    const folder = dirname(
        files === undefined ? realpathSync(path) : files.readCanonicalPath(convertToPosixPath(relative(root, path))),
    );
    const start = basename(folder) === basename(NPM_BIN_FOLDER) ? join(dirname(folder), name) : folder;
    return findVersionAbove(files, root, start, name);
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
    const failure = findRunFailure(result, tool, text);
    if (failure !== undefined) return failure;
    return version === undefined && tool.kind === 'library'
        ? { state: 'missing', note: `The version command of the host tool does not list ${tool.name}.` }
        : undefined;
}

function findRunFailure(result: SpawnResult, tool: Tool, text: string): ParsedToolVersion | undefined {
    if (result.timedOut) return { state: 'error', note: `Reading the version of ${tool.name} timed out.` };
    if (result.missing) return { state: 'missing', note: text === '' ? `${tool.name} is not installed.` : text };
    if (text.includes(NO_VERSION)) return { state: 'missing', note: 'not installed' };
    if (result.code === (tool.version_exit_code ?? 0)) return undefined;
    const exited = `The version command of ${tool.name} exited ${String(result.code)}`;
    return { state: 'error', note: text === '' ? `${exited}.` : `${exited}: ${text}` };
}

function isBelowMinimum(found: string | undefined, minimum: string | undefined): boolean {
    const version = semver.coerce(found);
    const lowest = semver.coerce(minimum);
    return version !== null && lowest !== null && semver.lt(version, lowest);
}

function parseVersionOutput(tool: Tool, result: SpawnResult, installedVersion: string | undefined): ParsedToolVersion {
    const npm = tool.installers['npm'];
    const text = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim();
    const version = (npm?.version === tool.version ? installedVersion : undefined) ?? extractVersion(text, tool);
    const failure = findVersionFailure(result, tool, text, version);
    if (failure !== undefined) return failure;
    return version === undefined || semver.coerce(version) === null
        ? { state: 'error', note: `${tool.name} did not report a valid version: ${text}` }
        : { version };
}

/**
Classify a reported version against its pin and minimum version.

@param found the version the tool reported.
@param want the pinned version.
@param minimum the lowest version the configuration accepts.
@returns ok, outdated below the minimum, newer above the pin, system without a pin, or error for no version.
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
    const pinVersion = semver.coerce(want);
    return pinVersion !== null && semver.gt(version, pinVersion) ? 'newer' : 'ok';
}

/**
Read version output, using the installed package.json when the declared package supplies the executable.

@param inspected the tool and where to run its version query.
@param path the resolved executable.
*/
export function readToolVersion(inspected: InspectedTool, path: string): ParsedToolVersion {
    const { root, cwd, tool, timeoutSeconds } = inspected;
    const npm = tool.installers['npm'];
    const installedVersion = readPackageVersion(root, path, npm?.name);
    const result = spawnProcessBlocking([path, ...(tool.version_command ?? [VERSION_FLAG])], {
        cwd: convertToPosixPath(relative(root, path)).startsWith(`${GSPOT_FOLDER}/`) ? join(root, GSPOT_FOLDER) : cwd,
        timeoutSeconds,
        env: TOOL_ENVIRONMENT,
    });
    return parseVersionOutput(tool, result, installedVersion);
}
