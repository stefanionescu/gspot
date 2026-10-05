// The build folder a Swift build reuses between runs: locked, confined, and holding only the sources wanted.
import { join, relative } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { toPosix } from '#cli/platform/paths.ts';
import { readSource } from '#cli/platform/source.ts';
import { contentDigest } from '#cli/platform/text.ts';
import type { Read, Root } from '#cli/types/platform/root.ts';
import { cacheDirectory } from '#cli/platform/environment.ts';
import { openRoot, walkRoot } from '#cli/platform/root/open.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import { statSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { MODE_BITS, PRIVATE_DIRECTORY } from '#cli/config/platform/modes.ts';
import type { PreparedSwiftBuild } from '#cli/types/checks/language/swift.ts';
import { BUILD_SOURCE_DIRECTORY } from '#cli/config/checks/language/swift.ts';

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

// The sources to build, each as the snapshot it must have under source/ in the build folder.
function desiredSources(root: string, paths: string[]): Map<string, Read> {
    using source = openRoot(root, 'native');
    const desired = new Map<string, Read>();
    for (const file of paths) {
        const mode = statSync(source.realPath(file)).mode & MODE_BITS;
        desired.set(`${BUILD_SOURCE_DIRECTORY}/${file}`, { bytes: readSource(root, file), mode });
    }
    return desired;
}

// Removes unwanted files and then their containing folders, deepest first.
function pruneSources(folder: string, files: Root, desired: Map<string, Read>): void {
    const wanted = new Set(
        [...desired.keys()].flatMap((path) => {
            const parts = path.split('/');
            return parts.slice(0, -1).map((_part, index) => parts.slice(0, index + 1).join('/'));
        }),
    );
    const empty: string[] = [];
    walkRoot(files, BUILD_SOURCE_DIRECTORY, (path) => {
        const entry = lstatSync(join(folder, path));
        if (entry.isDirectory()) {
            if (!wanted.has(path)) empty.push(path);
            return true;
        }
        if (!entry.isSymbolicLink() && desired.has(path)) return false;
        const current = entry.isSymbolicLink() ? files.readKeepingLinks(path) : files.read(path);
        if (current !== undefined) files.remove(path, current);
        return false;
    });
    for (const directory of empty.toSorted((left, right) => right.length - left.length)) files.rmdir(directory);
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
 * Prepare and lock one build folder without following existing output links.
 * @param folder the build folder
 * @returns the locked root, which the caller closes
 */
export function openBuildCache(folder: string): Root {
    const home = cacheDirectory();
    mkdirSync(home, { recursive: true, mode: PRIVATE_DIRECTORY });
    using boundary = openRoot(home);
    boundary.mkdir(toPosix(relative(home, folder)), PRIVATE_DIRECTORY);
    const files = openRoot(folder, 'native');
    try {
        files.lock('build.lock');
        assertBuildLinksInside(folder, files);
        return files;
    } catch (error) {
        files.close();
        throw error;
    }
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
    const desired = desiredSources(root, paths);
    pruneSources(folder, files, desired);
    files.mkdir(BUILD_SOURCE_DIRECTORY, PRIVATE_DIRECTORY);
    for (const [path, next] of desired) {
        const current = files.read(path);
        if (!isDeepStrictEqual(current, next)) files.write(path, next, current);
    }
    return join(folder, BUILD_SOURCE_DIRECTORY);
}

/**
 * Lock a native build folder and prepare the exact source files its consumer needs.
 * @param input the repository and selected source files
 * @param folder the native consumer's build folder
 * @returns the source path and locked root. The caller disposes a successful result; failures close it
 */
export function prepareBuild(input: Pick<EngineInput, 'root' | 'files'>, folder: string): PreparedSwiftBuild {
    const files = openBuildCache(folder);
    try {
        const source = prepareBuildSources(
            input.root,
            input.files.map((file) => file.path),
            folder,
            files,
        );
        return { files, source };
    } catch (error) {
        files.close();
        throw error;
    }
}
