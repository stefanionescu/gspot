export const DUBIOUS_GIT_ENVIRONMENT = {
    GIT_TEST_ASSUME_DIFFERENT_OWNER: '1',
    LC_ALL: 'C',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'safe.directory',
    GIT_CONFIG_VALUE_0: '',
} as const;

export const ROOT_DISCOVERY_CASES = [
    {
        name: 'the nearest gspot.toml',
        files: { 'gspot.toml': 'configurations = []\n' },
        start: 'nested',
    },
    { name: 'the requested folder when no gspot.toml exists', files: {}, start: '' },
] as const;
