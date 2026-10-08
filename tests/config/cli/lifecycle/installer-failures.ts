import { CLI_PINS } from '#cli/config/generation/pins.ts';

/** Each unavailable runner state names the failing command and the expected repair instruction. */
export const INSTALLATION_FAILURES = [
    {
        availability: 'missing',
        exitCode: 127,
        failsOn: 'every call',
        version: CLI_PINS.mise.version,
        retryMessage: 'Install mise',
    },
    { availability: 'outdated', exitCode: 0, failsOn: 'every call', version: '2020.1.1', retryMessage: 'Install mise' },
    {
        availability: 'download-failed',
        exitCode: 1,
        failsOn: 'install',
        version: CLI_PINS.mise.version,
        retryMessage: 'installation command mise install failed',
    },
] as const;
