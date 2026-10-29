export const GSPOT_ENVIRONMENT = { NO_COLOR: '1', CI: '1' } as const;

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

export const GIT_ISOLATION_ENVIRONMENT = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '',
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
} as const;
