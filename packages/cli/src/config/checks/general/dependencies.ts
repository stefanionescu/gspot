// The JavaScript package clients, whose lockfiles a repository keeps one of.
export const BINARY_BUN_LOCKFILE = 'bun.lockb';

export const LOCKFILE_URL = /\b(?:https?|git\+https?|git\+ssh|git):\/\/[^\s"',)\]]+/gu;

export const NPM_DOWNLOAD = /"resolved"\s*:\s*"([^"]+)"/gu;
