/** Declared host acquisition guidance; unsupported installers stay a manual prerequisite. */
export const XML_INSTALL_HINTS = [
    { platform: 'darwin', hint: 'brew install libxml2' },
    { platform: 'linux', hint: 'sudo apt install libxml2-utils' },
    { platform: 'win32', hint: 'install xmllint' },
] as const;
