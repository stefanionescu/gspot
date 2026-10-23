export const EXECUTABLE_LAYOUTS = {
    windows: {
        executableSuffixes: ['.cmd', '.exe', ''],
        environmentFolder: 'Scripts',
        environmentSuffix: '.exe',
    },
    posix: {
        executableSuffixes: [''],
        environmentFolder: 'bin',
        environmentSuffix: '',
    },
} as const;

export const DECLARATION_EXTENSIONS: readonly string[] = ['.d.ts', '.d.mts', '.d.cts'];
