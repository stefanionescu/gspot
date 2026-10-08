import ignore from 'ignore';
import type { Stats } from 'node:fs';
import { createRequire } from 'node:module';
import { GspotError } from '#cli/platform/public.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { runGitBinary } from '#cli/platform/git/public.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { isOutsideGit } from '#cli/platform/git/contracts.ts';
import { parseIndexEntries } from '#cli/parsers/contracts.ts';
import type { GitIndexEntry } from '#cli/types/parsers/git.ts';
import { TRAILING_STAR } from '#cli/config/repository/aliases.ts';
import { readText, readSource } from '#cli/platform/root/public.ts';
import { LIFECYCLE_PRIVATE_PATH } from '#cli/config/platform/root.ts';
import { DEPENDENCY_FOLDERS } from '#cli/config/repository/inventory.ts';
import { inspectWorkTree } from '#cli/repository/discovery/contracts.ts';
import { toPosix, isInside, decodeUtf8 } from '#cli/platform/contracts.ts';
import { join, posix, dirname, resolve, basename, relative } from 'node:path';
import { ENTRY_MODES, GITLINK_MODE } from '#cli/config/repository/revisions.ts';
import { EXECUTABLE_BITS, EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';
import { statSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { isInScope, pathMatcher, isToolingPath } from '#cli/repository/paths/public.ts';
import { getTsconfig, manifestParser, parsePackageManifest } from '#cli/parsers/packages/public.ts';
import type { PackageJson, DependencyMap, PackageManifest, InstalledDependency } from '#cli/types/parsers/packages.ts';

import type {
    RawEntry,
    PathIgnore,
    TrackedFile,
    PendingDirectory,
    DirectoryContents,
} from '#cli/types/repository/inventory.ts';

// A link to a folder, or one that leaves the repository, is left out, so no check reads past it. A dangling link is
// listed with no size.
function symlinkEntry(root: string, path: string): RawEntry | undefined {
    const link = { path, size: 0, executable: false, symlink: true };
    let target: string;
    try {
        target = realpathSync(join(root, path));
    } catch (error) {
        if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ELOOP'))
            return link;
        throw error;
    }
    if (!isInside(relative(realpathSync(root), target))) return undefined;
    const stat = statSync(target);
    return stat.isDirectory() ? undefined : { ...link, size: stat.size };
}

// Report parent replacements consistently whether the OS throws or returns no child stat.
function assertParents(root: string, path: string): void {
    const parts = path.split('/').slice(0, -1);
    let parent = '';
    for (const part of parts) {
        parent = parent === '' ? part : `${parent}/${part}`;
        const entry = statSync(join(root, parent), { throwIfNoEntry: false });
        if (entry === undefined) return;
        if (!entry.isDirectory())
            throw Object.assign(new Error(`Git lists ${path}, but ${parent} is now a file.`), { code: 'ENOTDIR' });
    }
}

function entryStat(root: string, path: string): Stats | undefined {
    try {
        return lstatSync(join(root, path), { throwIfNoEntry: false });
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOTDIR') assertParents(root, path);
        throw error;
    }
}

function getEntry(root: string, path: string, executables: ReadonlySet<string> | undefined): RawEntry | undefined {
    const stat = entryStat(root, path);
    if (stat === undefined) {
        assertParents(root, path);
        return undefined;
    }
    if (stat.isSymbolicLink()) {
        if (DEPENDENCY_FOLDERS.includes(posix.basename(path))) return undefined;
        // Inventory installed links without reading their dependency targets outside this root.
        if (
            path
                .split('/')
                .slice(0, -1)
                .some((part) => DEPENDENCY_FOLDERS.includes(part))
        )
            return { path, size: stat.size, executable: false, symlink: true };
        return symlinkEntry(root, path);
    }
    if (stat.isDirectory()) return undefined;
    const isExecutable = executables === undefined ? (stat.mode & EXECUTABLE_BITS) !== 0 : executables.has(path);
    return { path, size: stat.size, executable: isExecutable, symlink: false };
}

function directoryContents(root: string, directory: string, inherited: PathIgnore[]): DirectoryContents {
    const entries = readdirSync(join(root, directory), { withFileTypes: true });
    const rules = [...inherited];
    if (entries.some((entry) => entry.name === '.gitignore' && entry.isFile())) {
        rules.push({
            base: directory,
            matcher: ignore().add(readSource(root, `${directory}.gitignore`).toString('utf8')),
        });
    }
    return { entries, rules };
}

function isIgnored(candidate: string, rules: PathIgnore[]): boolean {
    let ignored = false;
    for (const { base, matcher } of rules) {
        const result = matcher.test(candidate.slice(base.length));
        if (result.ignored) ignored = true;
        else if (result.unignored) ignored = false;
    }
    return ignored;
}

function walkPaths(root: string): string[] {
    const paths: string[] = [];
    const pending: PendingDirectory[] = [{ directory: '', rules: [] }];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
        const { directory } = next;
        const { entries, rules } = directoryContents(root, directory, next.rules);
        const retained = entries.filter((entry) => {
            if (entry.name === '.git' || entry.isSymbolicLink()) return false;
            const path = `${directory}${entry.name}`;
            const candidate = entry.isDirectory() ? `${path}/` : path;
            return !isIgnored(candidate, rules) && !LIFECYCLE_PRIVATE_PATH.test(path.normalize('NFC'));
        });
        for (const entry of retained) {
            const path = `${directory}${entry.name}`;
            if (entry.isDirectory()) pending.push({ directory: `${path}/`, rules });
            else if (entry.isFile()) paths.push(path);
        }
    }
    return paths;
}

// Share Git listing failure classification while each caller owns its output format and non-Git behavior.
async function listGitFiles(root: string, options: string[], cancelSignal?: AbortSignal): Promise<string | undefined> {
    const listed = await runGitBinary(root, ['ls-files', ...options, '-z'], { cancelSignal });
    if (listed.code === 0) {
        const text = decodeUtf8(listed.stdout);
        if (text === undefined) throw new GspotError('selection', ['Revision paths must be valid UTF-8.']);
        return text;
    }
    if (isOutsideGit(root, inspectWorkTree(root))) return undefined;
    throw new GspotError('selection', [
        `Git ls-files failed in ${root} (exit ${String(listed.code)}): ${listed.stderr.trim()}`,
    ]);
}

function importTarget(target: unknown): string | undefined {
    if (typeof target === 'string') return target;
    if (typeof target !== 'object' || target === null) return undefined;
    return Object.values(target as Record<string, unknown>).find((value) => typeof value === 'string');
}

function packageAliases(root: string, prefix: string): Record<string, string> {
    const aliases: Record<string, string> = {};
    const path = `${prefix}package.json`;
    const manifest = readPackageManifest(root, path);
    const imports = manifest?.imports === undefined ? [] : Object.entries(manifest.imports);
    for (const [pattern, target] of imports) {
        const found = importTarget(target);
        if (found === undefined) continue;
        if (!found.startsWith('./')) continue;
        const alias = found.slice('./'.length).replace(TRAILING_STAR, '');
        aliases[pattern.replace(TRAILING_STAR, '')] = `${prefix}${alias}`;
    }
    return aliases;
}

/**
 * Read the index once for paths, executable bits, and gitlinks. A non-Git directory has none.
 * @param root the repository root
 * @param cancelSignal command cancellation
 * @returns validated entries, retaining stages of conflicted working files
 */
export async function readIndexEntries(root: string, cancelSignal?: AbortSignal): Promise<GitIndexEntry[]> {
    const listed = await listGitFiles(root, ['--stage'], cancelSignal);
    return listed === undefined ? [] : parseIndexEntries(listed);
}

/**
 * Identify gitlinks without opening submodule directories or reading their configuration.
 * @param entries the shared index listing
 * @returns sorted, unique submodule paths
 */
export function getSubmodulePaths(entries: GitIndexEntry[]): string[] {
    return [...new Set(entries.filter((entry) => entry.mode === GITLINK_MODE).map((entry) => entry.path))].toSorted(
        (left, right) => left.localeCompare(right),
    );
}

/**
 * Tracked and about-to-be-tracked files, root-relative posix, sorted. Falls back to a gitignore walk without git.
 * @param root the repository root
 * @param exclude the paths to leave out
 * @param indexEntries the repository-owned index, read here for standalone discovery
 * @returns the entries with size, executable bit, and symlink flag
 */
export async function trackedEntries(
    root: string,
    exclude: string[] = [],
    indexEntries?: GitIndexEntry[],
): Promise<RawEntry[]> {
    const index = indexEntries ?? (await readIndexEntries(root));
    const listed = await listGitFiles(root, ['--others', '--exclude-standard']);
    const paths =
        listed === undefined
            ? walkPaths(root)
            : [...index.map((entry) => entry.path), ...listed.split('\0').filter(Boolean)];
    const submodules = getSubmodulePaths(index);
    const isExcluded = pathMatcher(exclude);
    // Windows file systems keep no executable bit, so the same index listing supplies it.
    const executables =
        process.platform === 'win32'
            ? new Set(
                  index
                      .filter((entry) => entry.mode !== GITLINK_MODE && ENTRY_MODES[entry.mode] === EXECUTABLE_FILE)
                      .map((entry) => entry.path),
              )
            : undefined;
    return [...new Set(paths)]
        .filter(
            (path) =>
                !LIFECYCLE_PRIVATE_PATH.test(path.normalize('NFC')) &&
                !submodules.some((module) => isInScope(path, module)) &&
                !isExcluded(path),
        )
        .toSorted((a, b) => a.localeCompare(b))
        .map((path) => getEntry(root, path, executables))
        .filter((entry) => entry !== undefined);
}

/**
 * Get dependencies from the nearest declared npm project that contains a scope.
 * @param manifests validated source project manifests
 * @param scope the repository-relative project scope
 * @returns declared dependencies without borrowing from children or siblings
 */
export function getProjectDependencies(manifests: PackageManifest[], scope: string): DependencyMap {
    const owner = manifests
        .filter(
            (manifest) =>
                manifest.kind === 'package.json' &&
                isInScope(scope, manifest.path === 'package.json' ? '' : posix.dirname(manifest.path)),
        )
        .toSorted((first, second) => second.path.length - first.path.length)[0];
    if (owner === undefined) return {};
    return owner.dependencies;
}

/**
 * Read supported project manifests for dependency and runtime detection.
 * @param root the repository root
 * @param files the tracked files
 * @returns one project manifest per supported source file
 */
export function readPackageManifests(root: string, files: TrackedFile[]): PackageManifest[] {
    return files
        .filter((file) => file.kind === 'source' && !isToolingPath(file.path))
        .flatMap((file) => {
            try {
                const parse = manifestParser(file.path);
                if (parse === undefined) return [];
                const text = readText(root, file.path);
                if (text === undefined) throw new Error(`Manifest is missing: ${file.path}`);
                return [parse(text)];
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`Cannot inspect manifest ${file.path}: ${detail}`, { cause: error });
            }
        });
}

/**
 * Read and validate the package fields used by repository and check consumers.
 * @param root the repository root
 * @param path the repository-relative package.json path
 * @returns the validated package fields, or undefined when the file is absent
 */
export function readPackageManifest(root: string, path: string): PackageJson | undefined {
    const text = readText(root, path);
    if (text === undefined) return undefined;
    return parsePackageManifest(text, path);
}

/**
 * Read package metadata from a tool project installation or a native host installation.
 * @param files the tool project installation boundary, or undefined for a host installation.
 * @param root the repository root owning the tool-project boundary.
 * @param manifest the absolute package.json path.
 * @returns the validated package fields, or undefined when the file is absent.
 */
export function installedPackage(files: Root | undefined, root: string, manifest: string): PackageJson | undefined {
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
 * Read the path and version of a dependency resolved from its actual project manifest, including hoisted installations.
 * @param root the repository root.
 * @param manifest the repository-relative source project manifest.
 * @param name the installed dependency name.
 * @returns the resolved manifest and its version, or undefined when the dependency is absent.
 */
export function installedDependency(root: string, manifest: string, name: string): InstalledDependency | undefined {
    let path: string;
    try {
        path = createRequire(join(root, manifest)).resolve(`${name}/package.json`);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') return undefined;
        throw error;
    }
    return { path, version: installedPackage(undefined, root, path)?.version };
}

/**
 * Resolves package imports and TypeScript paths for one scope, with TypeScript paths taking precedence.
 * @param root the repository root.
 * @param scope the scope path, empty for the root.
 * @param reads the run-owned compiler configuration cache
 * @returns aliases relative to the repository root.
 */
export function aliasesFor(root: string, scope: string, reads: ReadCache): Record<string, string> {
    const prefix = scope === '' ? '' : `${scope}/`;
    const aliases = packageAliases(root, prefix);
    const path = join(root, prefix, 'tsconfig.json');
    const config = getTsconfig(root, path, reads);
    if (config === undefined) return aliases;
    const options = config.options;
    const paths = options.paths === undefined ? [] : Object.entries(options.paths);
    const inheritedBase = options['pathsBasePath'];
    const base = options.baseUrl ?? (typeof inheritedBase === 'string' ? inheritedBase : dirname(path));
    for (const [pattern, targets] of paths) {
        const target = targets[0];
        if (target === undefined) continue;
        const alias = toPosix(relative(root, resolve(base, target))).replace(TRAILING_STAR, '');
        aliases[pattern.replace(TRAILING_STAR, '')] = alias;
    }
    return aliases;
}
