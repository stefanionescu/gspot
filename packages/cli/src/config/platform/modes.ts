// File modes for repository entries and temporary folders.

/** Read and written by the owner alone: the mode of a private file. */
export const PRIVATE_FILE = 0o600;

/** The permission bits together with the setuid, setgid, and sticky bits. */
export const MODE_BITS = 0o7777;

/** Read by everyone and written by nobody: the mode of a generated file. */
export const READ_ONLY_FILE = 0o444;

/** Read and written by everyone: the mode Windows reports for a writable file. */
export const WRITABLE_FILE = 0o666;

/** The owner's write bit. */
export const OWNER_WRITE_BIT = 0o200;

/** Read by everyone and written by the owner: the mode of an ordinary file. */
export const OWNER_WRITABLE_FILE = 0o644;

/** Read and run by everyone, written by the owner: the mode of a program. */
export const EXECUTABLE_FILE = 0o755;

/** The permission bits of a mode, without the file type. */
export const PERMISSION_BITS = 0o777;

/** Entered, read, and written by the owner alone: the mode of a private directory. */
export const PRIVATE_DIRECTORY = 0o700;

export const DIRECTORY_MODE = 0o755;

export const EXECUTABLE_BITS = 0o111;
