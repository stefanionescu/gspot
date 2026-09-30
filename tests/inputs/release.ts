// The literal values support/release reads: names, patterns, limits, and tables.

// A consumer installs every tool through the local registry, which fetches each package from npm the first time.
export const RELEASE_TIMEOUT_MS = 600_000;

export const OFFLINE_ENVIRONMENT = {
    HTTP_PROXY: 'http://127.0.0.1:1',
    HTTPS_PROXY: 'http://127.0.0.1:1',
    ALL_PROXY: 'http://127.0.0.1:1',
    NO_PROXY: '',
    http_proxy: undefined,
    https_proxy: undefined,
    all_proxy: undefined,
    no_proxy: undefined,
};
