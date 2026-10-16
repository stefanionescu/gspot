export const LOCKFILE_URL = /\b(?:https?|git\+https?|git\+ssh|git):\/\/[^\s"',)\]]+/gu;

export const NPM_DOWNLOAD = /"resolved"\s*:\s*"([^"]+)"/gu;

/** The oldest version of each package manager that holds back new releases, and the key it reads the hold from. */
export const HOLD_VERSIONS = {
    npm: { version: '11.17.0', key: 'min-release-age' },
    pnpm: { version: '10.16.0', key: 'minimumReleaseAge' },
    yarn: { version: '4.10.0', key: 'npmMinimalAgeGate' },
    bun: { version: '1.3.0', key: 'minimumReleaseAge' },
} as const;

/** The package.json field that names the package manager. */
export const PACKAGE_MANAGER_FIELD = '"packageManager"';
