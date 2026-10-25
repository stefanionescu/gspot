export const OUTSIDE_LINK_CASES = [
    ['linked.ts', '../outside/secret.ts'],
    ['linked-directory', '../outside'],
] as const;

export const ROOT_DISCOVERY_CASES = [
    {
        name: 'the nearest gspot.toml',
        files: { 'gspot.toml': 'configurations = []\n' },
        start: 'nested',
    },
    { name: 'the requested folder when no gspot.toml exists', files: {}, start: '' },
] as const;
