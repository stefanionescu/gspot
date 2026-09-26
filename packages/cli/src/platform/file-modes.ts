// The permission bits gspot writes and compares. Every mode has a name here, so no octal literal appears elsewhere.

/** Read by everyone and written by nobody: the mode of a generated file. */
export const READ_ONLY_FILE = 0o444;

/** Read by everyone and written by the owner: the mode of an ordinary file. */
export const OWNER_WRITABLE_FILE = 0o644;

/** Read and run by everyone, written by the owner: the mode of a program. */
export const EXECUTABLE_FILE = 0o755;

/** Read and written by the owner alone: the mode of a private file. */
export const PRIVATE_FILE = 0o600;

/** Entered, read, and written by the owner alone: the mode of a private directory. */
export const PRIVATE_DIRECTORY = 0o700;

/** Read and written by everyone: the mode Windows reports for a writable file. */
export const WRITABLE_FILE = 0o666;

/** The permission bits of a mode, without the file type. */
export const PERMISSION_BITS = 0o777;

/** The permission bits together with the setuid, setgid, and sticky bits. */
export const MODE_BITS = 0o7777;

/** The execute bits of the owner, the group, and others. */
export const EXECUTE_BITS = 0o111;

/** The owner's write bit. */
export const OWNER_WRITE_BIT = 0o200;
