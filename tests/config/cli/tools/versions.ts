/** Package identity and version fields require strings at the installed-file boundary. */
export const PACKAGE_METADATA_FAILURES = [
    { field: 'name', manifest: { name: false, version: '5.0.1' } },
    { field: 'version', manifest: { name: 'teller', version: false } },
] as const;
