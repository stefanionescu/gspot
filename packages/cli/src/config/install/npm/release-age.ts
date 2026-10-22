export const SECONDS_PER_DAY = 86_400;

/** The Bun and pnpm settings files that set the minimum release age while gspot installs its own tools. */
export const RELEASE_AGE_FILES = { bun: 'bunfig.toml', pnpm: 'pnpm-workspace.yaml' } as const;

/** The two gspot packages. gspot pins them itself, so no installer holds them back. */
export const GSPOT_PACKAGES = ['@gspothq/cli', '@gspothq/eslint-plugin'] as const;

export const MINUTES_PER_DAY = 1440;
