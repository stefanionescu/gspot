// Where an executable and its installed package version are found: repository bin folders, PATH, and mise shims.

import which from 'which';
import { runBlocking } from '#cli/platform/spawn.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { miseHome } from '#cli/platform/environment.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { statSync, readFileSync, realpathSync } from 'node:fs';
import { parsePackageManifest } from '#cli/parsers/packages.ts';
import type { LocateOptions } from '#cli/types/tools/install.ts';
import { VERSION_TIMEOUT_MS } from '#cli/config/tools/install.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';
import { join, dirname, basename, relative, isAbsolute } from 'node:path';
import { toPosix, environmentBin, executableNames } from '#cli/platform/paths.ts';
import { DOT_GSPOT, NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/platform/locations.ts';

// The folders a tool of the private kind, or a host tool, is located in. A snapshot has no private tools or virtual
// environments of its own: they run from the working tree the snapshot stands for.
function searchDirectories(root: string, options: LocateOptions): string[] {
    const { searchFolders, privateKind, installedRoot = root } = options;
    if (privateKind === 'npm') return [join(installedRoot, NODE_MODULES_DIRECTORY, '.bin')];
    if (privateKind === 'python') return [environmentBin(join(installedRoot, PYTHON_ENVIRONMENT_DIRECTORY))];
    // A snapshot's private tools run from the original working tree.
    return [...new Set(searchFolders)].flatMap((folder) => [
        join(
            basename(folder) === DOT_GSPOT ? join(installedRoot, relative(root, folder)) : folder,
            'node_modules',
            '.bin',
        ),
        environmentBin(join(installedRoot, relative(root, folder), '.venv')),
    ]);
}

// Whether a candidate exists: a managed path must resolve through the root boundary, any other is read from disk.
function candidateExists(files: Root, root: string, path: string): boolean {
    const local = toPosix(relative(root, path));
    if (!local.startsWith(`${DOT_GSPOT}/`)) return statSync(path, { throwIfNoEntry: false }) !== undefined;
    try {
        files.assertInside(local);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return false;
    }
}

// The executables of the name that exist in the repository's search folders.
function repositoryCandidates(root: string, directories: string[], names: string[]): string[] {
    using files = openRoot(root);
    const paths = directories.flatMap((directory) => names.map((file) => join(directory, file)));
    return paths.filter((path) => candidateExists(files, root, path));
}

// Resolve mise shims in the repository before tools run inside isolated source copies.
function hostCandidates(root: string, name: string, names: string[]): string[] {
    const onPath = which.sync(name, { nothrow: true });
    const launcherDirectory = join(miseHome(), 'shims');
    const found = names
        .map((file) => join(launcherDirectory, file))
        .filter((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    const candidates = [...new Set(onPath === null ? found : [onPath, ...found])];
    const mise = which.sync('mise', { nothrow: true });
    return candidates.flatMap((path) => {
        if (!path.startsWith(`${launcherDirectory}/`) && !path.startsWith(`${launcherDirectory}\\`)) return [path];
        if (mise === null) return [];
        const resolved = runBlocking([mise, 'which', name], { cwd: root, timeoutMs: VERSION_TIMEOUT_MS });
        return resolved.code === 0 ? [resolved.stdout.trim()] : [];
    });
}

// The version the first package.json above a folder declares for the named package, searching upward.
function versionAbove(files: Root | undefined, root: string, start: string, name: string): string | undefined {
    for (let folder = start; folder !== dirname(folder); folder = dirname(folder)) {
        const manifest = join(folder, 'package.json');
        if (files !== undefined && !toPosix(relative(root, manifest)).startsWith(`${DOT_GSPOT}/`)) return undefined;
        const parsed = installedPackage(files, root, manifest);
        if (parsed?.name === name) return parsed.version;
    }
    return undefined;
}

/**
 * Read package metadata from a private installation or a native host installation.
 * @param files the private installation boundary, or undefined for a host installation.
 * @param root the repository root owning the private boundary.
 * @param manifest the absolute package.json path.
 * @returns the validated package fields, or undefined when the file is absent.
 */
export function installedPackage(files: Root | undefined, root: string, manifest: string): PackageManifest | undefined {
    try {
        let text: string | undefined;
        if (files === undefined) text = readFileSync(manifest, 'utf8');
        else {
            const directory = files.realPath(toPosix(relative(root, dirname(manifest))));
            const path = toPosix(relative(root, join(directory, basename(manifest))));
            text = files.read(path)?.bytes.toString('utf8');
        }
        return text === undefined ? undefined : parsePackageManifest(text, manifest);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Executables owned by the repository or its selected private installation, without PATH tools.
 * @param root the repository root
 * @param name the executable name
 * @param options the search folders and installation ownership
 * @returns repository candidates in preference order
 */
export function locateRepositoryCandidates(root: string, name: string, options: LocateOptions): string[] {
    if (isAbsolute(name)) return statSync(name, { throwIfNoEntry: false }) === undefined ? [] : [name];
    return repositoryCandidates(root, searchDirectories(root, options), executableNames(name));
}

/**
 * Every executable of the name, in the order gspot prefers them.
 * @param root the repository root.
 * @param name the executable name.
 * @param options the search folders and private installation ownership.
 * @returns the paths that exist.
 */
export function locateCandidates(root: string, name: string, options: LocateOptions): string[] {
    const found = locateRepositoryCandidates(root, name, options);
    if (isAbsolute(name) || options.privateKind !== undefined) return found;
    return [...found, ...hostCandidates(options.installedRoot ?? root, name, executableNames(name))];
}

/**
 * The version a package.json above the real file of an npm tool holds, for the package the pin names.
 * @param root the repository root.
 * @param path the executable.
 * @param name the package name, or undefined when the tool is not an npm package.
 * @returns the declared version, or undefined when no package.json above the file names the package.
 */
export function packageVersion(root: string, path: string, name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    using files = toPosix(relative(root, path)).startsWith(`${DOT_GSPOT}/`) ? openRoot(root) : undefined;
    const folder = dirname(files === undefined ? realpathSync(path) : files.realPath(toPosix(relative(root, path))));
    // A Windows shim in node_modules/.bin is a file of its own, not a link into its package, so the package is
    // found by name beside that folder.
    const start = basename(folder) === '.bin' ? join(dirname(folder), name) : folder;
    return versionAbove(files, root, start, name);
}

/**
 * The version mise installed for an npm tool behind one of its shims.
 * A shim is one file for every version, so the version is read from the folder mise keeps it in.
 * @param path the executable.
 * @param tool the pin.
 * @returns the pinned version when mise holds it, or undefined.
 */
export function miseVersion(path: string, tool: ToolPin): string | undefined {
    const npm = tool.installers['npm'];
    if (npm?.version === undefined || npm.version !== tool.version) return undefined;
    const home = miseHome();
    if (!path.startsWith(join(home, 'shims'))) return undefined;
    const installed = join(home, 'installs', `npm-${npm.name.replaceAll('/', '-')}`, npm.version);
    return statSync(installed, { throwIfNoEntry: false }) === undefined ? undefined : npm.version;
}
