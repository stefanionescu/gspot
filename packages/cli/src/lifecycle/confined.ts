import { LIFECYCLE_PRIVATE_PATH } from '#cli/lifecycle/patterns-definitions.ts';
import { randomUUID } from 'node:crypto';
import { dirname, join, posix } from 'node:path';
import {
    chmodSync,
    closeSync,
    fchmodSync,
    fsyncSync,
    lchmodSync,
    lstatSync,
    mkdirSync,
    openSync,
    readFileSync,
    readlinkSync,
    realpathSync,
    renameSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import type { ConfinedRoot, FileSnapshot } from '#cli/lifecycle/types.ts';

const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

/** Reject path spellings that have different meanings on supported operating systems. */
export function mutationPath(path: string): string[] {
    const parts = path.split('/');
    if (
        parts.some(
            (part) =>
                part === '' ||
                part === '.' ||
                part === '..' ||
                /[\\:<>"|?*\u0000-\u001f\u007f]/u.test(part) ||
                /[. ]$/u.test(part) ||
                DEVICE_NAME.test(part),
        )
    ) {
        throw new Error(`Unsafe lifecycle path: ${JSON.stringify(path)}`);
    }
    return parts;
}

/** Snapshot names reject path traversal and null bytes. */
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

/** Public mutation proposals cannot target the owner's journal, lock, or recovery files. */
export function mutationTarget(path: string): void {
    mutationPath(path);
    privateTarget(path);
}

/** Check paths before each operation. Concurrent hostile directory replacement is outside this contract. */
export function openConfinedRoot(root: string, pathFormat: 'portable' | 'native' = 'portable'): ConfinedRoot {
    const canonical = realpathSync(root);
    const partsOf = pathFormat === 'portable' ? mutationPath : nativePath;
    const locks = new Map<string, string>();
    const parent = (path: string, create = false): string => {
        const parts = partsOf(path);
        const leaf = parts.pop()!;
        let directory = canonical;
        for (const part of parts) {
            directory = join(directory, part);
            if (create) {
                try {
                    mkdirSync(directory);
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                }
            }
            const stat = lstatSync(directory);
            if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe lifecycle parent: ${path}`);
        }
        return join(directory, leaf);
    };
    const readEntry = (path: string, allowLink: boolean): FileSnapshot | undefined => {
        try {
            const target = parent(path);
            const stat = lstatSync(target);
            if (allowLink && stat.isSymbolicLink())
                return { bytes: Buffer.from(readlinkSync(target)), mode: stat.mode & 0o7777, isLink: true };
            if (!stat.isFile() || stat.nlink !== 1)
                throw new Error(`Lifecycle destination is not a private regular file: ${path}`);
            const bytes = readFileSync(target);
            const after = lstatSync(target);
            if (stat.size !== bytes.length || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs)
                throw new Error(`Lifecycle destination changed while being read: ${path}`);
            return { bytes, mode: stat.mode & 0o7777 };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        }
    };
    const validate = (path: string, value: FileSnapshot): string | undefined => {
        partsOf(path);
        if (!value.isLink) return undefined;
        const target = value.bytes.toString('utf8');
        if (
            !Buffer.from(target).equals(value.bytes) ||
            target === '' ||
            target.startsWith('/') ||
            (pathFormat === 'portable' ? /[\\:\u0000-\u001f\u007f]/u.test(target) : target.includes('\0'))
        )
            throw new Error(`Unsafe lifecycle link target: ${path}`);
        const destination = posix.join(posix.dirname(path), target);
        partsOf(destination);
        privateTarget(destination);
        if (posix.relative(posix.dirname(path), destination) !== target)
            throw new Error(`Lifecycle link target must use a normalized relative path: ${path}`);
        if (readEntry(destination, false) === undefined) throw new Error(`Lifecycle link target is missing: ${path}`);
        return target;
    };
    return {
        validate(path, value) {
            validate(path, value);
        },
        read(path) {
            return readEntry(path, false);
        },
        readEntry(path) {
            return readEntry(path, true);
        },
        write(path, value, expected) {
            const link = validate(path, value);
            const target = parent(path, true);
            const temporary = join(dirname(target), `.gspot-${randomUUID()}.tmp`);
            let staged = false;
            try {
                if (link !== undefined) {
                    symlinkSync(link, temporary);
                    staged = true;
                    if (process.platform === 'darwin') lchmodSync(temporary, value.mode);
                } else {
                    const file = openSync(temporary, 'wx', 0o600);
                    staged = true;
                    try {
                        writeFileSync(file, value.bytes);
                        fchmodSync(file, value.mode);
                        fsyncSync(file);
                    } finally {
                        closeSync(file);
                    }
                }
                if (!isDeepStrictEqual(readEntry(path, expected?.isLink === true), expected))
                    throw new Error(`Lifecycle destination changed during the operation: ${path}`);
                renameSync(temporary, parent(path));
                staged = false;
            } finally {
                if (staged) unlinkSync(temporary);
            }
        },
        remove(path, expected) {
            if (!isDeepStrictEqual(readEntry(path, expected.isLink === true), expected))
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
            const token = `${process.pid}:${randomUUID()}`;
            for (;;) {
                try {
                    writeFileSync(target, token, { flag: 'wx', mode: 0o600 });
                    locks.set(path, token);
                    return;
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                }
                const current = readEntry(path, false);
                const pid = Number(current?.bytes.toString('utf8').split(':')[0]);
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
            for (const [path, token] of locks) {
                if (readEntry(path, false)?.bytes.toString('utf8') === token) unlinkSync(parent(path));
            }
            locks.clear();
        },
    };
}
