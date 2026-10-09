import { isDeepStrictEqual } from 'node:util';
import { join, posix, relative } from 'node:path';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { Root, FileCopy } from '#cli/types/platform/root.ts';
import { toPosix, contentDigest } from '#cli/platform/contracts.ts';
import { GspotError, cacheDirectory } from '#cli/platform/public.ts';
import { statSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { MODE_BITS, PRIVATE_DIRECTORY } from '#cli/config/platform/modes.ts';
import { openRoot, walkRoot, readSource } from '#cli/platform/root/public.ts';
import type { SwiftBuildPlan, SwiftBuildPurpose, PreparedSwiftBuild } from '#cli/types/checks/language/swift.ts';

import {
    XCODE_COMMANDS,
    PACKAGE_COMMANDS,
    WORKSPACE_SUFFIX,
    BUILD_SOURCE_DIRECTORY,
} from '#cli/config/checks/language/swift.ts';

// Confine generated links to the build folder; source preparation removes obsolete links without following them.
function assertBuildLinksInside(folder: string, files: Root): void {
    walkRoot(files, '', (path) => {
        const entry = lstatSync(join(folder, path));
        if (entry.isSymbolicLink()) {
            try {
                files.assertInside(path);
            } catch (error) {
                throw new Error(`Build folder contains an unsafe symbolic link: ${path}`, { cause: error });
            }
        }
        return entry.isDirectory();
    });
}

// The sources to build, each as the copy it must have under source/ in the build folder.
function readBuildSources(root: string, paths: string[]): Map<string, FileCopy> {
    using source = openRoot(root, 'native');
    const wantedFiles = new Map<string, FileCopy>();
    for (const file of paths) {
        const mode = statSync(source.realPath(file)).mode & MODE_BITS;
        wantedFiles.set(`${BUILD_SOURCE_DIRECTORY}/${file}`, { bytes: readSource(root, file), mode });
    }
    return wantedFiles;
}

// Removes unwanted files and then their containing folders, deepest first.
function pruneSources(folder: string, files: Root, wantedFiles: Map<string, FileCopy>): void {
    const wantedFolders = new Set(
        [...wantedFiles.keys()].flatMap((path) => {
            const parts = path.split('/');
            return parts.slice(0, -1).map((_part, index) => parts.slice(0, index + 1).join('/'));
        }),
    );
    const empty: string[] = [];
    walkRoot(files, BUILD_SOURCE_DIRECTORY, (path) => {
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
 * Locate independent native build state for one project scope and consumer.
 * @param input the repository root and project scope
 * @param purpose the native consumer whose outputs stay separate
 * @returns the build folder
 */
export function scopeBuildFolder(input: Pick<CheckInput, 'root' | 'scope'>, purpose: SwiftBuildPurpose): string {
    return join(
        buildFolder(input.root),
        'swift',
        input.scope === '' ? 'root' : `scope-${Buffer.from(input.scope).toString('hex')}`,
        purpose,
    );
}

/**
 * The build of one scope: the command, the folder it runs in, and where its log goes.
 * @param input the check input
 * @param purpose the build consumer, whose command owns a separate cache
 * @returns the plan
 */
export function buildPlan(input: CheckInput, purpose: SwiftBuildPurpose = 'compile'): SwiftBuildPlan {
    const folder = scopeBuildFolder(input, purpose);
    const log = join(folder, 'build.log');
    const {
        xcode_project: project,
        xcode_scheme: scheme,
        xcode_destination: destination,
    } = input.view.options('swift');
    if (project === '') {
        if (
            !(input.repositoryFiles ?? input.files).some(
                ({ path }) => path === posix.join(input.scope, 'Package.swift'),
            )
        )
            throw new GspotError('skip', ['Set swift.xcode_project or add Package.swift in this scope.']);
        const scratch = join(folder, 'package');
        return {
            folder,
            log,
            ...(purpose === 'analyze' ? { scratch } : {}),
            argv: ['swift', ...PACKAGE_COMMANDS[purpose], '--scratch-path', scratch],
        };
    }
    const container = project.endsWith(WORKSPACE_SUFFIX) ? '-workspace' : '-project';
    const argv = [
        'xcodebuild',
        ...XCODE_COMMANDS[purpose],
        container,
        posix.relative(input.scope, project),
        '-scheme',
        scheme,
        '-destination',
        destination,
        '-derivedDataPath',
        join(folder, 'derived'),
        'CODE_SIGNING_ALLOWED=NO',
    ];
    return { folder, log, argv };
}

/**
 * The private build cache for the canonical repository path.
 * @param root the repository root
 * @returns the cache folder for this repository
 */
export function buildFolder(root: string): string {
    const identity = contentDigest(realpathSync(root));
    return join(cacheDirectory(), identity);
}

/**
 * Prepare and claim one build folder without following existing output links.
 * @param folder the build folder
 * @returns the locked root, which the caller disposes
 */
export function openBuildCache(folder: string): Root {
    const home = cacheDirectory();
    mkdirSync(home, { recursive: true, mode: PRIVATE_DIRECTORY });
    using boundary = openRoot(home);
    boundary.mkdir(toPosix(relative(home, folder)), PRIVATE_DIRECTORY);
    using resources = new DisposableStack();
    const files = resources.use(openRoot(folder, 'native'));
    files.claim('build.lock');
    assertBuildLinksInside(folder, files);
    resources.move();
    return files;
}

/**
 * Restore selected sources in a stable build folder while retaining unchanged timestamps.
 * @param root the repository root
 * @param paths the source files to build
 * @param folder the build folder
 * @param files the locked build folder
 * @returns the source directory inside the build folder
 */
export function prepareBuildSources(root: string, paths: string[], folder: string, files: Root): string {
    const wantedFiles = readBuildSources(root, paths);
    pruneSources(folder, files, wantedFiles);
    files.mkdir(BUILD_SOURCE_DIRECTORY, PRIVATE_DIRECTORY);
    for (const [path, next] of wantedFiles) {
        const current = files.read(path);
        if (!isDeepStrictEqual(current, next)) files.write(path, next, current);
    }
    return join(folder, BUILD_SOURCE_DIRECTORY);
}

/**
 * Claim a native build folder and prepare the exact source files its consumer needs.
 * @param input the repository and selected source files
 * @param folder the native consumer's build folder
 * @returns the source path and locked root. The caller disposes a successful result; failures release it
 */
export function prepareBuild(input: Pick<CheckInput, 'root' | 'files'>, folder: string): PreparedSwiftBuild {
    using resources = new DisposableStack();
    const files = resources.use(openBuildCache(folder));
    const source = prepareBuildSources(
        input.root,
        input.files.map((file) => file.path),
        folder,
        files,
    );
    resources.move();
    return { files, source };
}
