import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';

import {
    BUILD_LOCK,
    BUILD_LOCK_WAIT_MILLISECONDS,
    BUILD_LOG,
    BUILD_SOURCE_FOLDER,
    CODE_SIGNING_OFF,
    DERIVED_DATA_FLAG,
    DERIVED_DATA_FOLDER,
    NO_SWIFT_PROJECT_NOTE,
    PACKAGE_INDEX_STORE,
    PACKAGE_SCRATCH_FOLDER,
    ROOT_BUILD_FOLDER,
    SCOPE_FOLDER_PREFIX,
    SCRATCH_PATH_FLAG,
    SWIFT_BUILD_COMMANDS,
    SWIFT_BUILD_FOLDER,
    SWIFT_PROGRAM,
    SWIFT_TEST_COMMAND,
    XCODE_DESTINATION_FLAG,
    XCODE_INDEX_STORE,
    XCODE_PROJECT_FLAG,
    XCODE_SCHEME_FLAG,
    XCODE_SCHEME_MESSAGE,
    XCODE_TEST_ACTION,
    XCODE_WARNINGS_AS_ERRORS,
    XCODE_WORKSPACE_FLAG,
    XCODE_WORKSPACE_SUFFIX,
    XCODEBUILD_PROGRAM,
} from '#cli/config/configurations/builds.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers.ts';
import { MODE_BITS, PRIVATE_FILE, PRIVATE_FOLDER } from '#cli/config/system.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { CheckStop, GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { isProcessRunning } from '#cli/system/processes.ts';
import type { SwiftBuildPlan, SwiftBuildSetup } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { FileContents, Files } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

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
    openFiles(home).createPrivateFolder(convertToPosixPath(relative(home, folder)));
    return openFiles(folder);
}

function createBuildLock(path: string): Disposable | undefined {
    try {
        writeFileSync(path, String(process.pid), { flag: 'wx', mode: PRIVATE_FILE });
        return {
            [Symbol.dispose]: () => {
                rmSync(path, { force: true });
            },
        };
    } catch (error) {
        if (!hasErrorCode(error, 'EEXIST')) throw error;
        return undefined;
    }
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
Hold the lock of a build folder, so a commit and a push never rewrite the sources of each other. Remove a lock whose
process stopped.

@param folder the folder of the scope's build.
@param cancelSignal stops the wait.
@returns the lock, which disposal removes.
*/
export async function acquireBuildLock(folder: string, cancelSignal: AbortSignal | undefined): Promise<Disposable> {
    const files = openBuildCache(folder);
    const path = join(folder, BUILD_LOCK);
    let lock = createBuildLock(path);
    while (lock === undefined) {
        const owner = files.read(BUILD_LOCK);
        if (owner !== undefined && isProcessRunning(Number(owner.bytes.toString('utf8'))))
            await delay(BUILD_LOCK_WAIT_MILLISECONDS, undefined, { signal: cancelSignal });
        else rmSync(path, { force: true });
        lock = createBuildLock(path);
    }
    return lock;
}

/**
Plans the build of a scope: the command, its folder, and its log path.

@param session the repository and its tools.
@param planned the scope and its Swift settings.
*/
export function planSwiftBuild(session: Session, planned: PlannedCheck): SwiftBuildPlan {
    const folder = join(
        readRepositoryCacheFolder(session.toolsRoot),
        SWIFT_BUILD_FOLDER,
        planned.scope.path === ''
            ? ROOT_BUILD_FOLDER
            : `${SCOPE_FOLDER_PREFIX}${Buffer.from(planned.scope.path).toString('hex')}`,
    );
    const log = join(folder, BUILD_LOG);
    const {
        xcode_project: project,
        xcode_scheme: scheme,
        xcode_destination: destination,
    } = getTable(planned.scope.settings, 'swift');
    if (project === undefined) {
        if (session.repository.files.every(({ path }) => path !== joinScope(planned.scope.path, PACKAGE_SWIFT)))
            throw new CheckStop('skipped', NO_SWIFT_PROJECT_NOTE);
        const scratch = join(folder, PACKAGE_SCRATCH_FOLDER);
        return {
            folder,
            log,
            kind: 'package',
            scratch,
            store: join(scratch, PACKAGE_INDEX_STORE),
            commandArguments: [SWIFT_PROGRAM, ...SWIFT_BUILD_COMMANDS.package, SCRATCH_PATH_FLAG, scratch],
            testArguments: [SWIFT_PROGRAM, ...SWIFT_TEST_COMMAND, SCRATCH_PATH_FLAG, scratch],
        };
    }
    if (scheme === undefined) throw new GspotError('settings', XCODE_SCHEME_MESSAGE);
    const container = project.endsWith(XCODE_WORKSPACE_SUFFIX) ? XCODE_WORKSPACE_FLAG : XCODE_PROJECT_FLAG;
    const products = join(folder, DERIVED_DATA_FOLDER);
    const target = [
        container,
        posix.relative(planned.scope.path, project),
        XCODE_SCHEME_FLAG,
        scheme,
        XCODE_DESTINATION_FLAG,
        destination,
        DERIVED_DATA_FLAG,
        products,
        CODE_SIGNING_OFF,
    ];
    return {
        kind: 'xcode',
        folder,
        log,
        store: join(products, XCODE_INDEX_STORE),
        commandArguments: [XCODEBUILD_PROGRAM, ...SWIFT_BUILD_COMMANDS.xcode, ...target, XCODE_WARNINGS_AS_ERRORS],
        testArguments: [XCODEBUILD_PROGRAM, XCODE_TEST_ACTION, ...target],
    };
}

/**
Copies the source files the tool needs into a build folder.

@param root the repository folder.
@param files the scope files.
@param folder the cache path for the tool.
*/
export function prepareBuild(root: string, files: TrackedFile[], folder: string): SwiftBuildSetup {
    const cache = openBuildCache(folder);
    const wantedFiles = readBuildSources(
        root,
        files.map((file) => file.path),
    );
    deleteStaleSources(folder, cache, wantedFiles);
    cache.createPrivateFolder(BUILD_SOURCE_FOLDER);
    for (const [path, next] of wantedFiles) {
        const cached = cache.read(path);
        if (!isDeepStrictEqual(cached, next)) cache.write(path, next);
    }
    return { files: cache, source: join(folder, BUILD_SOURCE_FOLDER) };
}
