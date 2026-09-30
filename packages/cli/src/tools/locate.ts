// Where an executable and its installed package version are found: repository bin folders, PATH, and mise shims.
import which from 'which';
import { homedir } from 'node:os';
import { toPosix } from '#cli/platform/paths.ts';
import type { ToolPin } from '#cli/types/kits.ts';
import type { Root } from '#cli/types/platform.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { miseHome } from '#cli/platform/environment.ts';
import { MANAGED_PREFIX } from '#cli/config/tools/tools.ts';
import { statSync, readFileSync, realpathSync } from 'node:fs';
import type { Package, PrivateKind } from '#cli/types/tools/tools.ts';
import { join, dirname, basename, relative, isAbsolute } from 'node:path';
import { GSPOT_FOLDER, NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/platform.ts';

const IS_WINDOWS = process.platform === 'win32';

// The folders a tool of the private kind, or a host tool, is searched in. A snapshot has no private tools or virtual
// environments of its own: they run from the working tree the snapshot stands for.
function searchDirectories(
    root: string,
    roots: string[],
    privateKind: PrivateKind | undefined,
    installedRoot: string,
): string[] {
    if (privateKind === 'npm') return [join(installedRoot, NODE_MODULES_DIRECTORY, '.bin')];
    const binary = IS_WINDOWS ? 'Scripts' : 'bin';
    if (privateKind === 'python') return [join(installedRoot, PYTHON_ENVIRONMENT_DIRECTORY, binary)];
    // A snapshot links the private tools of gspot instead of copying them, so they are searched in the working tree.
    return [...new Set(roots)].flatMap((searched) => [
        join(
            basename(searched) === GSPOT_FOLDER ? join(installedRoot, relative(root, searched)) : searched,
            'node_modules',
            '.bin',
        ),
        join(installedRoot, relative(root, searched), '.venv', binary),
    ]);
}

// Whether a candidate exists: a managed path must resolve through the files root, any other is read from disk.
function candidateExists(files: Root, root: string, path: string): boolean {
    const local = toPosix(relative(root, path));
    if (!local.startsWith(MANAGED_PREFIX)) return statSync(path, { throwIfNoEntry: false }) !== undefined;
    try {
        files.source(local);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return false;
    }
}

// The executables of the name that exist in the repository's search folders.
function repositoryCandidates(root: string, directories: string[], names: string[]): string[] {
    const files = openRoot(root);
    try {
        const paths = directories.flatMap((directory) => names.map((file) => join(directory, file)));
        return paths.filter((path) => candidateExists(files, root, path));
    } finally {
        files.close();
    }
}

// The executables of the name on PATH and among mise's shims.
function hostCandidates(name: string, names: string[]): string[] {
    const onPath = which.sync(name, { nothrow: true });
    const launcherDirectory = join(miseHome() ?? join(homedir(), '.local', 'share', 'mise'), 'shims');
    const found = names
        .map((file) => join(launcherDirectory, file))
        .filter((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    return onPath === null ? found : [onPath, ...found];
}

// The parsed package.json at a path, or undefined when there is none or it lies outside the managed tree.
function packageFacts(files: Root | undefined, root: string, manifest: string): Package | undefined {
    if (files === undefined) {
        try {
            return JSON.parse(readFileSync(manifest, 'utf8')) as Package;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        }
    }
    const text = files.read(toPosix(relative(root, manifest)))?.bytes.toString('utf8');
    return text === undefined ? undefined : (JSON.parse(text) as Package);
}

// The version the first package.json above a folder declares for the named package, searching upward.
function versionAbove(files: Root | undefined, root: string, start: string, name: string): string | undefined {
    for (let folder = start; folder !== dirname(folder); folder = dirname(folder)) {
        const manifest = join(folder, 'package.json');
        if (files !== undefined && !toPosix(relative(root, manifest)).startsWith(MANAGED_PREFIX)) return undefined;
        const parsed = packageFacts(files, root, manifest);
        if (parsed?.name === name) return parsed.version;
    }
    return undefined;
}

/**
 * Every executable of the name, in the order gspot prefers them.
 * @param root the repository root.
 * @param roots the folders whose bin directories are searched, for a host tool.
 * @param name the executable name.
 * @param privateKind the private installation the tool belongs to, which restricts the search to it.
 * @param installedRoot the working tree whose virtual environments run, when the root is a snapshot of it.
 * @returns the paths that exist.
 */
export function locateCandidates(
    root: string,
    roots: string[],
    name: string,
    privateKind?: PrivateKind,
    installedRoot = root,
): string[] {
    // A command that names its executable by path is that file or nothing.
    if (isAbsolute(name)) return statSync(name, { throwIfNoEntry: false }) === undefined ? [] : [name];
    const names = IS_WINDOWS ? [`${name}.cmd`, `${name}.exe`, name] : [name];
    const found = repositoryCandidates(root, searchDirectories(root, roots, privateKind, installedRoot), names);
    if (privateKind !== undefined) return found;
    return [...found, ...hostCandidates(name, names)];
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
    const files = toPosix(relative(root, path)).startsWith(MANAGED_PREFIX) ? openRoot(root) : undefined;
    try {
        return versionAbove(
            files,
            root,
            dirname(files === undefined ? realpathSync(path) : files.source(toPosix(relative(root, path)))),
            name,
        );
    } finally {
        files?.close();
    }
}

/**
 * The version mise installed for an npm tool behind one of its shims.
 * A shim is one file for every version, so the version is read from the folder mise keeps it in.
 * @param path the executable
 * @param tool the pin
 * @returns the pinned version when mise holds it, or undefined
 */
export function miseVersion(path: string, tool: ToolPin): string | undefined {
    const npm = tool.installers['npm'];
    if (npm?.version === undefined || npm.version !== tool.version) return undefined;
    const home = miseHome() ?? join(homedir(), '.local', 'share', 'mise');
    if (!path.startsWith(join(home, 'shims'))) return undefined;
    const installed = join(home, 'installs', `npm-${npm.name.replaceAll('/', '-')}`, npm.version);
    return statSync(installed, { throwIfNoEntry: false }) === undefined ? undefined : npm.version;
}
