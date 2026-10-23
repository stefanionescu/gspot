import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

export const OUTSIDE_LINK_CASES = [
    ['linked.ts', '../outside/secret.ts'],
    ['linked-directory', '../outside'],
] as const;

export const ROOT_DISCOVERY_CASES = [
    {
        name: 'the nearest gspot.toml',
        files: { 'gspot.toml': buildSandboxSettings([], { rules: true }) },
        start: 'nested',
    },
    { name: 'the requested folder when no gspot.toml exists', files: {}, start: '' },
] as const;
