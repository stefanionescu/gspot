/** Runtime guidance keeps Node assumptions out of React Native and Expo applications. */
export const RUNTIME_RULE_CASES = [
    { runtime: 'deno', dependency: undefined, hasNode: false },
    { runtime: 'node', dependency: undefined, hasNode: true },
    { runtime: 'node', dependency: 'react-native', hasNode: false },
    { runtime: 'node', dependency: 'expo', hasNode: false },
] as const;

export const DRIZZLE_DRIVERS = [
    { driver: 'pg', postgres: true },
    { driver: 'mysql2', postgres: false },
] as const;

export const RULE_CONFIGURATIONS = ['typescript', 'css', 'vitest', 'swift', 'bash', 'drizzle', 'openapi'] as const;

export const DOC_EXAMPLE_PATHS = ['README.md', 'packages/cli/README.md', 'docs/src/content/docs'] as const;

export const NPM_BADGE_PATH = 'docs/assets/readme/badges/npm.svg';
