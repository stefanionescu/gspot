import { isDeepStrictEqual } from 'node:util';
import { toPosix } from '#cli/system/paths.ts';
import { join, posix, relative } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { contentDigest } from '#cli/system/text.ts';
import { readSource } from '#cli/system/files/reads.ts';
import { cacheDirectory } from '#cli/system/environment.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { statSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependency-files.ts';
import { MODE_BITS, PRIVATE_DIRECTORY } from '#cli/config/system/modes.ts';
import { openSafeFolder, walkSafeFolder } from '#cli/system/files/open.ts';
import type { FileCopy, SafeFolder } from '#cli/types/system/safe-folder.ts';
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
    XCODE_WORKSPACE_FLAG,
    BUILD_SOURCE_DIRECTORY,
    XCODE_WORKSPACE_SUFFIX,
    PACKAGE_SCRATCH_FOLDER,
    XCODE_DESTINATION_FLAG,
} from '#cli/config/checks/language/swift.ts';

// The sources to build, each as the copy it must have under source/ in the build folder.
function readBuildSources(root: string, paths: string[]): Map<string, FileCopy> {
    using source = openSafeFolder(root, 'system');
    const wantedFiles = new Map<string, FileCopy>();
    for (const file of paths) {
        const mode = statSync(source.realPath(file)).mode & MODE_BITS;
        wantedFiles.set(`${BUILD_SOURCE_DIRECTORY}/${file}`, { bytes: readSource(root, file), mode });
    }
    return wantedFiles;
}

// Removes unwanted files and then their containing folders, deepest first.
function pruneSources(folder: string, files: SafeFolder, wantedFiles: Map<string, FileCopy>): void {
    const wantedFolders = new Set(
        [...wantedFiles.keys()].flatMap((path) => {
            const parts = path.split('/');
            return parts.slice(0, -1).map((_part, index) => parts.slice(0, index + 1).join('/'));
        }),
    );
    const empty: string[] = [];
    walkSafeFolder(files, BUILD_SOURCE_DIRECTORY, (path) => {
        const entry = lstatSync(join(folder, path));
        if (entry.isDirectory()) {
            if (!wantedFolders.has(path)) empty.push(path);
            return true;
        }
        if (!entry.isSymbolicLink() && wantedFiles.has(path)) return false;
        const current = entry.isSymbolicLink() ? files.readKeepingLinks(path) : files.read(path);
        if (current !== undefined) files.remove(path, current);
        return false;
    });
    for (const directory of empty.toSorted((left, right) => right.length - left.length)) files.rmdir(directory);
}

/**
 * The private build cache for the repository's real path.
 * @param root the repository root.
 * @returns the cache folder for this repository.
 */
function buildFolder(root: string): string {
    const identity = contentDigest(realpathSync(root));
    return join(cacheDirectory(), identity);
}

/**
 * Prepare and claim one build folder without following existing output links.
 * @param folder the build folder.
 * @returns the locked root, which the caller disposes.
 */
function openBuildCache(folder: string): SafeFolder {
    const home = cacheDirectory();
    mkdirSync(home, { recursive: true, mode: PRIVATE_DIRECTORY });
    using parentFiles = openSafeFolder(home);
    parentFiles.mkdir(toPosix(relative(home, folder)), PRIVATE_DIRECTORY);
    using resources = new DisposableStack();
    const files = resources.use(openSafeFolder(folder, 'system'));
    files.claim(BUILD_LOCK);
    resources.move();
    return files;
}

/**
 * Locate a separate build folder for one project and tool.
 * @param input the repository root and project scope.
 * @param purpose the tool whose outputs stay separate.
 * @returns the build folder.
 */
export function scopeBuildFolder(input: Pick<CheckInput, 'root' | 'selection'>, purpose: SwiftBuildPurpose): string {
    return join(
        buildFolder(input.root),
        SWIFT_BUILD_FOLDER,
        input.selection.scope.path === ''
            ? ROOT_BUILD_FOLDER
            : `${SCOPE_FOLDER_PREFIX}${Buffer.from(input.selection.scope.path).toString('hex')}`,
        purpose,
    );
}

/**
 * The build of one scope: the command, the folder it runs in, and where its log goes.
 * @param input the check input.
 * @param purpose the tool whose command uses a separate cache.
 * @returns the plan.
 */
export function buildPlan(
    input: CheckInput,
    purpose: Exclude<SwiftBuildPurpose, 'periphery'> = 'compile',
): SwiftBuildPlan {
    const folder = scopeBuildFolder(input, purpose);
    const log = join(folder, BUILD_LOG);
    const { project, scheme, destination } = input.selection.view.options('xcode');
    if (project === undefined) {
        if (!input.repositoryFiles.some(({ path }) => path === posix.join(input.selection.scope.path, PACKAGE_SWIFT)))
            throw new GspotError('skip', 'Set xcode.project or add Package.swift in this scope.');
        const scratch = join(folder, PACKAGE_SCRATCH_FOLDER);
        return {
            folder,
            log,
            ...(purpose === 'analyze' ? { scratch } : {}),
            argv: [SWIFT_PROGRAM, ...PACKAGE_COMMANDS[purpose], SCRATCH_PATH_FLAG, scratch],
        };
    }
    if (scheme === undefined) throw new GspotError('settings', 'Set xcode.scheme for the configured Xcode project.');
    const container = project.endsWith(XCODE_WORKSPACE_SUFFIX) ? XCODE_WORKSPACE_FLAG : XCODE_PROJECT_FLAG;
    const argv = [
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
    return { folder, log, argv };
}

/**
 * Lock a build folder and copy the source files the tool needs.
 * @param input the repository and selected source files.
 * @param folder the tool's build folder.
 * @returns the source path and locked root. The caller disposes a successful result; failures release it.
 */
export function prepareBuild(input: Pick<CheckInput, 'root' | 'files'>, folder: string): PreparedSwiftBuild {
    using resources = new DisposableStack();
    const files = resources.use(openBuildCache(folder));
    const wantedFiles = readBuildSources(
        input.root,
        input.files.map((file) => file.path),
    );
    pruneSources(folder, files, wantedFiles);
    files.mkdir(BUILD_SOURCE_DIRECTORY, PRIVATE_DIRECTORY);
    for (const [path, next] of wantedFiles) {
        const current = files.read(path);
        if (!isDeepStrictEqual(current, next)) files.write(path, next, current);
    }
    const source = join(folder, BUILD_SOURCE_DIRECTORY);
    resources.move();
    return { files, source };
}
