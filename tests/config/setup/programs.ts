import { SWIFT_PACKAGE_HEADER } from '#tests/config/setup/languages.ts';

export const ROOT_LABEL = 'the root';

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

export const WAIT_INTERVAL_MILLISECONDS = 60_000;

export const SIGNAL_MARKER_OPTION = '--signal-marker';

export const POLL_INTERVAL_MILLISECONDS = 10;

export const SWIFT_PACKAGE = `${SWIFT_PACKAGE_HEADER}let package = Package(name: "Example", targets: [.target(name: "Example", path: ".")])
`;

export const PREVIOUS_BYTES = 'previous bytes\n';
