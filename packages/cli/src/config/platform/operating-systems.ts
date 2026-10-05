/** Operating-system names and host acquisition commands used by planning, validation, and installation. */
export const OPERATING_SYSTEMS = [
    { node: 'darwin', name: 'macos', label: 'macOS', installers: [{ installer: 'brew', command: 'brew install' }] },
    { node: 'linux', name: 'linux', label: 'Linux', installers: [{ installer: 'apt', command: 'sudo apt install' }] },
    {
        node: 'win32',
        name: 'windows',
        label: 'Windows',
        installers: [
            { installer: 'winget', command: 'winget install' },
            { installer: 'scoop', command: 'scoop install' },
        ],
    },
] as const;
