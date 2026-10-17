import { isDeepStrictEqual } from 'node:util';
import { hashContent } from '#cli/system/text.ts';
import { join, posix, relative } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import type { CheckInput } from '#cli/types/checks/run/check.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import { statSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependency-files.ts';
import { MODE_BITS, PRIVATE_FOLDER } from '#cli/config/system/modes.ts';
import type { SwiftBuildPlan, SwiftBuildPurpose, PreparedSwiftBuild } from '#cli/types/checks/language.ts';

import {
    BUILD_LOG,
    BUILD_LOCK,
    SWIFT_PROGRAM,
    XCODE_COMMANDS,
    PACKAGE_COMMANDS,
    CODE_SIGNING_OFF,
    DERIVED_DATA_FLAG,
    ROOT_BUILD_FOLDER,
    SCRATCH_PATH_FLAG,
    XCODE_SCHEME_FLAG,
    SWIFT_BUILD_FOLDER,
    XCODEBUILD_PROGRAM,
    XCODE_PROJECT_FLAG,
    DERIVED_DATA_FOLDER,
    SCOPE_FOLDER_PREFIX,
    BUILD_SOURCE_FOLDER,
    XCODE_WORKSPACE_FLAG,
    XCODE_WORKSPACE_SUFFIX,
    PACKAGE_SCRATCH_FOLDER,
    XCODE_DESTINATION_FLAG,
} from '#cli/config/checks/language/swift.ts';

// Maps each source to the file contents it needs under source/ in the build folder.
function readBuildSources(root: string, paths: string[]): Map<string, FileContents> {
    using source = openFiles(root);
    const wantedFiles = new Map<string, FileContents>();
    for (const file of paths) {
        const mode = statSync(source.readRealPath(file)).mode & MODE_BITS;
        wantedFiles.set(`${BUILD_SOURCE_FOLDER}/${file}`, { bytes: readBytes(root, file), mode });
    }
    return wantedFiles;
}

function pruneSources(folder: string, files: Files, wantedFiles: Map<string, FileContents>): void {
    const wantedFolders = new Set(
        [...wantedFiles.keys()].flatMap((path) => {
            const parts = path.split('/');
            return parts.slice(0, -1).map((_part, index) => parts.slice(0, index + 1).join('/'));
        }),
    );
    const empty: string[] = [];
    walkFiles(files, BUILD_SOURCE_FOLDER, (path) => {
        const entry = lstatSync(join(folder, path));
        if (entry.isDirectory()) {
            if (!wantedFolders.has(path)) empty.push(path);
            return true;
        }
        if (!entry.isSymbolicLink() && wantedFiles.has(path)) return false;
        const current = entry.isSymbolicLink() ? files.readKeepingLinks(path) : files.read(path);
        if (current !== undefined) files.deleteFile(path, current);
        return false;
    });
    for (const emptyFolder of empty.toSorted((left, right) => right.length - left.length))
        files.deleteFolder(emptyFolder);
}

/**
 * Computes the private build cache folder from the real path of the repository.
 * @param repositoryRoot the top folder, whose real path names the cache.
 * @returns the cache folder for this repository.
 */
function computeBuildFolder(repositoryRoot: string): string {
    const identity = hashContent(realpathSync(repositoryRoot));
    return join(readCacheFolder(), identity);
}

/**
 * Creates and locks a build folder without following links in it.
 * @param folder the private cache path.
 * @returns the locked root, which the caller disposes.
 */
function openBuildCache(folder: string): Files {
    const home = readCacheFolder();
    mkdirSync(home, { recursive: true, mode: PRIVATE_FOLDER });
    using parentFiles = openFiles(home);
    parentFiles.createFolder(convertToPosixPath(relative(home, folder)), PRIVATE_FOLDER);
    using resources = new DisposableStack();
    const files = resources.use(openFiles(folder));
    files.createLock(BUILD_LOCK);
    resources.move();
    return files;
}

/**
 * Computes the build folder for a scope and tool.
 * @param input the repository root and scope.
 * @param purpose the tool whose outputs stay separate.
 * @returns the cache folder path.
 */
export function getScopeBuildFolder(input: Pick<CheckInput, 'root' | 'selection'>, purpose: SwiftBuildPurpose): string {
    return join(
        computeBuildFolder(input.root),
        SWIFT_BUILD_FOLDER,
        input.selection.scope.path === ''
            ? ROOT_BUILD_FOLDER
            : `${SCOPE_FOLDER_PREFIX}${Buffer.from(input.selection.scope.path).toString('hex')}`,
        purpose,
    );
}

/**
 * Plans the build of a scope: the command, its folder, and its log path.
 * @param input the scope and its Swift settings.
 * @param purpose the tool whose command uses a separate cache.
 * @param purpose.purpose the tool whose build needs its own cache.
 * @returns the command, build folder, and log path.
 */
export function buildPlan(
    input: CheckInput,
    { purpose = 'compile' }: { purpose?: Exclude<SwiftBuildPurpose, 'periphery'> } = {},
): SwiftBuildPlan {
    const folder = getScopeBuildFolder(input, purpose);
    const log = join(folder, BUILD_LOG);
    const {
        xcode_project: project,
        xcode_scheme: scheme,
        xcode_destination: destination,
    } = input.selection.view.options('swift');
    if (project === undefined) {
        if (!input.repositoryFiles.some(({ path }) => path === posix.join(input.selection.scope.path, PACKAGE_SWIFT)))
            throw new GspotError('skip', 'Set swift.xcode_project or add Package.swift in this scope.');
        const scratch = join(folder, PACKAGE_SCRATCH_FOLDER);
        return {
            folder,
            log,
            ...(purpose === 'analyze' ? { scratch } : {}),
            commandArguments: [SWIFT_PROGRAM, ...PACKAGE_COMMANDS[purpose], SCRATCH_PATH_FLAG, scratch],
        };
    }
    if (scheme === undefined)
        throw new GspotError('settings', 'Set swift.xcode_scheme for the configured Xcode project.');
    const container = project.endsWith(XCODE_WORKSPACE_SUFFIX) ? XCODE_WORKSPACE_FLAG : XCODE_PROJECT_FLAG;
    const commandArguments = [
        XCODEBUILD_PROGRAM,
        ...XCODE_COMMANDS[purpose],
        container,
        posix.relative(input.selection.scope.path, project),
        XCODE_SCHEME_FLAG,
        scheme,
        XCODE_DESTINATION_FLAG,
        destination,
        DERIVED_DATA_FLAG,
        join(folder, DERIVED_DATA_FOLDER),
        CODE_SIGNING_OFF,
    ];
    return { folder, log, commandArguments };
}

/**
 * Locks a build folder and copies in the source files the tool needs.
 * @param input the repository and scope files.
 * @param folder the cache path for the tool.
 * @returns the source path and locked root, which the caller disposes.
 */
export function prepareBuild(input: Pick<CheckInput, 'root' | 'files'>, folder: string): PreparedSwiftBuild {
    using resources = new DisposableStack();
    const files = resources.use(openBuildCache(folder));
    const wantedFiles = readBuildSources(
        input.root,
        input.files.map((file) => file.path),
    );
    pruneSources(folder, files, wantedFiles);
    files.createFolder(BUILD_SOURCE_FOLDER, PRIVATE_FOLDER);
    for (const [path, next] of wantedFiles) {
        const current = files.read(path);
        if (!isDeepStrictEqual(current, next)) files.write(path, next, current);
    }
    const source = join(folder, BUILD_SOURCE_FOLDER);
    resources.move();
    return { files, source };
}
