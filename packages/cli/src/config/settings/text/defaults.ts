/** Settings whose default comes from project files, which the settings writer cannot read. */
export const DETECTED_SETTINGS = [
    'site.build_command',
    'swift.xcode_destination',
    'cloudflare.types_file',
    'cloudflare.types_interface',
] as const;
