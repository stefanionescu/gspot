import { STATE_DIRECTORY } from '#cli/config/platform/locations.ts';

export const PORTABLE_LINK_TARGET = /[\\:\p{Cc}]/u;

/** Time allowed for a new writer to publish its lock identity. */
export const LOCK_INITIALIZATION_MS = 1000;

/** Polling interval while a writer initializes its lock. */
export const LOCK_POLL_MS = 10;

export const LOCK_WAIT_BYTES = 4;

/** The lifecycle state folder never enters repository checks or generated plans. */
export const LIFECYCLE_PRIVATE_PATH = new RegExp(`(?:^|/)\\${STATE_DIRECTORY}(?:/|$)`, 'iu');

export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;

export const UNSAFE_PATH_END = /[. ]$/u;
