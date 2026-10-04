/** The package-lock format that carries both the packages table and the old dependencies tree. */
export const HYBRID_LOCKFILE = 2;

/** The package-lock format that carries the packages table alone. */
export const PACKAGES_LOCKFILE = 3;

export const LOCKFILE_VERSIONS = [HYBRID_LOCKFILE, PACKAGES_LOCKFILE] as const;

export const LOCKS = { npm: 'package-lock.json', bun: 'bun.lock', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock' } as const;
