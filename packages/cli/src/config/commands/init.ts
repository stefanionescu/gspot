import { HOOKS_PATH } from '#cli/config/system/locations.ts';
import { SETTINGS_COMMANDS } from '#cli/config/settings/file.ts';
import { HOOKS_CHANGED_NOTE, INSTALL_NEEDED_NOTE } from '#cli/config/apply.ts';
import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';

export const COLUMN_GAP = 2;

export const CONFIGURATION_WIDTH = 16;

export const REASON_WIDTH = 12;

/** The plan row of the hooks folder. */
export const HOOKS_ROW = {
    path: HOOKS_PATH,
    note: 'gspot install points core.hooksPath here; a repository that already runs hooks gets the lines to add instead',
} as const;

export const DETECTION_LABEL_WIDTH = 20;

export const DETECTION_GAP_WIDTH = 3;

export const PREFACE_BODY = `# gspot settings for this repository. Change them with gspot ${new Intl.ListFormat('en', { type: 'conjunction' }).format(SETTINGS_COMMANDS)}.\n\n`;

/** The shared attributes row in every initialization plan. */
export const ATTRIBUTES_ROW = {
    path: '.gitattributes',
    note: 'managed generated-file classification and LF line endings',
} as const;

export const PRETTIER_DEFAULTS = { tabWidth: 2, printWidth: 80, singleQuote: false } as const;

export const EDITORCONFIG_FILE = '.editorconfig';

/** Instructions for the CI files shown in the initialization plan. */
export const CI_FILE_NOTES = {
    [GITHUB_WORKFLOW]: 'check workflow',
    [GITLAB_WORKFLOW]: `add include: [{ local: ${GITLAB_WORKFLOW} }] to .gitlab-ci.yml`,
} as const;

export const REMOTE_URL_SCHEME = /^(?:https?|ssh):\/\//u;
export const REMOTE_URL_USER = /^[^@/]+@/u;

export const EDITORCONFIG_NUMBER = /^\d+$/u;
export const PRETTIER_JSON_FILES = ['.prettierrc', '.prettierrc.json'] as const;

export const EDITORCONFIG_COMMENT = /^\s*[#;]/u;

/** The init answers before a template gives its choices. */
export const INIT_TEMPLATE_DEFAULTS = {
    hooks: { enabled: true },
    rules: { enabled: true },
    ci: undefined,
} as const;

export const EDITORCONFIG_SECTION = /^\s*\[(.+)\]\s*$/u;

export const INIT_INSTALL_NOTES: ReadonlySet<string> = new Set([HOOKS_CHANGED_NOTE, INSTALL_NEEDED_NOTE]);

export const BUNDLER_PACKAGES: ReadonlySet<string> = new Set([
    'esbuild',
    'vite',
    'webpack',
    'rollup',
    'rolldown',
    '@rspack/core',
]);

export const IMPORT_STYLE_SETTING = 'tools.eslint.import_extension';

export const COUNT = /^\d+$/u;

/** The settings files where Ruff keeps its quote style, in the order Ruff reads them. */
export const RUFF_SETTINGS_FILES = ['.ruff.toml', 'ruff.toml', 'pyproject.toml'] as const;

export const PYTHON_FILES = ['**/*.py'] as const;
export const PYTHON_EXTENSION = '.py';

export const ESLINT_DIRECTIVE = /eslint-(?:disable|enable)(?:-next-line|-line)?(?<rules>[^\n]*)/gu;

export const DIRECTIVE_TAIL = /--|\*\//u;

export const CODE_FILE_TAGS: ReadonlySet<string> = new Set(['javascript', 'typescript']);
