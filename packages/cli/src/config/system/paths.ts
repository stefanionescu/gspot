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

export const GLOB_EXCLUDE = '!';

export const FOLDER_CONTENTS = '/**';

export const DECLARATION_EXTENSIONS: readonly string[] = ['.d.ts', '.d.mts', '.d.cts'];

export const ANY_FOLDER_PREFIX = '**/';

export const DRIVE_LETTER = /^[a-z]:/iu;
export const PARENT_SEGMENT = /(?:^|[/{,])\.\.(?=[/},]|$)/u;

export const WHOLE_TREE_GLOBS = ['**', '**/*'] as const;
export const GLOB_SPECIAL_CHARACTERS = /[\\*?{}[\]()!+@,]/gu;

export const TRAILING_SLASH = /\/$/u;
