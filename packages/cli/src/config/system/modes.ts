// File modes for repository files and temporary folders.

export const MODE_RADIX = 8;

/** The mode of a private file: only the owner reads and writes it. */
export const PRIVATE_FILE = 0o600;

/** The permission bits together with the setuid, setgid, and sticky bits. */
export const MODE_BITS = 0o7777;

/** The mode that Windows reports for a read-only file: everyone reads it, and nobody writes it. */
export const READ_ONLY_FILE = 0o444;

/** The mode that Windows reports for a writable file: everyone reads and writes it. */
export const WRITABLE_FILE = 0o666;

export const OWNER_WRITE_BIT = 0o200;

/** The mode of an ordinary file: everyone reads it, and only the owner writes it. */
export const OWNER_WRITABLE_FILE = 0o644;

/** The mode of a program: everyone reads and runs it, and only the owner writes it. */
export const EXECUTABLE_FILE = 0o755;

/** The permission bits of a mode, without the file type. */
export const PERMISSION_BITS = 0o777;

/** The mode of a private folder: only the owner enters, reads, and writes it. */
export const PRIVATE_FOLDER = 0o700;

export const OWNER_WRITABLE_FOLDER = 0o755;

export const EXECUTABLE_BITS = 0o111;
