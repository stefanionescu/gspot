// The JavaScript package clients, whose lockfiles a repository keeps one of.
export const BINARY_BUN_LOCKFILE = 'bun.lockb';

export const LOCKFILE_URL = /\b(?:https?|git\+https?|git\+ssh|git):\/\/[^\s"',)\]]+/gu;

export const NPM_DOWNLOAD = /"resolved"\s*:\s*"([^"]+)"/gu;

/** Diagnostic lines retained from a package manager's frozen installation. */
export const LOCKFILE_DIAGNOSTIC_LINES = 3;

export const YARN_SCRIPTS_OFF = { YARN_ENABLE_SCRIPTS: 'false' } as const;
