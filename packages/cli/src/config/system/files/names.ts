export const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..']);

export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;

export const UNSAFE_PATH_END = /[. ]$/u;

// Names and patterns of confined file access.
export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
