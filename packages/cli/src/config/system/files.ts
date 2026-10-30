export const OWNER_WRITE_BIT = 0o200;

export const WRITABLE_FILE = 0o666;

export const READ_ONLY_FILE = 0o444;

export const TEMPORARY_FILE_PREFIX = '.gspot-';

export const TEMPORARY_FILE_SUFFIX = '.tmp';

export const PARENT_SEGMENT = /(?:^|[/{,])\.\.(?=[/},]|$)/u;

export const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..']);

export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;

export const UNSAFE_PATH_END = /[. ]$/u;

export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

export const UNSAFE_PATH_MESSAGE =
    '{path} is not a safe repository-relative path. Choose a path inside the repository.';

export const MISSING_TRACKED_FILE_MESSAGE = '{path} is tracked but missing. Restore it or commit its deletion.';
