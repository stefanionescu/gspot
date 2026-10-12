// Applies temporary file changes and restores their original contents and modes.
import { crc32 } from 'node:zlib';
import { join, dirname } from 'node:path';
import { ZIP_LAYOUT } from '#tests/config/files.ts';
import { git, markExecutable } from '#tests/setup/git.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import type { ZipEntry, OriginalFile, SampleChanges } from '#tests/types/checks.ts';

import {
    rm,
    open,
    chmod,
    lstat,
    mkdir,
    rmdir,
    access,
    unlink,
    readdir,
    symlink,
    readFile,
    readlink,
    writeFile,
} from 'node:fs/promises';

/**
 * Returns the index entries of the paths to the last commit, undoing what marking them executable staged.
 * @param cwd the sandbox.
 * @param paths the repository-relative files.
 */
function resetIndex(cwd: string, paths: readonly string[]): void {
    if (!isWindows || paths.length === 0) return;
    const result = git(cwd, ['reset', '-q', '--', ...paths]);
    if (result.code !== 0) throw new Error(`Resetting the index failed: ${result.stderr}${result.stdout}`);
}

async function originalFile(path: string): Promise<OriginalFile | undefined> {
    try {
        const attributes = await lstat(path);
        if (attributes.isSymbolicLink()) return { kind: 'symlink', target: await readlink(path) };
        await using file = await open(path, 'r');
        const awaitedAttributes = await file.stat();
        return { kind: 'file', bytes: await file.readFile(), mode: awaitedAttributes.mode };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

async function absentParents(cwd: string, paths: readonly string[]): Promise<string[]> {
    const parents = new Set<string>();
    for (const path of paths) {
        let parent = dirname(join(cwd, path));
        while (parent !== cwd && !(await pathExists(parent))) {
            parents.add(parent);
            parent = dirname(parent);
        }
    }
    return [...parents].toSorted((a, b) => b.length - a.length);
}

async function restoreFiles(cwd: string, originals: Map<string, OriginalFile | undefined>): Promise<void> {
    for (const [path, original] of originals) {
        const full = join(cwd, path);
        await rm(full, { force: true });
        if (original?.kind === 'symlink') await symlink(original.target, full);
        else if (original?.kind === 'file') {
            await writeFile(full, original.bytes);
            await chmod(full, original.mode);
        }
    }
}

async function removeParents(parents: string[]): Promise<void> {
    for (const path of parents) {
        try {
            await rmdir(path);
        } catch (error) {
            // Keep generated and native files for their owners to remove after restoring the sample.
            const code = (error as NodeJS.ErrnoException).code;
            if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw error;
        }
    }
}

async function writeChanges(cwd: string, changes: SampleChanges, settings: string): Promise<void> {
    const { removed = [], executable = [] } = changes;
    for (const path of removed) await rm(join(cwd, path));
    for (const [path, text] of Object.entries(changes.files)) {
        const full = join(cwd, path);
        await mkdir(dirname(full), { recursive: true });
        const original = await originalFile(full);
        if (original?.kind === 'symlink') await unlink(full);
        await writeFile(full, text);
    }
    for (const path of executable) await markExecutable(cwd, path);
    await writeFile(join(cwd, 'gspot.toml'), settings);
}

// Preserve bytes and permissions before the first mutation, including setup that fails partway through.
export async function applyChanges(cwd: string, changes: SampleChanges): Promise<() => Promise<void>> {
    const settingsPath = join(cwd, 'gspot.toml');
    const current = await readFile(settingsPath, 'utf8');
    const base = changes.files['gspot.toml'] ?? current;
    const settings = [base, changes.settings].filter((text) => text !== undefined).join('\n');
    const gone = changes.removed ?? [];
    const executables = changes.executable ?? [];
    const paths = [...new Set(['gspot.toml', ...gone, ...executables, ...Object.keys(changes.files)])];
    const originals = new Map<string, OriginalFile | undefined>();
    for (const path of paths) originals.set(path, await originalFile(join(cwd, path)));
    for (const path of gone)
        if (originals.get(path) === undefined) throw new Error(`The sandbox removal target ${path} is absent.`);
    const parents = await absentParents(cwd, paths);
    const restore = async (): Promise<void> => {
        await restoreFiles(cwd, originals);
        await removeParents(parents);
        resetIndex(cwd, executables);
    };
    try {
        await writeChanges(cwd, changes, settings);
    } catch (error) {
        await restore();
        throw error;
    }
    return restore;
}

/**
 * Captures repository paths, file contents, and modes for write-preservation tests.
 * @param root the repository directory.
 * @returns each path and its mode and contents.
 */
export async function readTree(root: string): Promise<Record<string, string>> {
    const entries = await readdir(root, { recursive: true });
    return Object.fromEntries(
        await Promise.all(
            entries.map(async (entry) => {
                const path = entry;
                const full = join(root, path);
                const attributes = await lstat(full);
                let bytes = 'directory';
                if (attributes.isSymbolicLink()) bytes = `symlink:${await readlink(full)}`;
                else if (attributes.isFile()) {
                    await using file = await open(full, 'r');
                    const content = await file.readFile();
                    const nextAwaitedAttributes = await file.stat();
                    return [path, `${String(nextAwaitedAttributes.mode)}:file:${content.toString('base64')}`] as const;
                }
                return [path, `${String(attributes.mode)}:${bytes}`] as const;
            }),
        ),
    );
}

/**
 * Checks whether a filesystem path exists, following symbolic links.
 * @param path the file or directory.
 * @returns false when filesystem access fails, matching the filesystem existence contract.
 */
export function pathExists(path: string): Promise<boolean> {
    return access(path).then(
        () => true,
        () => false,
    );
}

/**
 * Encode test package entries as a stored archive with their Unix file modes.
 * @param entries the entry names, bytes, and optional file modes.
 * @returns the archive bytes.
 */
export function zipArchive(entries: readonly ZipEntry[]): Buffer<ArrayBuffer> {
    const local: Buffer[] = [];
    const directory: Buffer[] = [];
    let offset = 0;
    for (const [name, data, mode] of entries) {
        const filename = Buffer.from(name);
        const header = Buffer.alloc(ZIP_LAYOUT.local.size);
        header.writeUInt32LE(ZIP_LAYOUT.local.signature);
        header.writeUInt16LE(ZIP_LAYOUT.local.version, ZIP_LAYOUT.local.versionOffset);
        header.writeUInt32LE(crc32(data), ZIP_LAYOUT.local.crcOffset);
        header.writeUInt32LE(data.length, ZIP_LAYOUT.local.compressedSizeOffset);
        header.writeUInt32LE(data.length, ZIP_LAYOUT.local.sizeOffset);
        header.writeUInt16LE(filename.length, ZIP_LAYOUT.local.nameLengthOffset);
        local.push(header, filename, data);
        const central = Buffer.alloc(ZIP_LAYOUT.central.size);
        central.writeUInt32LE(ZIP_LAYOUT.central.signature);
        central.writeUInt16LE(ZIP_LAYOUT.central.version, ZIP_LAYOUT.central.versionOffset);
        header.copy(
            central,
            ZIP_LAYOUT.central.localCopyOffset,
            ZIP_LAYOUT.central.localStart,
            ZIP_LAYOUT.central.localEnd,
        );
        central.writeUInt32LE(
            ((mode ?? ZIP_LAYOUT.unix.regular) << ZIP_LAYOUT.unix.modeShift) >>> 0,
            ZIP_LAYOUT.central.modeOffset,
        );
        central.writeUInt32LE(offset, ZIP_LAYOUT.central.localOffset);
        directory.push(central, filename);
        offset += header.length + filename.length + data.length;
    }
    const end = Buffer.alloc(ZIP_LAYOUT.end.size);
    end.writeUInt32LE(ZIP_LAYOUT.end.signature);
    end.writeUInt16LE(entries.length, ZIP_LAYOUT.end.diskCountOffset);
    end.writeUInt16LE(entries.length, ZIP_LAYOUT.end.countOffset);
    end.writeUInt32LE(
        directory.reduce((size, part) => size + part.length, 0),
        ZIP_LAYOUT.end.sizeOffset,
    );
    end.writeUInt32LE(offset, ZIP_LAYOUT.end.directoryOffset);
    return Buffer.concat([...local, ...directory, end]);
}
