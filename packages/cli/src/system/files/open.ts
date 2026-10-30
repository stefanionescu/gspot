import { compareText } from '#cli/system/text.ts';
import { readContainedPath } from '#cli/system/files/reads.ts';
import type { Files, FileBounds } from '#cli/types/system/files.ts';
import { extractParentFolder, listEnclosingFolders } from '#cli/system/paths.ts';
import { GspotError, hasErrorCode, buildWriteError } from '#cli/system/errors.ts';
import { rmSync, chmodSync, lstatSync, mkdirSync, rmdirSync, unlinkSync, readdirSync, realpathSync } from 'node:fs';

import {
    readBounded,
    preparePath,
    replaceBounded,
    buildContainedPath,
    readBoundedKeepingLinks,
} from '#cli/system/files/bounded.ts';

function createBoundedFolder(bounds: FileBounds, path: string, mode: number): void {
    try {
        const target = preparePath(bounds, path);
        try {
            mkdirSync(target, { mode });
        } catch (error) {
            if (!hasErrorCode(error, 'EEXIST')) throw error;
        }
        if (!lstatSync(target).isDirectory())
            throw new GspotError('filesystem', `${path} is not a folder. Choose a folder.`);
        chmodSync(target, mode);
    } catch (error) {
        throw buildWriteError(path, error);
    }
}

function deleteBoundedFile(bounds: FileBounds, path: string): void {
    try {
        unlinkSync(buildContainedPath(bounds, path));
    } catch (error) {
        throw buildWriteError(path, error);
    }
}

/**
Open a reader and writer confined to one root, with paths checked for this system.

@param root the folder containing every relative path.
*/
export function openFiles(root: string): Files {
    const bounds: FileBounds = { root: realpathSync(root) };
    const files: Files = {
        deleteFolder(path) {
            try {
                rmdirSync(buildContainedPath(bounds, path));
            } catch (error) {
                throw buildWriteError(path, error);
            }
        },
        deleteTree(path) {
            try {
                const stat = files.readStats(path);
                if (stat?.isDirectory() === false)
                    throw new GspotError('filesystem', `${path} is not a folder. Choose a folder.`);
                if (stat !== undefined) rmSync(buildContainedPath(bounds, path), { recursive: true, force: true });
            } catch (error) {
                throw buildWriteError(path, error);
            }
        },
        readCanonicalPath: (path) => readContainedPath(bounds.root, path),
        list(path) {
            try {
                const target = path === '' ? bounds.root : buildContainedPath(bounds, path);
                if (!lstatSync(target).isDirectory())
                    throw new GspotError('filesystem', `${path || '.'} is not a folder. Choose a folder.`);
                return readdirSync(target).toSorted((left, right) => compareText(left, right));
            } catch (error) {
                if (hasErrorCode(error, 'ENOENT')) return [];
                throw error;
            }
        },
        readStats(path) {
            try {
                const stat = lstatSync(buildContainedPath(bounds, path));
                if (stat.isSymbolicLink())
                    throw new GspotError('filesystem', `${path} is a link. gspot does not write through links.`);
                return stat;
            } catch (error) {
                if (hasErrorCode(error, 'ENOENT')) return undefined;
                throw error;
            }
        },
        read: (path) => readBounded(bounds, path),
        readKeepingLinks: (path) => readBoundedKeepingLinks(bounds, path),
        write: replaceBounded.bind(undefined, bounds),
        deleteFile: deleteBoundedFile.bind(undefined, bounds),
        createFolder: createBoundedFolder.bind(undefined, bounds),
    };
    return files;
}

/**
Remove the empty parent folders that a removed file leaves, stopping at the root.

@param files the file handle of the root.
@param path the removed file.
*/
export function deleteEmptyFolders(files: Files, path: string): void {
    const parents = listEnclosingFolders(extractParentFolder(path)).slice(0, -1);
    for (const folder of parents) {
        if (files.list(folder).length > 0) return;
        files.deleteFolder(folder);
    }
}

/**
Visit every entry under a folder, and walk into each one that the visitor picks.

@param files the root.
@param start the folder, with forward slashes, or '' for the root itself.
@param visit called with the path of each entry; returns whether to walk into it.
*/
export function walkFiles(files: Files, start: string, visit: (path: string) => boolean): void {
    const pending = [start];
    for (let folder = pending.pop(); folder !== undefined; folder = pending.pop()) {
        const names = files.list(folder);
        const paths = folder === '' ? names : names.map((name) => `${folder}/${name}`);
        pending.push(...paths.filter((path) => visit(path)));
    }
}
