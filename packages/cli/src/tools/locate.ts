// Where an executable and its installed package version are found: repository bin folders, PATH, and mise shims.
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { miseHome } from '#cli/platform/environment.ts';
import type { ConfinedRoot } from '#cli/types/platform.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { MANAGED_PREFIX } from '#cli/constants/tools/tools.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import type { PackageFacts, PrivateKind } from '#cli/types/tools/tools.ts';
import { NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/constants/platform.ts';

const IS_WINDOWS = process.platform === 'win32';
// A path relative to the repository root with forward slashes, the form the confined root reads.
function localPath(root: string, path: string): string {
    return relative(root, path).replaceAll('\\', '/');
}

// Whether a file exists on disk, without following the repository's confinement rules.
function existsOnDisk(path: string): boolean {
    return statSync(path, { throwIfNoEntry: false }) !== undefined;
}

// The folder mise keeps its shims and installs in.
function miseRoot(): string {
    return miseHome() ?? join(homedir(), '.local', 'share', 'mise');
}

// The folders a tool of the private kind, or a host tool, is searched in.
function searchDirectories(root: string, roots: string[], privateKind: PrivateKind | undefined): string[] {
    if (privateKind === 'npm') return [join(root, NODE_MODULES_DIRECTORY, '.bin')];
    if (privateKind === 'python') return [join(root, PYTHON_ENVIRONMENT_DIRECTORY, IS_WINDOWS ? 'Scripts' : 'bin')];
    return [...new Set(roots)].flatMap((searched) => [
        join(searched, 'node_modules', '.bin'),
        join(searched, '.venv', 'bin'),
        join(searched, '.venv', 'Scripts'),
    ]);
}

// Whether a candidate exists: a managed path must resolve through the confined root, any other is read from disk.
function candidateExists(files: ConfinedRoot, root: string, path: string): boolean {
    const local = localPath(root, path);
    if (!local.startsWith(MANAGED_PREFIX)) return existsOnDisk(path);
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
    const files = openConfinedRoot(root);
    try {
        const paths = directories.flatMap((directory) => names.map((file) => join(directory, file)));
        return paths.filter((path) => candidateExists(files, root, path));
    } finally {
        files.close();
    }
}

// The executables of the name on PATH and among mise's shims.
function hostCandidates(name: string, names: string[]): string[] {
    const onPath = Bun.which(name);
    const shims = join(miseRoot(), 'shims');
    const found = names.map((file) => join(shims, file)).filter((path) => existsOnDisk(path));
    return onPath === null ? found : [onPath, ...found];
}

// The real folder an executable lives in, read through the confined root when the path is managed.
function executableFolder(files: ConfinedRoot | undefined, root: string, path: string): string {
    return dirname(files === undefined ? realpathSync(path) : files.source(localPath(root, path)));
}

// The parsed package.json at a path, or undefined when there is none or it lies outside the managed tree.
function packageFacts(files: ConfinedRoot | undefined, root: string, manifest: string): PackageFacts | undefined {
    if (files === undefined)
        return existsOnDisk(manifest) ? (JSON.parse(readFileSync(manifest, 'utf8')) as PackageFacts) : undefined;
    const text = files.read(localPath(root, manifest))?.bytes.toString('utf8');
    return text === undefined ? undefined : (JSON.parse(text) as PackageFacts);
}

// The version the first package.json above a folder declares for the named package, searching upward.
function versionAbove(files: ConfinedRoot | undefined, root: string, start: string, name: string): string | undefined {
    for (let folder = start; folder !== dirname(folder); folder = dirname(folder)) {
        const manifest = join(folder, 'package.json');
        if (files !== undefined && !localPath(root, manifest).startsWith(MANAGED_PREFIX)) return undefined;
        const parsed = packageFacts(files, root, manifest);
        if (parsed?.name === name) return parsed.version;
    }
    return undefined;
}

/**
 * Every executable of the name, in the order gspot prefers them.
 * @param root the repository root
 * @param roots the folders whose bin directories are searched, for a host tool
 * @param name the executable name
 * @param privateKind the private installation the tool belongs to, which restricts the search to it
 * @returns the paths that exist
 */
export function locateCandidates(root: string, roots: string[], name: string, privateKind?: PrivateKind): string[] {
    const names = IS_WINDOWS ? [`${name}.cmd`, `${name}.exe`, name] : [name];
    const found = repositoryCandidates(root, searchDirectories(root, roots, privateKind), names);
    if (privateKind !== undefined) return found;
    return [...found, ...hostCandidates(name, names)];
}

/**
 * The version a package.json above the real file of an npm tool holds, for the package the pin names.
 * @param root the repository root
 * @param path the executable
 * @param name the package name, or undefined when the tool is not an npm package
 * @returns the declared version, or undefined when no package.json above the file names the package
 */
export function packageVersion(root: string, path: string, name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    const files = localPath(root, path).startsWith(MANAGED_PREFIX) ? openConfinedRoot(root) : undefined;
    try {
        return versionAbove(files, root, executableFolder(files, root, path), name);
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
    const home = miseRoot();
    if (!path.startsWith(join(home, 'shims'))) return undefined;
    const installed = join(home, 'installs', `npm-${npm.name.replaceAll('/', '-')}`, npm.version);
    return existsOnDisk(installed) ? npm.version : undefined;
}
