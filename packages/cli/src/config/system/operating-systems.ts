/** Operating-system names and host install commands used by planning, validation, and installation. */
export const OPERATING_SYSTEMS = [
    { nodeName: 'darwin', name: 'macos', label: 'macOS', installers: [{ installer: 'brew', command: 'brew install' }] },
    {
        nodeName: 'linux',
        name: 'linux',
        label: 'Linux',
        installers: [{ installer: 'apt', command: 'sudo apt install' }],
    },
    {
        nodeName: 'win32',
        name: 'windows',
        label: 'Windows',
        installers: [
            { installer: 'winget', command: 'winget install' },
            { installer: 'scoop', command: 'scoop install' },
        ],
    },
] as const;
