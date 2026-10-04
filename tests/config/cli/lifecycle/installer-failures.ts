import { MISE_MIN_VERSION } from '#cli/config/tools/mise.ts';

/** Each unavailable runner state names the failing command and the expected repair instruction. */
export const INSTALLATION_FAILURES = [
    {
        availability: 'missing',
        exitCode: 127,
        failsOn: 'every call',
        version: MISE_MIN_VERSION,
        retryMessage: 'Install mise',
    },
    { availability: 'outdated', exitCode: 0, failsOn: 'every call', version: '2020.1.1', retryMessage: 'Install mise' },
    {
        availability: 'download-failed',
        exitCode: 1,
        failsOn: 'install',
        version: MISE_MIN_VERSION,
        retryMessage: 'installation command mise install failed',
    },
] as const;
