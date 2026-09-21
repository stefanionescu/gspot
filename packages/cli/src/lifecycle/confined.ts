import { LIFECYCLE_PRIVATE_PATH } from '#config/patterns.ts';
import { dlopen, read } from 'bun:ffi';
import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { getSystemErrorName } from 'node:util';
import {
    closeSync,
    constants,
    fchmodSync,
    fstatSync,
    fsyncSync,
    openSync,
    readFileSync,
    realpathSync,
    writeFileSync,
} from 'node:fs';
import type { ConfinedRoot, FileSnapshot } from '#types/lifecycle.ts';

// O_CLOEXEC is omitted by node:fs constants. Values follow Darwin fcntl.h and Linux asm-generic/fcntl.h.
const CLOSE_ON_EXEC = process.platform === 'darwin' ? 0x01000000 : 0x00080000;
const DIRECTORY_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | CLOSE_ON_EXEC;
const FILE_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK | CLOSE_ON_EXEC;
// Darwin O_SYMLINK opens the link itself; Linux requires O_PATH with O_NOFOLLOW.
const LINK_FLAGS = 0x00200000 | CLOSE_ON_EXEC | (process.platform === 'linux' ? constants.O_NOFOLLOW : 0);
const LOCK_EXCLUSIVE = 2;
const LOCK_NONBLOCKING = 4;
const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

function nativeOperations() {
    if (process.platform !== 'darwin' && process.platform !== 'linux') {
        throw new Error('Secure lifecycle mutations are unavailable on this platform. No files were changed.');
    }
    const libraries = process.platform === 'darwin' ? ['/usr/lib/libSystem.B.dylib'] : ['libc.so.6', 'libc.so'];
    const definitions = {
        symlinkat: { args: ['cstring', 'i32', 'cstring'], returns: 'i32' },
        readlinkat: { args: ['i32', 'cstring', 'ptr', 'u64'], returns: 'i64' },
        mkdirat: { args: ['i32', 'cstring', 'i32'], returns: 'i32' },
        renameat: { args: ['i32', 'cstring', 'i32', 'cstring'], returns: 'i32' },
        unlinkat: { args: ['i32', 'cstring', 'i32'], returns: 'i32' },
        flock: { args: ['i32', 'i32'], returns: 'i32' },
    } as const;
    const failures: unknown[] = [];
    for (const library of libraries) {
        try {
            const operations = dlopen(library, definitions);
            // Darwin's fixed-argument entry avoids the ARM64 variadic calling convention.
            const openName = process.platform === 'darwin' ? '__openat' : 'openat';
            const opens = dlopen(library, {
                [openName]: { args: ['i32', 'cstring', 'i32', 'i32'], returns: 'i32' },
            });
            const errorName = process.platform === 'darwin' ? '__error' : '__errno_location';
            const errors = dlopen(library, { [errorName]: { args: [], returns: 'ptr' } });
            return {
                symbols: { ...operations.symbols, openat: opens.symbols[openName]! },
                errno: (): number => {
                    const pointer = errors.symbols[errorName]!();
                    if (pointer === null) throw new Error('Cannot read the native filesystem error.');
                    return read.i32(pointer);
                },
                close: (): void => {
                    opens.close();
                    errors.close();
                    operations.close();
                },
            };
        } catch (error) {
            failures.push(error);
        }
    }
    throw new AggregateError(failures, 'Native lifecycle confinement is unavailable. No files were changed.');
}

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

/** Native snapshot names still reject path traversal and C-string truncation. */
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

/** Open the canonical root once; all descendant mutations use pinned directory handles. */
export function openConfinedRoot(root: string, pathFormat: 'portable' | 'native' = 'portable'): ConfinedRoot {
    const partsOf = pathFormat === 'portable' ? mutationPath : nativePath;
    const native = nativeOperations();
    const symbols = native.symbols;
    const errno = native.errno;
    const failed = (operation: string, path: string, number = errno()): NodeJS.ErrnoException => {
        const code = getSystemErrorName(-number);
        return Object.assign(new Error(`${operation} ${JSON.stringify(path)}: ${code}`), { code });
    };
    const name = (path: string): Buffer => Buffer.from(`${path}\0`);
    let rootHandle = openSync('/', DIRECTORY_FLAGS);
    try {
        for (const part of realpathSync(root)
            .split('/')
            .filter((part) => part !== '')) {
            const next = symbols.openat(rootHandle, name(part), DIRECTORY_FLAGS, 0);
            if (next < 0) throw failed('Open lifecycle root', root);
            closeSync(rootHandle);
            rootHandle = next;
        }
    } catch (error) {
        closeSync(rootHandle);
        native.close();
        throw error;
    }
    let closed = false;
    const handles = new Set<number>();
    const parent = (path: string, create: boolean): { handle: number; leaf: string } => {
        if (closed) throw new Error('The lifecycle mutation boundary is closed.');
        const parts = partsOf(path);
        const leaf = parts.pop()!;
        let handle = symbols.openat(rootHandle, name('.'), DIRECTORY_FLAGS, 0);
        if (handle < 0) throw failed('Open lifecycle root', path);
        try {
            for (const part of parts) {
                let next = symbols.openat(handle, name(part), DIRECTORY_FLAGS, 0);
                if (next < 0 && errno() === 2 && create) {
                    if (symbols.mkdirat(handle, name(part), 0o755) < 0 && errno() !== 17) {
                        throw failed('Create parent directory', path);
                    }
                    fsyncSync(handle);
                    next = symbols.openat(handle, name(part), DIRECTORY_FLAGS, 0);
                }
                if (next < 0) throw failed('Open parent directory', path);
                closeSync(handle);
                handle = next;
            }
            return { handle, leaf };
        } catch (error) {
            closeSync(handle);
            throw error;
        }
    };
    const snapshotAt = (handle: number, leaf: string, path: string, allowLink = false): FileSnapshot | undefined => {
        let file = symbols.openat(handle, name(leaf), FILE_FLAGS, 0);
        if (file < 0 && allowLink && getSystemErrorName(-errno()) === 'ELOOP') {
            file = symbols.openat(handle, name(leaf), LINK_FLAGS, 0);
        }
        if (file < 0) {
            if (errno() === 2) return undefined;
            throw failed('Read lifecycle file', path);
        }
        try {
            const stat = fstatSync(file);
            if (allowLink && stat.isSymbolicLink() && stat.nlink === 1) {
                const buffer = Buffer.alloc(stat.size + 1);
                const length = Number(symbols.readlinkat(handle, name(leaf), buffer, buffer.length));
                if (length < 0) throw failed('Read lifecycle link', path);
                const after = fstatSync(file);
                if (
                    length !== stat.size ||
                    after.nlink !== 1 ||
                    stat.ctimeMs !== after.ctimeMs ||
                    stat.mtimeMs !== after.mtimeMs
                )
                    throw new Error(`Lifecycle link changed while being read: ${path}`);
                return { bytes: buffer.subarray(0, length), mode: stat.mode & 0o7777, isLink: true };
            }
            if (!stat.isFile() || stat.nlink !== 1)
                throw new Error(`Lifecycle destination is not a private regular file: ${path}`);
            const bytes = readFileSync(file);
            const after = fstatSync(file);
            if (stat.size !== bytes.length || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs) {
                throw new Error(`Lifecycle destination changed while being read: ${path}`);
            }
            return { bytes, mode: stat.mode & 0o7777 };
        } finally {
            closeSync(file);
        }
    };
    const equal = (a: FileSnapshot | undefined, b: FileSnapshot | undefined): boolean =>
        a === undefined
            ? b === undefined
            : b !== undefined && a.mode === b.mode && a.isLink === b.isLink && a.bytes.equals(b.bytes);
    const readEntry = (path: string, allowLink: boolean): FileSnapshot | undefined => {
        let opened: { handle: number; leaf: string };
        try {
            opened = parent(path, false);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        }
        try {
            return snapshotAt(opened.handle, opened.leaf, path, allowLink);
        } finally {
            closeSync(opened.handle);
        }
    };
    const validate = (path: string, value: FileSnapshot): string | undefined => {
        partsOf(path);
        let target: string | undefined;
        if (value.isLink) {
            target = value.bytes.toString('utf8');
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
            if (readEntry(destination, false) === undefined)
                throw new Error(`Lifecycle link target is missing: ${path}`);
            if (process.platform === 'linux' && value.mode !== 0o777)
                throw new Error(`Linux symbolic links require mode 0777: ${path}`);
        }
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
            const target = validate(path, value);
            const { handle, leaf } = parent(path, true);
            const temporary = `.gspot-${randomUUID()}.tmp`;
            let file = -1;
            let published = false;
            let staged = false;
            try {
                if (target !== undefined) {
                    if (symbols.symlinkat(name(target), handle, name(temporary)) < 0)
                        throw failed('Stage lifecycle link', path);
                    staged = true;
                    file = symbols.openat(handle, name(temporary), LINK_FLAGS, 0);
                    if (file < 0) throw failed('Open staged lifecycle link', path);
                    if (!fstatSync(file).isSymbolicLink()) throw new Error(`Staged lifecycle link changed: ${path}`);
                    if (process.platform === 'darwin') fchmodSync(file, value.mode);
                    fsyncSync(handle);
                } else {
                    file = symbols.openat(
                        handle,
                        name(temporary),
                        constants.O_WRONLY |
                            constants.O_CREAT |
                            constants.O_EXCL |
                            constants.O_NOFOLLOW |
                            CLOSE_ON_EXEC,
                        0o600,
                    );
                    if (file < 0) throw failed('Stage lifecycle file', path);
                    staged = true;
                    writeFileSync(file, value.bytes);
                    fchmodSync(file, value.mode);
                    fsyncSync(file);
                }
                if (!equal(snapshotAt(handle, leaf, path, expected?.isLink), expected))
                    throw new Error(`Lifecycle destination changed during the operation: ${path}`);
                if (symbols.renameat(handle, name(temporary), handle, name(leaf)) < 0)
                    throw failed('Publish lifecycle file', path);
                published = true;
                fsyncSync(handle);
            } finally {
                if (file >= 0) closeSync(file);
                if (!published && staged && symbols.unlinkat(handle, name(temporary), 0) < 0) {
                    const error = failed('Remove staged lifecycle file', path);
                    closeSync(handle);
                    throw error;
                }
                closeSync(handle);
            }
        },
        remove(path, expected) {
            const { handle, leaf } = parent(path, false);
            try {
                if (!equal(snapshotAt(handle, leaf, path, expected.isLink), expected))
                    throw new Error(`Lifecycle destination changed during removal: ${path}`);
                if (symbols.unlinkat(handle, name(leaf), 0) < 0) throw failed('Remove lifecycle file', path);
                fsyncSync(handle);
            } finally {
                closeSync(handle);
            }
        },
        mkdir(path, mode) {
            const { handle, leaf } = parent(path, true);
            try {
                if (symbols.mkdirat(handle, name(leaf), mode) < 0 && errno() !== 17)
                    throw failed('Create lifecycle directory', path);
                const directory = symbols.openat(handle, name(leaf), DIRECTORY_FLAGS, 0);
                if (directory < 0) throw failed('Open lifecycle directory', path);
                try {
                    fchmodSync(directory, mode);
                    fsyncSync(directory);
                } finally {
                    closeSync(directory);
                }
                fsyncSync(handle);
            } finally {
                closeSync(handle);
            }
        },
        lock(path) {
            if (closed) throw new Error('The lifecycle mutation boundary is closed.');
            // Lock the root inode as well, so replacing the lock pathname cannot admit a second writer.
            if (symbols.flock(rootHandle, LOCK_EXCLUSIVE | LOCK_NONBLOCKING) < 0) {
                throw new Error('Another lifecycle writer holds this repository. Retry after it finishes.');
            }
            const { handle, leaf } = parent(path, true);
            try {
                const file = symbols.openat(
                    handle,
                    name(leaf),
                    constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK | CLOSE_ON_EXEC,
                    0o600,
                );
                if (file < 0) throw failed('Open lifecycle lock', path);
                handles.add(file);
                const stat = fstatSync(file);
                if (!stat.isFile() || stat.nlink !== 1) throw new Error(`Unsafe lifecycle lock: ${path}`);
                if (symbols.flock(file, LOCK_EXCLUSIVE | LOCK_NONBLOCKING) < 0)
                    throw new Error('Another lifecycle writer holds this repository. Retry after it finishes.');
            } finally {
                closeSync(handle);
            }
        },
        close() {
            if (closed) return;
            closed = true;
            for (const handle of handles) closeSync(handle);
            closeSync(rootHandle);
            native.close();
        },
    };
}
