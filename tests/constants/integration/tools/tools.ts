// The literal values integration/tools/tools reads: names, patterns, limits, and tables.

export const HELP_TIMEOUT_MS = 30_000;
export const LOCKS = { npm: 'package-lock.json', bun: 'bun.lock', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock' } as const;
