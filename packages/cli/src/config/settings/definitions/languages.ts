import type { SettingDefinition } from '#cli/types/settings/definitions.ts';

export const LANGUAGE_DEFINITIONS = {
    'javascript.script_files': {
        reason_when: 'adding',
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
        reason_when: 'adding',
        template: 'repository',
        configurations: ['javascript'],
        description:
            'Import specifiers that the runtime provides, such as ../../scripts/app.js in a host application. Globs match several.',
        default: [] as [],
    },
    'python.externals': {
        reason_when: 'adding',
        template: 'repository',
        configurations: ['python'],
        description:
            'Modules that the host application provides at run time, such as folder_paths. A name covers its submodules.',
        default: [] as [],
    },
    'python.import_folders': {
        configurations: ['python'],
        description:
            'Folders, relative to the scope, that Python imports resolve from, for basedpyright and the import rules check.',
        default: [] as [],
    },
} as const satisfies Record<string, SettingDefinition>;
