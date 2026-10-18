import { MINUTES_PER_DAY, SECONDS_PER_DAY } from '#cli/config/units.ts';

export const BUNFIG_FILE = 'bunfig.toml';
export const SCANNER_KEY = ['install', 'security', 'scanner'] as const;
export const RELEASE_AGE_SETTING = 'dependencies.min_release_age_days';
export const SCANNER_SETTING = 'dependencies.bun_scanner';
export const DEPENDENCIES_CONFIGURATION = 'dependencies';

/** The units that the tool installs in .gspot read a release hold in. */
export const HOLD_UNITS = ['seconds', 'minutes', 'uv-duration'] as const;

/** How many seconds or minutes make one day, for the installers that read a hold as a number. */
export const HOLD_FACTORS = { seconds: SECONDS_PER_DAY, minutes: MINUTES_PER_DAY } as const;

/** The two gspot packages. gspot pins them itself, so no installer holds them back. */
export const GSPOT_PACKAGES = ['@gspothq/cli', '@gspothq/eslint-plugin'] as const;

/** The lockfiles that show a scope installs with Bun. */
export const BUN_LOCKFILES = ['bun.lock', 'bun.lockb'] as const;

/** The pnpm flag that stops pnpm from reading pnpm-workspace.yaml, where the tool project hold sits. */
export const PNPM_IGNORE_WORKSPACE = '--ignore-workspace';

/** The Bun and pnpm settings files that hold back new releases while gspot installs its own tools. */
export const TOOL_HOLD_FILES = { bun: 'bunfig.toml', pnpm: 'pnpm-workspace.yaml' } as const;
