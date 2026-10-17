// Read and write contained files through verified folder paths.
import { posix } from 'node:path';
import { readContainedPath } from '#cli/system/files/reads.ts';
import type { Files, FilesState } from '#cli/types/system/files.ts';
import { releaseLocks, lockForWriting } from '#cli/system/files/lock.ts';
import { rmSync, chmodSync, lstatSync, mkdirSync, rmdirSync, unlinkSync, readdirSync, realpathSync } from 'node:fs';

import {
    readEntry,
    verifyPath,
    preparePath,
    replaceEntry,
    isSameContents,
    readEntryKeepingLinks,
} from '#cli/system/files/entries.ts';

/**
 * Open a reader and writer confined to one root, with paths checked for this system.
 * @param baseFolder the folder containing every relative path.
 * @returns the disposable file handle.
 */
export function openFiles(baseFolder: string): Files {
    const bounds: FilesState = { root: realpathSync(baseFolder), locks: new Map() };
    const files: Files = {
        deleteFolder(path) {
            rmdirSync(verifyPath(bounds, path));
        },
        deleteTree(path) {
            const stat = files.readStats(path);
            if (stat === undefined) return;
            if (!stat.isDirectory()) throw new Error(`${path} is not a directory. Choose a directory.`);
            rmSync(verifyPath(bounds, path), { recursive: true, force: true });
        },
        readRealPath: (path) => readContainedPath(bounds.root, path),
        list(path) {
            try {
                const target = path === undefined ? bounds.root : verifyPath(bounds, path);
                if (!lstatSync(target).isDirectory())
                    throw new Error(`${path ?? '.'} is not a directory. Choose a directory.`);
                return readdirSync(target).toSorted((left, right) => left.localeCompare(right));
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
                throw error;
            }
        },
        readStats(path) {
            try {
                const stat = lstatSync(verifyPath(bounds, path));
                if (stat.isSymbolicLink()) throw new Error(`${path} is a link. gspot does not write through links.`);
                return stat;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
                throw error;
            }
        },
        read: (path) => readEntry(bounds, path),
        readKeepingLinks: (path) => readEntryKeepingLinks(bounds, path),
        write: replaceEntry.bind(undefined, bounds),
        deleteFile(path, expected) {
            if (!isSameContents(readEntryKeepingLinks(bounds, path), expected))
                throw new Error(`${path} changed before removal. Run the command again.`);
            unlinkSync(verifyPath(bounds, path));
        },
        createFolder(path, mode) {
            const target = preparePath(bounds, path);
            try {
                mkdirSync(target, { mode });
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
            }
            if (!lstatSync(target).isDirectory()) throw new Error(`${path} is not a directory. Choose a directory.`);
            chmodSync(target, mode);
        },
        createLock: lockForWriting.bind(undefined, bounds),
        [Symbol.dispose]() {
            for (const path of releaseLocks(bounds)) removeEmptyFolders(files, path);
        },
    };
    return files;
}

/**
 * Remove empty parent folders left by a removed file, stopping at the root.
 * @param files the file handle of the root.
 * @param path the removed file.
 */
export function removeEmptyFolders(files: Files, path: string): void {
    for (let folder = posix.dirname(path); folder !== '.'; folder = posix.dirname(folder)) {
        if (files.list(folder).length > 0) return;
        files.deleteFolder(folder);
    }
}

/**
 * Visit every entry under a folder, and walk into each one that the visitor picks.
 * @param files the root.
 * @param start the folder, with forward slashes, or '' for the root itself.
 * @param visit called with the path of each entry; returns whether to walk into it.
 */
export function walkFiles(files: Files, start: string, visit: (path: string) => boolean): void {
    const pending = [start];
    for (let folder = pending.pop(); folder !== undefined; folder = pending.pop()) {
        const names = files.list(folder === '' ? undefined : folder);
        const paths = folder === '' ? names : names.map((name) => `${folder}/${name}`);
        pending.push(...paths.filter((path) => visit(path)));
    }
}
