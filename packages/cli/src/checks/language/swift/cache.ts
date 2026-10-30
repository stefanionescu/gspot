import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { join, posix, relative } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/projects.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import { MODE_BITS, PRIVATE_FOLDER } from '#cli/config/files/modes.ts';
import { statSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import type { SwiftBuildPlan, SwiftBuildSetup, SwiftBuildPurpose } from '#cli/types/checks/language/swift.ts';

import {
    BUILD_LOG,
    SWIFT_PROGRAM,
    CODE_SIGNING_OFF,
    SCRATCH_PATH_FLAG,
    DERIVED_DATA_FLAG,
    XCODE_SCHEME_FLAG,
    ROOT_BUILD_FOLDER,
    XCODEBUILD_PROGRAM,
    XCODE_PROJECT_FLAG,
    SWIFT_BUILD_FOLDER,
    BUILD_SOURCE_FOLDER,
    DERIVED_DATA_FOLDER,
    SCOPE_FOLDER_PREFIX,
    XCODE_SCHEME_MESSAGE,
    SWIFT_BUILD_COMMANDS,
    XCODE_WORKSPACE_FLAG,
    NO_SWIFT_PROJECT_NOTE,
    XCODE_DESTINATION_FLAG,
    XCODE_WORKSPACE_SUFFIX,
    PACKAGE_SCRATCH_FOLDER,
} from '#cli/config/checks/language/swift.ts';

function readBuildSources(root: string, paths: string[]): Map<string, FileContents> {
    const source = openFiles(root);
    const wantedFiles = new Map<string, FileContents>();
    for (const file of paths) {
        let mode: number;
        try {
            mode = statSync(source.readCanonicalPath(file)).mode & MODE_BITS;
        } catch (error) {
            if (!hasErrorCode(error, 'ENOENT')) throw error;
            throw new GspotError('filesystem', `${file} is tracked but missing. Restore it or commit its deletion.`, {
                cause: error,
            });
        }
        wantedFiles.set(`${BUILD_SOURCE_FOLDER}/${file}`, { bytes: readBytes(root, file), mode });
    }
    return wantedFiles;
}

function deleteStaleSources(folder: string, files: Files, wantedFiles: Map<string, FileContents>): void {
    const wantedFolders = new Set(
        wantedFiles.keys().flatMap((path) => {
            const segments = path.split('/');
            return segments.slice(0, -1).map((_segment, index) => segments.slice(0, index + 1).join('/'));
        }),
    );
    const empty: string[] = [];
    walkFiles(files, BUILD_SOURCE_FOLDER, (path) => {
        const stats = lstatSync(join(folder, path));
        if (stats.isDirectory()) {
            if (!wantedFolders.has(path)) empty.push(path);
            return true;
        }
        if (!stats.isSymbolicLink() && wantedFiles.has(path)) return false;
        files.deleteFile(path);
        return false;
    });
    const deepestFirst = empty.toSorted((left, right) => right.length - left.length);
    for (const emptyFolder of deepestFirst) files.deleteFolder(emptyFolder);
}

function openBuildCache(folder: string): Files {
    const home = readCacheFolder();
    mkdirSync(home, { recursive: true, mode: PRIVATE_FOLDER });
    openFiles(home).createFolder(convertToPosixPath(relative(home, folder)), PRIVATE_FOLDER);
    return openFiles(folder);
}

/**
Return the cache folder of one repository, which all of its build tools share.

@param root the folder whose canonical path identifies the shared build cache.
*/
export function readRepositoryCacheFolder(root: string): string {
    const canonicalRoot = realpathSync(root);
    const digest = createHash('sha256').update(canonicalRoot).digest('hex');
    return join(readCacheFolder(), digest);
}

/**
Plans the build of a scope: the command, its folder, and its log path.

@param session the repository and its tools.
@param planned the scope and its Swift settings.
@param purpose the tool whose build needs its own cache.
*/
export function planSwiftBuild(
    session: Session,
    planned: PlannedCheck,
    purpose: Exclude<SwiftBuildPurpose, 'periphery'> = 'compile',
): SwiftBuildPlan {
    const folder = join(
        readRepositoryCacheFolder(session.toolsRoot),
        SWIFT_BUILD_FOLDER,
        planned.scope.path === ''
            ? ROOT_BUILD_FOLDER
            : `${SCOPE_FOLDER_PREFIX}${Buffer.from(planned.scope.path).toString('hex')}`,
        purpose,
    );
    const log = join(folder, BUILD_LOG);
    const {
        xcode_project: project,
        xcode_scheme: scheme,
        xcode_destination: destination,
    } = getTable(planned.scope.settings, 'swift');
    if (project === undefined) {
        if (!session.repository.files.some(({ path }) => path === joinScope(planned.scope.path, PACKAGE_SWIFT)))
            throw new GspotError('skip', NO_SWIFT_PROJECT_NOTE);
        const scratch = join(folder, PACKAGE_SCRATCH_FOLDER);
        return {
            folder,
            log,
            kind: 'package',
            purpose,
            scratch,
            commandArguments: [SWIFT_PROGRAM, ...SWIFT_BUILD_COMMANDS[purpose].package, SCRATCH_PATH_FLAG, scratch],
        };
    }
    if (scheme === undefined) throw new GspotError('settings', XCODE_SCHEME_MESSAGE);
    const container = project.endsWith(XCODE_WORKSPACE_SUFFIX) ? XCODE_WORKSPACE_FLAG : XCODE_PROJECT_FLAG;
    const commandArguments = [
        XCODEBUILD_PROGRAM,
        ...SWIFT_BUILD_COMMANDS[purpose].xcode,
        container,
        posix.relative(planned.scope.path, project),
        XCODE_SCHEME_FLAG,
        scheme,
        XCODE_DESTINATION_FLAG,
        destination,
        DERIVED_DATA_FLAG,
        join(folder, DERIVED_DATA_FOLDER),
        CODE_SIGNING_OFF,
    ];
    return { kind: 'xcode', purpose, folder, log, commandArguments };
}

/**
Copies the source files the tool needs into a build folder.

@param root the repository folder.
@param files the scope files.
@param folder the cache path for the tool.
@returns the source path and the handle of the build folder.
*/
export function prepareBuild(root: string, files: TrackedFile[], folder: string): SwiftBuildSetup {
    const cache = openBuildCache(folder);
    const wantedFiles = readBuildSources(
        root,
        files.map((file) => file.path),
    );
    deleteStaleSources(folder, cache, wantedFiles);
    cache.createFolder(BUILD_SOURCE_FOLDER, PRIVATE_FOLDER);
    for (const [path, next] of wantedFiles) {
        const cached = cache.read(path);
        if (!isDeepStrictEqual(cached, next)) cache.write(path, next);
    }
    return { files: cache, source: join(folder, BUILD_SOURCE_FOLDER) };
}
