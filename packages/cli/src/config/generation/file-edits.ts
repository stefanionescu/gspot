import { MINUTES_PER_DAY, SECONDS_PER_DAY } from '#cli/config/units.ts';

export const BUNFIG_FILE = 'bunfig.toml';
export const SCANNER_KEY = ['install', 'security', 'scanner'] as const;
export const RELEASE_AGE_SETTING = 'dependencies.min_release_age_days';
export const SCANNER_SETTING = 'dependencies.bun_scanner';
export const DEPENDENCIES_CONFIGURATION = 'dependencies';

/** The units that installers read a release hold in. */
export const HOLD_UNITS = ['seconds', 'minutes', 'days', 'uv-duration', 'mise-duration'] as const;

/** How many seconds or minutes make one day, for the installers that read a hold as a number. */
export const HOLD_FACTORS = { seconds: SECONDS_PER_DAY, minutes: MINUTES_PER_DAY } as const;

/** A whole number of days, as npm reads its hold. */
export const DAY_COUNT = /^\d+$/u;

/** A day or week count, as uv and mise write a hold, for example `7 days`, `1w`, or `14d`. */
export const HOLD_DURATION = /^(?<count>\d+)\s*(?<unit>d|days?|w|weeks?)$/u;

/** The two gspot packages. gspot pins them itself, so no installer holds them back. */
export const GSPOT_PACKAGES = ['@gspothq/cli', '@gspothq/eslint-plugin'] as const;

/**
 * Where each installer reads its release hold. `files` shows that a scope uses the installer; Yarn 1 has no hold, so
 * only a Yarn 2 or newer lockfile counts.
 */
export const RELEASE_HOLDS = [
    {
        files: ['bun.lock', 'bun.lockb'],
        target: 'bunfig.toml',
        age: ['install', 'minimumReleaseAge'],
        unit: 'seconds',
        excludes: ['install', 'minimumReleaseAgeExcludes'],
        excluded: GSPOT_PACKAGES,
    },
    {
        files: ['package-lock.json', 'npm-shrinkwrap.json'],
        target: '.npmrc',
        age: ['min-release-age'],
        unit: 'days',
        excludes: ['min-release-age-exclude'],
        excluded: GSPOT_PACKAGES,
    },
    {
        files: ['pnpm-lock.yaml'],
        target: 'pnpm-workspace.yaml',
        age: ['minimumReleaseAge'],
        unit: 'minutes',
        excludes: ['minimumReleaseAgeExclude'],
        excluded: GSPOT_PACKAGES,
    },
    {
        files: ['yarn.lock'],
        berry: true,
        target: '.yarnrc.yml',
        age: ['npmMinimalAgeGate'],
        unit: 'minutes',
        excludes: ['npmPreapprovedPackages'],
        excluded: GSPOT_PACKAGES,
    },
    { files: ['uv.lock'], target: 'pyproject.toml', age: ['tool', 'uv', 'exclude-newer'], unit: 'uv-duration' },
    {
        files: ['mise.toml'],
        target: 'mise.toml',
        age: ['settings', 'minimum_release_age'],
        unit: 'mise-duration',
        excludes: ['settings', 'minimum_release_age_excludes'],
        excluded: ['npm:@gspothq/cli'],
    },
] as const;

/** Text that only a Yarn 2 or newer lockfile holds. */
export const YARN_BERRY_LOCKFILE_MARK = '__metadata:';

/** The pnpm flag that stops pnpm from reading pnpm-workspace.yaml, where the tool project hold sits. */
export const PNPM_IGNORE_WORKSPACE = '--ignore-workspace';

/** The Bun and pnpm settings files that hold back new releases while gspot installs its own tools. */
export const TOOL_HOLD_FILES = { bun: 'bunfig.toml', pnpm: 'pnpm-workspace.yaml' } as const;
