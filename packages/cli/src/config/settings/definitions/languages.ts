import type { SettingDefinition } from '#cli/types/settings/definitions.ts';

export const LANGUAGE_DEFINITIONS = {
    'javascript.script_files': {
        configurations: ['javascript'],
        description: 'Script files, which may print to the console and call process.exit.',
        default: ['scripts/**', '**/*.config.{js,mjs,cjs,ts}'] as ['scripts/**', '**/*.config.{js,mjs,cjs,ts}'],
    },
    'javascript.import_boundaries': {
        configurations: ['javascript'],
        description:
            'Folders, relative to the repository root, that a relative import may not leave, such as src/features/*. An import of a file outside them takes the alias, and eslint --fix writes it.',
        default: [] as [],
    },
    'javascript.externals': {
        configurations: ['javascript'],
        description:
            'Import specifiers that the runtime provides, such as ../../scripts/app.js in a host application. Globs match several.',
        default: [] as [],
    },
    'python.externals': {
        configurations: ['python'],
        description:
            'Modules that the host application provides at run time, such as folder_paths. A name covers its submodules.',
        default: [] as [],
    },
    'python.extra_paths': {
        configurations: ['python'],
        description: 'Folders, relative to the scope, where basedpyright also looks for imports.',
        default: [] as [],
    },
} as const satisfies Record<string, SettingDefinition>;
