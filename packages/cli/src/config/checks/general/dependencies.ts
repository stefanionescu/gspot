// The JavaScript package clients, whose lockfiles a repository keeps one of.
export const JAVASCRIPT_CLIENTS = new Set(['bun', 'npm', 'pnpm', 'yarn']);

export const BUNFIG = 'bunfig.toml';

export const LOCKFILE_URL = /\b(?:https?|git\+https?|git\+ssh|git):\/\/[^\s"',)\]]+/gu;

export const NPM_DOWNLOAD = /"resolved"\s*:\s*"([^"]+)"/gu;

export const STALE_LOCKFILE_DIAGNOSTICS: Record<string, RegExp> = {
    bun: /lockfile had changes, but lockfile is frozen/u,
    npm: /can only install packages when your package\.json and package-lock\.json or npm-shrinkwrap\.json are in sync/u,
    pnpm: /ERR_PNPM_(?:OUTDATED_LOCKFILE|FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE)/u,
    uv: /lockfile[\s\S]*needs to be updated/u,
    yarn: /Your lockfile needs to be updated|YN0028|lockfile would have been modified/u,
};

export const NPM_MANIFEST = 'package.json';

/** Diagnostic lines retained from a package manager's frozen installation. */
export const LOCKFILE_DIAGNOSTIC_LINES = 3;

export const NEXT_VERSION_PAIRS: [string, string][] = [
    ['next', 'eslint-config-next'],
    ['next', '@next/eslint-plugin-next'],
];

export const REACT_VERSION_PAIRS: [string, string][] = [['react', 'react-dom']];
