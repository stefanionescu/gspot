export const TRIVY_FINDINGS_EXIT_CODE = 10;

export const TRIVY_IMAGE_COMMAND = [
    'trivy',
    'image',
    '--quiet',
    '--format',
    'json',
    '--scanners',
    'vuln,secret',
    '--exit-code',
    String(TRIVY_FINDINGS_EXIT_CODE),
    '--config',
] as const;

export const TRIVY_CONFIG_FILE = 'trivy';

export const TRIVY_SCHEMA_VERSION = 2;
