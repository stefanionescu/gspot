/** Descriptor separator in Yarn lockfile keys. */
export const YARN_DESCRIPTOR_SEPARATOR = /,\s*/u;

export const INTEGRITY = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u;

export const LOCKFILE_WORKSPACE_KEYS = { npm: 'packages', bun: 'workspaces', pnpm: 'importers' } as const;

export const HTTP_URL = /^https?:\/\//u;
