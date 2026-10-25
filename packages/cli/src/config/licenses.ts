export const PIP_LICENSES_COMMAND = ['pip-licenses', '--format=json', '--from=all', '--python'] as const;

export const LICENSE_CHECKER_COMMAND = [
    'license-checker-rseidelsohn',
    '--json',
    '--excludePrivatePackages',
    '--start',
] as const;
