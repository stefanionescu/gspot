// Names and limits used by confined file access.
export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;

export const UNSAFE_PATH_END = /[. ]$/u;

export const RESERVED_SEGMENTS = ['', '.', '..'] as const;

export const LOCK_TOKEN_SEPARATOR = ':';

export const LOCK_RECOVERY_SUFFIX = '.reclaim';

export const TEMPORARY_FILE_PREFIX = '.gspot-';

export const TEMPORARY_FILE_SUFFIX = '.tmp';
