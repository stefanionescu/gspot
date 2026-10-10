import type { Stats } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { join, posix, dirname } from 'node:path';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { toPosix, decodeUtf8 } from '#cli/platform/contracts.ts';
import { ROOT_SEARCH_DEPTH } from '#cli/config/platform/runtime.ts';
import { globPaths, sameEntry } from '#cli/platform/root/contracts.ts';
import type { Root, Bounds, FileCopy, PathFormat } from '#cli/types/platform/root.ts';
import { claimPath, writeLink, replaceEntry, replaceEntries } from '#cli/platform/root/writes.ts';
import { RUNTIME_WASM, GRAMMAR_PACKAGES, SWIFT_GRAMMAR_FILE } from '#cli/config/platform/assets.ts';

import {
    boundsOf,
    readEntry,
    sourcePath,
    checkedPath,
    preparedPath,
    validateRead,
    canonicalPath,
} from '#cli/platform/root/reads.ts';
import {
    rmSync,
    openSync,
    readSync,
    statSync,
    chmodSync,
    closeSync,
    lstatSync,
    mkdirSync,
    rmdirSync,
    renameSync,
    unlinkSync,
    readdirSync,
    readFileSync,
} from 'node:fs';

let packageDirectory: string | undefined;

// The nearest folder above the running code with a package.json and the configurations, or undefined.
function nearestPackage(): string | undefined {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let index = 0; index < ROOT_SEARCH_DEPTH; index += 1) {
        if (
            statSync(join(dir, 'package.json'), { throwIfNoEntry: false }) !== undefined &&
            statSync(join(dir, 'configurations'), { throwIfNoEntry: false })?.isDirectory() === true
        )
            return dir;
        dir = dirname(dir);
    }
    return undefined;
}

// The package folder that holds the running code. The source tree and an installed package both have one. Code bundled
// into another build, such as the documentation site, finds the package through module resolution instead.

function packageRoot(): string {
    packageDirectory ??=
        nearestPackage() ?? dirname(createRequire(import.meta.url).resolve('@gspothq/cli/package.json'));
    return packageDirectory;
}

// The sorted names in a directory inside the root, or none when it is absent.
function listOf(bounds: Bounds, path: string | undefined): string[] {
    try {
        const target = path === undefined ? bounds.canonical : checkedPath(bounds, path);
        if (!lstatSync(target).isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path ?? '.'}`);
        return readdirSync(target).toSorted((left, right) => left.localeCompare(right));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}

// The stat of an entry inside the root that is not a link, or undefined when it is absent.
function statOf(bounds: Bounds, path: string): Stats | undefined {
    try {
        const stat = lstatSync(checkedPath(bounds, path));
        if (stat.isSymbolicLink()) throw new Error(`Unsafe lifecycle destination: ${path}`);
        return stat;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

// Moves a directory that is not a link to a path of the same root where nothing is yet.
function renameDirectory(bounds: Bounds, from: string, to: string): void {
    if (statOf(bounds, from)?.isDirectory() !== true) throw new Error(`Unsafe lifecycle directory: ${from}`);
    if (statOf(bounds, to) !== undefined) throw new Error(`Lifecycle destination exists: ${to}`);
    renameSync(checkedPath(bounds, from), preparedPath(bounds, to));
}

// Deletes a directory that is not a link, with everything in it. A link inside is removed, never followed.
function removeTree(bounds: Bounds, path: string): void {
    const stat = statOf(bounds, path);
    if (stat === undefined) return;
    if (!stat.isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path}`);
    rmSync(checkedPath(bounds, path), { recursive: true, force: true });
}

// Removes a file inside the root after checking that it is still the one the caller last saw.
function removeEntry(bounds: Bounds, path: string, expected: FileCopy): void {
    if (!sameEntry(readEntry(bounds, path, expected.isLink === true), expected))
        throw new Error(`Lifecycle destination changed during removal: ${path}`);
    unlinkSync(checkedPath(bounds, path));
}

// Creates a directory inside the root with the mode, accepting one that already exists.
function makeDirectory(bounds: Bounds, path: string, mode: number): void {
    const target = preparedPath(bounds, path);
    try {
        mkdirSync(target, { mode });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    if (!lstatSync(target).isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path}`);
    chmodSync(target, mode);
}

// Releases every claim this root still holds, leaving a claim another writer took over. The folders only a claim kept
// go too, so a writer that wrote nothing leaves nothing.
function releaseClaims(bounds: Bounds): void {
    for (const [path, holder] of bounds.claims) {
        if (readEntry(bounds, path, false)?.bytes.toString('utf8') !== holder) continue;
        unlinkSync(checkedPath(bounds, path));
        for (let folder = posix.dirname(path); folder !== '.'; folder = posix.dirname(folder)) {
            if (listOf(bounds, folder).length > 0) break;
            rmdirSync(checkedPath(bounds, folder));
        }
    }
    bounds.claims.clear();
}

/**
 * The file of one asset in the package, for a tool that reads it by path.
 * @param path the asset path, such as `configurations/language/bash/ast-grep/branches.yml`
 * @returns the absolute path
 */
export function assetPath(path: string): string {
    return join(packageRoot(), path);
}

/**
 * Reads one asset by its path in the package, such as `configurations/language/bash/manifest.toml`.
 * @param path the asset path
 * @returns the text
 */
export function readAsset(path: string): string {
    return readFileSync(assetPath(path), 'utf8');
}

/**
 * The path of a grammar or runtime WASM file prepared by setup and shipped in grammars/.
 * @param name the file name, such as `bash.wasm`
 * @returns the WASM file path
 */
export function wasmPath(name: string): string {
    if (!Object.hasOwn(GRAMMAR_PACKAGES, name) && !Object.hasOwn(RUNTIME_WASM, name) && name !== SWIFT_GRAMMAR_FILE)
        throw new Error(`No WebAssembly file named ${name} ships with gspot.`);
    const root = packageRoot();
    const path = join(root, 'grammars', name);
    if (statSync(path, { throwIfNoEntry: false }) !== undefined) return path;
    throw new Error(`The WebAssembly file ${name} is missing from the installed package. Reinstall gspot.`);
}

/**
 * Lists asset paths under a prefix, relative to the package, sorted.
 * @param prefix the path prefix, such as `configurations/`
 * @returns the paths
 */
export function listAssets(prefix: string): string[] {
    const dir = join(packageRoot(), prefix);
    if (statSync(dir, { throwIfNoEntry: false }) === undefined) return [];
    return globPaths(dir, '**/*', { dot: true })
        .map((path) => toPosix(join(prefix, path)))
        .toSorted((a, b) => a.localeCompare(b));
}

/**
 * Opens a reader and writer confined to one folder. Each call checks its path first.
 * @param root the directory containing every relative path.
 * @param pathFormat portable checks names across supported platforms; native checks this platform. Both use forward slashes.
 * @returns the root reader and writer, which the caller disposes, as `using` does.
 */
export function openRoot(root: string, pathFormat: PathFormat = 'portable'): Root {
    const bounds = boundsOf(canonicalPath(root), pathFormat);
    return {
        rmdir: (path) => {
            rmdirSync(checkedPath(bounds, path));
        },
        renameDirectory: (from, to) => {
            renameDirectory(bounds, from, to);
        },
        removeTree: (path) => {
            removeTree(bounds, path);
        },
        realPath: (path) => sourcePath(bounds.canonical, path, bounds.partsOf),
        assertInside: (path) => {
            sourcePath(bounds.canonical, path, bounds.partsOf);
        },
        list: (path) => listOf(bounds, path),
        stat: (path) => statOf(bounds, path),
        validate: (path, value, plannedFiles) => {
            validateRead(bounds, path, value, plannedFiles);
        },
        read: (path) => readEntry(bounds, path, false),
        readKeepingLinks: (path) => readEntry(bounds, path, true),
        write: (path, value, expected) => {
            replaceEntry(bounds, path, value, expected);
        },
        writeAll: (entries) => replaceEntries(bounds, entries),
        link: (path, value) => {
            writeLink(preparedPath(bounds, path), value.bytes, value.mode);
        },
        remove: (path, expected) => {
            removeEntry(bounds, path, expected);
        },
        mkdir: (path, mode) => {
            makeDirectory(bounds, path, mode);
        },
        claim: (path) => {
            claimPath(bounds, path);
        },
        [Symbol.dispose]: () => {
            releaseClaims(bounds);
        },
    };
}

/**
 * Visits every entry under a folder of a root, and enters each one the visitor says is a folder to walk.
 * @param files the root.
 * @param start the folder, with forward slashes, or '' for the root itself.
 * @param visit called with the path of each entry; returns whether to walk into it.
 */
export function walkRoot(files: Root, start: string, visit: (path: string) => boolean): void {
    const pending = [start];
    for (let directory = pending.pop(); directory !== undefined; directory = pending.pop()) {
        const names = files.list(directory === '' ? undefined : directory);
        const paths = directory === '' ? names : names.map((name) => `${directory}/${name}`);
        pending.push(...paths.filter((path) => visit(path)));
    }
}

// Reading the bytes of a repository file: a bounded prefix, its text, or the whole file a run may hold once.

/**
 * Reads a bounded prefix, closing the descriptor even when reading fails.
 * @param root the repository root.
 * @param path the root-relative file.
 * @param limit the maximum byte count.
 * @param reads the canonical root owned by this session.
 * @returns the bytes read.
 */
export function readPrefix(root: string, path: string, limit: number, reads?: ReadCache): Buffer {
    const buffer = Buffer.alloc(limit);
    const source = sourcePath(reads?.root === root ? reads.root : canonicalPath(root), path);
    const descriptor = openSync(source, 'r');
    let offset = 0;
    try {
        while (offset < limit) {
            const count = readSync(descriptor, buffer, { offset, length: limit - offset, position: offset });
            if (count === 0) break;
            offset += count;
        }
        return buffer.subarray(0, offset);
    } finally {
        closeSync(descriptor);
    }
}

/**
 * Reads a file under root. Uses the run's cache only when the cache belongs to this root, so a scratch copy is always read from disk.
 * @param root the directory being read.
 * @param path the source path relative to that directory.
 * @param reads optional bytes cached for this repository and run.
 * @returns the file bytes.
 */
export function readSource(root: string, path: string, reads?: ReadCache): Buffer {
    const read = reads?.root === root ? reads.sources : undefined;
    const held = read?.get(path);
    if (held !== undefined) return held;
    const bytes = readFileSync(sourcePath(reads?.root === root ? reads.root : canonicalPath(root), path));
    read?.set(path, bytes);
    return bytes;
}

/**
 * Read optional authored text, following links only within the repository.
 * @param root the repository root.
 * @param path the repository-relative file.
 * @param reads optional bytes cached for this repository and run.
 * @returns the text, or undefined when the file is absent.
 * @throws when the bytes are not UTF-8 text.
 */
export function readText(root: string, path: string, reads?: ReadCache): string | undefined {
    try {
        const text = decodeUtf8(readSource(root, path, reads));
        if (text === undefined) throw new Error(`${path} is not UTF-8 text.`);
        return text;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Bind source bytes and derived values to one canonical repository root.
 * @param root the repository directory
 * @returns the session-owned read cache
 */
export function createReadCache(root: string): ReadCache {
    return { root: canonicalPath(root), sources: new Map(), memo: new Map() };
}
