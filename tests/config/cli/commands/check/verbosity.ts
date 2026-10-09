/** Quiet wins in either flag order; normal and verbose retain their distinct reports. */
export const VERBOSITY_CASES = [
    { name: 'normal output', flags: [], verbosity: 'normal' },
    { name: 'quiet output', flags: ['--quiet'], verbosity: 'quiet' },
    { name: 'verbose output', flags: ['--verbose'], verbosity: 'verbose' },
    { name: 'quiet before verbose', flags: ['--quiet', '--verbose'], verbosity: 'quiet' },
    { name: 'verbose before quiet', flags: ['--verbose', '--quiet'], verbosity: 'quiet' },
] as const;

/** The output sandbox exercises only its declared failure and successful neighbor. */
export const VERBOSITY_ARGS = ['check', '--only', 'example/findings', 'example/passing', '--base', 'HEAD'];
