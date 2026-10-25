export const GSPOT_ENVIRONMENT = { NO_COLOR: '1', CI: '1' } as const;

export const TEST_TIMEOUT_MILLISECONDS = 900_000;

export const UNIT_TEST_TIMEOUT_MILLISECONDS = 60_000;

export const PACKED_PACKAGES_FILE = 'packages.json';

export const OFFLINE_ENVIRONMENT = {
    HTTP_PROXY: 'http://127.0.0.1:1',
    HTTPS_PROXY: 'http://127.0.0.1:1',
    ALL_PROXY: 'http://127.0.0.1:1',
    NO_PROXY: '',
    http_proxy: undefined,
    https_proxy: undefined,
    all_proxy: undefined,
    no_proxy: undefined,
    MISE_OFFLINE: '1',
} as const;

export const MISE_LOCK_ENVIRONMENT = { MISE_GITHUB_ATTESTATIONS: 'false', MISE_SLSA: 'false' } as const;
