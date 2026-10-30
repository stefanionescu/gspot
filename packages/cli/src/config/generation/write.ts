import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';

export const MANAGED_KEYS_NOTE =
    'Keys that gspot no longer manages stay in your files. Review shared config files after removing a configuration.';

export const TOOLS_CHANGED_NOTE =
    'The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.';

export const STALE_LOCKFILE_NOTE =
    'The tool lockfile is missing or stale. Run gspot install; until then gspot/generated-files fails on it.';

export const HOOKS_CHANGED_NOTE = 'Git hooks changed. Run gspot install.';

export const GENERATED_FILE_NOUN = 'generated file';

export const CHANGE_LABEL_WIDTH = 9;

export const TOOL_PROJECT_FILES: readonly string[] = [
    GSPOT_PATHS.npmProject,
    GSPOT_PATHS.pythonProject,
    GSPOT_PATHS.miseProject,
];
