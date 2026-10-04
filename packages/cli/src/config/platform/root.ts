/** Read and written by the owner alone: the mode of a private file. */
export const PRIVATE_FILE = 0o600;

/** The permission bits together with the setuid, setgid, and sticky bits. */
export const MODE_BITS = 0o7777;

export const PORTABLE_LINK_TARGET = /[\\:\p{Cc}]/u;

/** Time allowed for a new writer to publish its lock identity. */
export const LOCK_INITIALIZATION_MS = 1000;

/** Polling interval while a writer initializes its lock. */
export const LOCK_POLL_MS = 10;

export const LOCK_WAIT_BYTES = 4;

/** The lifecycle state folder never enters repository checks or generated plans. */
export const LIFECYCLE_PRIVATE_PATH = /(?:^|\/)\.gspot\/state(?:\/|$)/iu;

/** Read by everyone and written by nobody: the mode of a generated file. */
export const READ_ONLY_FILE = 0o444;

/** Read and written by everyone: the mode Windows reports for a writable file. */
export const WRITABLE_FILE = 0o666;

/** The owner's write bit. */
export const OWNER_WRITE_BIT = 0o200;

export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;

export const UNSAFE_PATH_END = /[. ]$/u;

/** Read by everyone and written by the owner: the mode of an ordinary file. */
export const OWNER_WRITABLE_FILE = 0o644;

/** Read and run by everyone, written by the owner: the mode of a program. */
export const EXECUTABLE_FILE = 0o755;

/** The permission bits of a mode, without the file type: also the mode Git records for a link. */
export const PERMISSION_BITS = 0o777;
