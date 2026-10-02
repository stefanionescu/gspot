// The literal values platform/root reads: names, patterns, limits, and tables.

/** Read and written by the owner alone: the mode of a private file. */
export const PRIVATE_FILE = 0o600;

/** The permission bits together with the setuid, setgid, and sticky bits. */
export const MODE_BITS = 0o7777;

export const PORTABLE_LINK_TARGET = /[\\:\p{Cc}]/u;
