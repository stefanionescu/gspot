import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { COPIES_FOLDER } from '#cli/config/repository/git.ts';
import { GSPOT_FOLDER, TEMPORARY_FILE_PREFIX, TEMPORARY_FILE_SUFFIX } from '#cli/config/system.ts';

// config targets
export const CONFIG_SCOPES_FOLDER = 'scopes';
export const OVERRIDES_PLACEHOLDER = '{overrides_json}';
export const TARGET_MODULE_PLACEHOLDER = '{target_module}';
export const TARGET_PLACEHOLDER = /\{target_(?:json|module)\}/gu;
export const TS_EXTENSION = '.ts';

// file writes
export const INSTALLED_TOOL_FOLDERS = {
    npm: GSPOT_PATHS.nodeModules,
    python: GSPOT_PATHS.pythonEnvironment,
    vale: GSPOT_PATHS.valePackages,
} as const;
export const LEADING_PATH_SEGMENTS = 2;
export const TEMPORARY_FILE_NAME = new RegExp(
    `^\\${TEMPORARY_FILE_PREFIX}(?:(?<pid>[1-9]\\d{0,8})-)?[\\da-f-]{36}\\${TEMPORARY_FILE_SUFFIX}$`,
    'u',
);

// gitattributes
export const ATTRIBUTE_GLOB_CHARACTERS = /[\\*?[]/gu;
export const ATTRIBUTE_QUOTED_CHARACTERS = /[\s"]/u;
export const GIT_ATTRIBUTES_BLOCK = `* text=auto eol=lf
${GSPOT_FOLDER}/** linguist-generated
${GSPOT_PATHS.hooks}/** linguist-generated=false`;

// ignored paths
export const BUILD_OUTPUT_FOLDERS: ReadonlySet<string> = new Set(['.build', 'DerivedData']);
export const BUILD_OUTPUT_PATTERNS = ['dist/', 'build/', 'coverage/'] as const;
export const GSPOT_FOLDER_PATTERNS = [`${GSPOT_FOLDER}/**`, `${COPIES_FOLDER}/**`] as const;

// stale files
export const DIFF_CONTEXT_LINES = 3;
export const ON_DISK_LABEL = 'on disk';

// write notes
export const CHANGE_LABEL_WIDTH = 9;
export const HOOKS_CHANGED_NOTE = 'Git hooks changed. Run gspot install.';
export const STALE_LOCKFILE_NOTE =
    'The tool lockfile is absent or stale. Run gspot install; until then gspot/generated-files fails on it.';
export const TOOLS_CHANGED_NOTE =
    'The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.';
export const TOOL_PROJECT_FILES: readonly string[] = [
    GSPOT_PATHS.npmProject,
    GSPOT_PATHS.pythonProject,
    GSPOT_PATHS.miseProject,
];
