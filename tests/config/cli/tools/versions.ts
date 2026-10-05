/** Global allowlists require 8.25.0; the current pin and compatible releases stay usable. */
export const GITLEAKS_VERSIONS = [
    ['8.24.3', 'outdated'],
    ['8.25.0', 'ok'],
    ['8.30.1', 'ok'],
] as const;

/** Package identity and version fields require strings at the installed-file boundary. */
export const PACKAGE_METADATA_FAILURES = [
    { field: 'name', manifest: { name: false, version: '5.0.1' } },
    { field: 'version', manifest: { name: 'teller', version: false } },
] as const;
