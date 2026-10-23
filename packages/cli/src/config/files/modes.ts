export const GITLINK_MODE = '160000';

export const SYMLINK_MODE = '120000';

export const OWNER_WRITABLE_FILE = 0o644;

export const EXECUTABLE_FILE = 0o755;

export const PERMISSION_BITS = 0o777;

export const GIT_FILE_MODES = {
    '100644': OWNER_WRITABLE_FILE,
    '100755': EXECUTABLE_FILE,
    [SYMLINK_MODE]: PERMISSION_BITS,
} as const;

export const PRIVATE_FILE = 0o600;

export const MODE_BITS = 0o7777;

export const PRIVATE_FOLDER = 0o700;
