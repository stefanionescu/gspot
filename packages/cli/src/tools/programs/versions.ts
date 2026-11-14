import semver from 'semver';
import { realpathSync } from 'node:fs';
import type { Tool } from '#cli/types/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { stripVTControlCharacters } from 'node:util';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { runProcess } from '#cli/system/processes/run.ts';
import { join, dirname, basename, relative } from 'node:path';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import type { Files, SpawnResult } from '#cli/types/system.ts';
import { isGspotPath } from '#cli/repository/files/ownership.ts';
import { readToolProjectPackage } from '#cli/tools/programs/packages.ts';
import type { InspectedTool, ToolInspection, ParsedToolVersion } from '#cli/types/tools.ts';
import { readPackageJson, normalizePythonName } from '#cli/parsers/projects/dependencies.ts';

import {
    NO_VERSION,
    VERSION_FLAG,
    NPM_BIN_FOLDER,
    STACK_FRAME_LINE,
    TOOL_ENVIRONMENT,
    DISTRIBUTION_SUFFIX,
    PYTHON_LIBRARY_FOLDERS,
    PYTHON_PACKAGES_FOLDER,
} from '#cli/config/tools/programs.ts';

function findVersionAbove(files: Files | undefined, root: string, start: string, name: string): string | undefined {
    for (let folder = start; folder !== dirname(folder); folder = dirname(folder)) {
        const packageJsonPath = join(folder, PACKAGE_JSON);
        if (files !== undefined && !isGspotPath(convertToPosixPath(relative(root, packageJsonPath)))) return undefined;
        const parsed =
            files === undefined
                ? readPackageJson(folder, PACKAGE_JSON)
                : readToolProjectPackage(files, root, packageJsonPath);
        if (parsed?.name === name) return parsed.version;
    }
    return undefined;
}

function readPackageVersion(root: string, path: string, name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    const relativePath = convertToPosixPath(relative(root, path));
    const files = isGspotPath(relativePath) ? openFiles(root) : undefined;
    const folder = dirname(files === undefined ? realpathSync(path) : files.readCanonicalPath(relativePath));
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
    return version === undefined && tool.kind === 'package'
        ? { state: 'missing', note: `The version command of the host tool does not list ${tool.name}.` }
        : undefined;
}

function findRunFailure(result: SpawnResult, tool: Tool, text: string): ParsedToolVersion | undefined {
    if (result.end === 'timed-out') return { state: 'error', note: `Reading the version of ${tool.name} timed out.` };
    if (result.end === 'missing')
        return { state: 'missing', note: text === '' ? `${tool.name} is not installed.` : text };
    if (text.includes(NO_VERSION)) return { state: 'missing', note: 'not installed' };
    if (result.code === 0) return undefined;
    const exited = `The version command of ${tool.name} exited ${String(result.code)}`;
    const detail = text
        .split('\n')
        .filter((line) => !STACK_FRAME_LINE.test(line))
        .join('\n');
    return { state: 'error', note: text === '' ? `${exited}.` : `${exited}: ${detail}` };
}

function isBelowMinimum(found: string | undefined, minimum: string | undefined): boolean {
    const version = semver.coerce(found);
    const lowest = semver.coerce(minimum);
    return version !== null && lowest !== null && semver.lt(version, lowest);
}

function parseVersionOutput(tool: Tool, result: SpawnResult, metadataVersion: string | undefined): ParsedToolVersion {
    const text = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim();
    const version = metadataVersion ?? extractVersion(text, tool);
    const failure = findVersionFailure(result, tool, text, version);
    if (failure !== undefined) return failure;
    return version === undefined || semver.coerce(version) === null
        ? { state: 'error', note: `${tool.name} did not report a valid version: ${text}` }
        : { version };
}

function readDistributionVersion(root: string, tool: Tool): string | undefined {
    const name = tool.installers.pypi?.name;
    if (name === undefined) return undefined;
    const files = openFiles(root);
    const prefix = `${normalizePythonName(name)}-`;
    const folders = PYTHON_LIBRARY_FOLDERS.flatMap((library) => {
        const path = `${GSPOT_PATHS.pythonEnvironment}/${library}`;
        return [path, ...files.list(path).map((name) => `${path}/${name}`)];
    }).map((path) => `${path}/${PYTHON_PACKAGES_FOLDER}`);
    for (const folder of folders) {
        const found = files.list(folder).find((folderName) => {
            return folderName.endsWith(DISTRIBUTION_SUFFIX) && normalizePythonName(folderName).startsWith(prefix);
        });
        if (found !== undefined) return found.slice(prefix.length, -DISTRIBUTION_SUFFIX.length);
    }
    return undefined;
}

function readMetadataVersion(inspected: InspectedTool, path: string): string | undefined {
    const { root, tool, miseBinPaths } = inspected;
    const npm = tool.installers['npm'];
    const installed = readPackageVersion(root, path, npm?.name);
    if (installed !== undefined && npm?.version === tool.version) return installed;
    if (tool.system === true) return undefined;
    return miseBinPaths?.includes(dirname(path)) === true ? tool.version : readDistributionVersion(root, tool);
}

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
Read the version of a tool. A package.json or a Python dist-info folder gives it for a tool that gspot installs. The
pin gives it for a program in a mise folder of that pin. Every other tool runs its version command.

With runsVersionCommand, every program runs it. A package keeps its package version, because some npm tools print
another one. A program in a mise folder reports what it prints, because the pin does not prove what the folder holds.
*/
export async function readToolVersion(inspected: InspectedTool, path: string): Promise<ParsedToolVersion> {
    const { root, cwd, tool, timeoutSeconds, miseBinPaths, runsVersionCommand } = inspected;
    const metadataVersion = readMetadataVersion(inspected, path);
    if (metadataVersion !== undefined && runsVersionCommand !== true) return { version: metadataVersion };
    const isToolProgram = isGspotPath(convertToPosixPath(relative(root, path)));
    const result = await runProcess([path, ...(tool.version_command ?? [VERSION_FLAG])], {
        cwd: isToolProgram ? join(root, GSPOT_FOLDER) : cwd,
        timeoutSeconds,
        env: TOOL_ENVIRONMENT,
    });
    return parseVersionOutput(
        tool,
        result,
        miseBinPaths?.includes(dirname(path)) === true ? undefined : metadataVersion,
    );
}
