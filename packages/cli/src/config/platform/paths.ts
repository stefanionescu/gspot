/** Executable lookup and Python environment layouts supported by each host family. */
export const EXECUTABLE_LAYOUTS = {
    windows: {
        executableSuffixes: ['.cmd', '.exe', ''],
        environmentDirectory: 'Scripts',
        environmentSuffix: '.exe',
    },
    posix: {
        executableSuffixes: [''],
        environmentDirectory: 'bin',
        environmentSuffix: '',
    },
} as const;
