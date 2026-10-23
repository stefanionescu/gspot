import { readContainedPath } from '#cli/system/files/reads.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import type { Files, FileBounds } from '#cli/types/system/files.ts';
import { createLock, releaseLocks } from '#cli/system/files/lock.ts';
import { extractParentFolder, listEnclosingFolders } from '#cli/system/paths.ts';
import { rmSync, chmodSync, lstatSync, mkdirSync, rmdirSync, unlinkSync, readdirSync, realpathSync } from 'node:fs';

import {
    readBounded,
    preparePath,
    replaceBounded,
    isSameContents,
    buildContainedPath,
    readBoundedKeepingLinks,
} from '#cli/system/files/bounded.ts';

/**
 * Open a reader and writer confined to one root, with paths checked for this system.
 *
 * @param root the folder containing every relative path.
 * @returns the disposable file handle.
 */
export function openFiles(root: string): Files {
    const state: FileBounds = { root: realpathSync(root), locks: new Map() };
    const files: Files = {
        deleteFolder(path) {
            rmdirSync(buildContainedPath(state, path));
        },
        deleteTree(path) {
            const stat = files.readStats(path);
            if (stat?.isDirectory() === false)
                throw new GspotError('filesystem', `${path} is not a folder. Choose a folder.`);
            if (stat !== undefined) rmSync(buildContainedPath(state, path), { recursive: true, force: true });
        },
        readCanonicalPath: (path) => readContainedPath(state.root, path),
        list(path) {
            try {
                const target = path === '' ? state.root : buildContainedPath(state, path);
                if (!lstatSync(target).isDirectory())
                    throw new GspotError('filesystem', `${path || '.'} is not a folder. Choose a folder.`);
                return readdirSync(target).toSorted((left, right) => left.localeCompare(right));
            } catch (error) {
                if (hasErrorCode(error, 'ENOENT')) return [];
                throw error;
            }
        },
        readStats(path) {
            try {
                const stat = lstatSync(buildContainedPath(state, path));
                if (stat.isSymbolicLink()) throw new Error(`${path} is a link. gspot does not write through links.`);
                return stat;
            } catch (error) {
                if (hasErrorCode(error, 'ENOENT')) return undefined;
                throw error;
            }
        },
        read: (path) => readBounded(state, path),
        readKeepingLinks: (path) => readBoundedKeepingLinks(state, path),
        write: replaceBounded.bind(undefined, state),
        deleteFile(path, expected) {
            if (!isSameContents(readBoundedKeepingLinks(state, path), expected))
                throw new GspotError('filesystem', `${path} changed before removal. Run the command again.`);
            unlinkSync(buildContainedPath(state, path));
        },
        createFolder(path, mode) {
            const target = preparePath(state, path);
            try {
                mkdirSync(target, { mode });
            } catch (error) {
                if (!hasErrorCode(error, 'EEXIST')) throw error;
            }
            if (!lstatSync(target).isDirectory())
                throw new GspotError('filesystem', `${path} is not a folder. Choose a folder.`);
            chmodSync(target, mode);
        },
        createLock: createLock.bind(undefined, state),
        [Symbol.dispose]() {
            for (const path of releaseLocks(state)) removeEmptyFolders(files, path);
        },
    };
    return files;
}

/**
 * Remove the empty parent folders that a removed file leaves, stopping at the root.
 *
 * @param files the file handle of the root.
 * @param path the removed file.
 */
export function removeEmptyFolders(files: Files, path: string): void {
    for (const folder of listEnclosingFolders(extractParentFolder(path)).slice(0, -1)) {
        if (files.list(folder).length > 0) return;
        files.deleteFolder(folder);
    }
}

/**
 * Visit every entry under a folder, and walk into each one that the visitor picks.
 *
 * @param files the root.
 * @param start the folder, with forward slashes, or '' for the root itself.
 * @param visit called with the path of each entry; returns whether to walk into it.
 */
export function walkFiles(files: Files, start: string, visit: (path: string) => boolean): void {
    const pending = [start];
    for (let folder = pending.pop(); folder !== undefined; folder = pending.pop()) {
        const names = files.list(folder);
        const paths = folder === '' ? names : names.map((name) => `${folder}/${name}`);
        pending.push(...paths.filter((path) => visit(path)));
    }
}
