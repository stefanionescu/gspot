export const BUNFIG_FILE = 'bunfig.toml';
export const SCANNER_KEY = ['install', 'security', 'scanner'] as const;

/** The two gspot packages. gspot pins them itself, so no installer holds them back. */
export const GSPOT_PACKAGES = ['@gspothq/cli', '@gspothq/eslint-plugin'] as const;

/** The Bun and pnpm settings files that hold back new releases while gspot installs its own tools. */
export const TOOL_HOLD_FILES = { bun: 'bunfig.toml', pnpm: 'pnpm-workspace.yaml' } as const;
