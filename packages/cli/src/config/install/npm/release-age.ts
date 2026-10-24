export const SECONDS_PER_DAY = 86_400;

export const RELEASE_AGE_VERSIONS = {
    npm: '11.19.0',
    pnpm: '10.16.0',
    bun: '1.3.0',
    yarn: '4.10.0',
} as const;

export const RELEASE_AGE_FILES = { bun: 'bunfig.toml', pnpm: 'pnpm-workspace.yaml' } as const;

export const GSPOT_PACKAGES = ['@gspothq/cli', '@gspothq/eslint-plugin'] as const;

export const MINUTES_PER_DAY = 1440;
