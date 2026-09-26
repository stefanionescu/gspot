import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { dirname, isAbsolute, join, posix, relative, sep } from 'node:path';
import { MODE_BITS, OWNER_WRITE_BIT, PRIVATE_FILE, READ_ONLY_FILE, WRITABLE_FILE } from '#cli/platform/file-modes.ts';

import {
    type Stats,
    chmodSync,
    closeSync,
    fchmodSync,
    fsyncSync,
    // eslint-disable-next-line sonarjs/deprecation, n/no-deprecated-api -- lchmod is the one call that sets a link's own mode on macOS
    lchmodSync,
    lstatSync,
    mkdirSync,
    openSync,
    readFileSync,
    readdirSync,
    readlinkSync,
    realpathSync,
    renameSync,
    rmdirSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';

const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

function sameSnapshot(found: FileSnapshot | undefined, expected: FileSnapshot | undefined): boolean {
    if (found === undefined || expected === undefined) return found === expected;
    const observed = { ...found, mode: fileMode(found) };
    const requested = { ...expected, mode: fileMode(expected) };
    return isDeepStrictEqual(observed, requested);
}

/**
 * Snapshot names reject path traversal and null bytes.
 * @param path a repository-relative path in the platform's own spelling
 * @returns the path's segments
 */
function nativePath(path: string): string[] {
    if (process.platform === 'win32') return mutationPath(path);
    const parts = path.split('/');
    if (parts.some((part) => part === '' || part === '.' || part === '..' || part.includes('\0')))
        throw new Error(`Unsafe lifecycle path: ${JSON.stringify(path)}`);
    return parts;
}

function privateTarget(path: string): void {
    if (LIFECYCLE_PRIVATE_PATH.test(path.normalize('NFC'))) {
        throw new Error(`Lifecycle metadata is not a generated target: ${path}`);
    }
}

/** Recovery and ownership metadata never enter repository checks or generated proposals. */
export const LIFECYCLE_PRIVATE_PATH =
    /(?:^|\/)\.gspot\/(?:state(?:\/|$)|ownership\.json$|writer\.lock$|recovery(?:\/|$))/iu;

/**
 * Compare only permissions represented by the host filesystem API. Windows exposes a read-only flag.
 * @param file the snapshot's mode and whether it is a link
 * @param platform the platform whose permission model applies
 * @returns the mode the platform can represent
 */
export function fileMode(file: Pick<FileSnapshot, 'mode' | 'isLink'>, platform = process.platform): number {
    if (platform !== 'win32') return file.mode;
    if (file.isLink || (file.mode & OWNER_WRITE_BIT) !== 0) return WRITABLE_FILE;
    return READ_ONLY_FILE;
}

/**
 * Reject path spellings that have different meanings on supported operating systems.
 * @param path a repository-relative path with forward slashes
 * @returns the path's segments
 */
export function mutationPath(path: string): string[] {
    const parts = path.split('/');
    if (
        parts.some(
            (part) =>
                part === '' ||
                part === '.' ||
                part === '..' ||
                /[\\:<>"|?*\p{Cc}]/u.test(part) ||
                /[. ]$/u.test(part) ||
                DEVICE_NAME.test(part),
        )
    ) {
        throw new Error(`Unsafe lifecycle path: ${JSON.stringify(path)}`);
    }
    return parts;
}

/**
 * Public mutation proposals cannot target the owner's journal, lock, or recovery files.
 * @param path the proposed path
 */
export function mutationTarget(path: string): void {
    mutationPath(path);
    privateTarget(path);
}

/**
 * Check paths before each operation. Concurrent hostile directory replacement is outside this contract.
 * @param root the directory every path is confined to
 * @param pathFormat whether paths use forward slashes or the platform's own spelling
 * @returns the confined reader and writer, which the caller closes
 */
export function openConfinedRoot(root: string, pathFormat: 'portable' | 'native' = 'portable'): ConfinedRoot {
    const canonical = realpathSync(root);
    const partsOf = pathFormat === 'portable' ? mutationPath : nativePath;
    const locks = new Map<string, string>();
    const parent = (path: string, create = false): string => {
        const parts = partsOf(path);
        const leaf = parts.pop();
        if (leaf === undefined) throw new Error('A path inside the root cannot be empty.');
        let directory = canonical;
        for (const part of parts) {
            directory = join(directory, part);
            let stat: Stats;
            try {
                stat = lstatSync(directory);
            } catch (error) {
                if (!create || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
                try {
                    mkdirSync(directory);
                } catch (creationError) {
                    if ((creationError as NodeJS.ErrnoException).code !== 'EEXIST') throw creationError;
                }
                stat = lstatSync(directory);
            }
            if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe lifecycle parent: ${path}`);
        }
        return join(directory, leaf);
    };
    const readEntry = (path: string, allowLink: boolean): FileSnapshot | undefined => {
        try {
            const target = parent(path);
            const stat = lstatSync(target);
            if (allowLink && stat.isSymbolicLink())
                return {
                    bytes: Buffer.from(readlinkSync(target)),
                    mode: fileMode({ mode: stat.mode & MODE_BITS, isLink: true }),
                    isLink: true,
                };
            if (!stat.isFile() || stat.nlink !== 1)
                throw new Error(`Lifecycle destination is not a private regular file: ${path}`);
            const bytes = readFileSync(target);
            const after = lstatSync(target);
            if (stat.size !== bytes.length || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs)
                throw new Error(`Lifecycle destination changed while being read: ${path}`);
            return { bytes, mode: fileMode({ mode: stat.mode & MODE_BITS }) };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        }
    };
    const validate = (
        path: string,
        value: FileSnapshot,
        proposed?: ReadonlyMap<string, FileSnapshot | undefined>,
    ): string | undefined => {
        partsOf(path);
        if (!value.isLink) return undefined;
        const target = value.bytes.toString('utf8');
        if (
            !Buffer.from(target).equals(value.bytes) ||
            target === '' ||
            target.startsWith('/') ||
            (pathFormat === 'portable' ? /[\\:\p{Cc}]/u.test(target) : target.includes('\0'))
        )
            throw new Error(`Unsafe lifecycle link target: ${path}`);
        const destination = posix.join(posix.dirname(path), target);
        partsOf(destination);
        privateTarget(destination);
        if (posix.relative(posix.dirname(path), destination) !== target)
            throw new Error(`Lifecycle link target must use a normalized relative path: ${path}`);
        const targetFile =
            proposed?.has(destination) === true ? proposed.get(destination) : readEntry(destination, false);
        if (targetFile === undefined) throw new Error(`Lifecycle link target is missing: ${path}`);
        if (targetFile.isLink) throw new Error(`Lifecycle link target is not a regular file: ${path}`);
        return target;
    };
    const write: ConfinedRoot['write'] = (path, value, expected) => {
        const link = validate(path, value);
        const target = parent(path, true);
        const temporary = join(dirname(target), `.gspot-${randomUUID()}.tmp`);
        let staged = false;
        let removed = false;
        try {
            if (link === undefined) {
                const file = openSync(temporary, 'wx', PRIVATE_FILE);
                staged = true;
                try {
                    writeFileSync(file, value.bytes);
                    fchmodSync(file, value.mode);
                    fsyncSync(file);
                } finally {
                    closeSync(file);
                }
            } else {
                symlinkSync(link, temporary);
                staged = true;
                // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- lchmod is the one call that sets a link's own mode on macOS
                if (process.platform === 'darwin') lchmodSync(temporary, value.mode);
            }
            if (!sameSnapshot(readEntry(path, expected?.isLink === true), expected))
                throw new Error(`Lifecycle destination changed during the operation: ${path}`);
            // Windows cannot rename over a read-only file. The owner journals its saved bytes
            // before this removal, so an interrupted replacement can restore the absent target.
            if (
                process.platform === 'win32' &&
                expected !== undefined &&
                !expected.isLink &&
                (expected.mode & OWNER_WRITE_BIT) === 0
            ) {
                unlinkSync(parent(path));
                removed = true;
            }
            renameSync(temporary, parent(path));
            staged = false;
        } catch (error) {
            if (removed && expected !== undefined) {
                try {
                    if (readEntry(path, false) === undefined) write(path, expected, undefined);
                } catch (restorationError) {
                    throw new AggregateError([error, restorationError], `Replacement and restoration failed: ${path}`);
                }
            }
            throw error;
        } finally {
            if (staged) unlinkSync(temporary);
        }
    };
    return {
        rmdir(path) {
            rmdirSync(parent(path));
        },
        source(path) {
            const target = realpathSync(parent(path));
            const local = relative(canonical, target);
            if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`))
                throw new Error(`Source link leaves the repository: ${path}`);
            return target;
        },
        list(path) {
            try {
                const target = path === undefined ? canonical : parent(path);
                if (!lstatSync(target).isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path ?? '.'}`);
                return readdirSync(target).toSorted((left, right) => left.localeCompare(right));
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
                throw error;
            }
        },
        stat(path) {
            try {
                const stat = lstatSync(parent(path));
                if (stat.isSymbolicLink()) throw new Error(`Unsafe lifecycle destination: ${path}`);
                return stat;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
                throw error;
            }
        },
        validate(path, value, proposed) {
            validate(path, value, proposed);
        },
        read(path) {
            return readEntry(path, false);
        },
        readEntry(path) {
            return readEntry(path, true);
        },
        write,
        remove(path, expected) {
            if (!sameSnapshot(readEntry(path, expected.isLink === true), expected))
                throw new Error(`Lifecycle destination changed during removal: ${path}`);
            unlinkSync(parent(path));
        },
        mkdir(path, mode) {
            const target = parent(path, true);
            try {
                mkdirSync(target, { mode });
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
            }
            if (!lstatSync(target).isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path}`);
            chmodSync(target, mode);
        },
        lock(path) {
            const target = parent(path, true);
            const token = `${String(process.pid)}:${randomUUID()}`;
            for (;;) {
                try {
                    writeFileSync(target, token, { flag: 'wx', mode: PRIVATE_FILE });
                    locks.set(path, token);
                    return;
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                }
                const current = readEntry(path, false);
                const pid = Number(current?.bytes.toString('utf8').split(':', 1)[0]);
                if (!Number.isSafeInteger(pid) || pid <= 0)
                    throw new Error(
                        `Incomplete lifecycle lock: ${path}. Remove it after checking that no writer is running.`,
                    );
                try {
                    process.kill(pid, 0);
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
                    if (isDeepStrictEqual(current, readEntry(path, false))) unlinkSync(target);
                    continue;
                }
                throw new Error('Another lifecycle writer holds this repository. Retry after it finishes.');
            }
        },
        close() {
            for (const [path, holder] of locks) {
                if (readEntry(path, false)?.bytes.toString('utf8') === holder) unlinkSync(parent(path));
            }
            locks.clear();
        },
    };
}

export type FileSnapshot = { bytes: Buffer; mode: number; isLink?: true };

export type ConfinedRoot = {
    source(path: string): string;
    list(path?: string): string[];
    stat(path: string): Stats | undefined;
    validate(path: string, value: FileSnapshot, proposed?: ReadonlyMap<string, FileSnapshot | undefined>): void;
    readEntry(path: string): FileSnapshot | undefined;
    read(path: string): FileSnapshot | undefined;
    write(path: string, value: FileSnapshot, expected: FileSnapshot | undefined): void;
    remove(path: string, expected: FileSnapshot): void;
    mkdir(path: string, mode: number): void;
    rmdir(path: string): void;
    lock(path: string): void;
    close(): void;
};
