export const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..']);

export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;

export const UNSAFE_PATH_END = /[. ]$/u;

export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

export const UNSAFE_PATH_MESSAGE =
    '{path} is not a safe repository-relative path. Choose a path inside the repository.';
