export const GITLINK_MODE = '160000';

export const SYMLINK_MODE = '120000';

/** The mode of an ordinary file: everyone reads it, and only the owner writes it. */
export const OWNER_WRITABLE_FILE = 0o644;

/** The mode of a program: everyone reads and runs it, and only the owner writes it. */
export const EXECUTABLE_FILE = 0o755;

/** The permission bits of a mode, without the file type. */
export const PERMISSION_BITS = 0o777;

export const GIT_FILE_MODES = {
    '100644': OWNER_WRITABLE_FILE,
    '100755': EXECUTABLE_FILE,
    [SYMLINK_MODE]: PERMISSION_BITS,
} as const;

/** The mode of a private file: only the owner reads and writes it. */
export const PRIVATE_FILE = 0o600;

/** The permission bits together with the setuid, setgid, and sticky bits. */
export const MODE_BITS = 0o7777;

/** The mode of a private folder: only the owner enters, reads, and writes it. */
export const PRIVATE_FOLDER = 0o700;
