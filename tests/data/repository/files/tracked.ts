import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

/** Links that point outside the repository. */
export const OUTSIDE_LINK_CASES = [
    ['linked.ts', '../outside/secret.ts'],
    ['linked-directory', '../outside'],
] as const;

/** Folders outside Git and the repository root that gspot takes for each. */
export const ROOT_DISCOVERY_CASES = [
    {
        name: 'the nearest gspot.toml',
        files: { 'gspot.toml': buildSandboxSettings([], { rules: true }) },
        start: 'nested',
    },
    { name: 'the requested folder when no gspot.toml exists', files: {}, start: '' },
] as const;
