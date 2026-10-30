import { GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';

import {
    GITHUB_WORKFLOW,
    GITLAB_WORKFLOW,
    HOOKS_CHANGED_NOTE,
    TOOLS_CHANGED_NOTE,
} from '#cli/config/generation/generation.ts';

export const VERIFY_FLAG = '--verify';

export const NAME_ONLY_FLAG = '--name-only';

export const READ_COMMITTED_MESSAGE = 'Cannot read committed config files. Restore HEAD and run gspot init again.';

export const PRETTIER_SCRIPT_NOTE =
    '; gspot cannot read this Prettier config, so set format.indent_width and format.print_width by hand';

export const DETECTED_SETTINGS = [
    'site.build_command',
    'swift.xcode_destination',
    'cloudflare.types_file',
    'cloudflare.types_interface',
] as const;

export const DETECTION_LABEL_WIDTH = 20;

export const DETECTION_GAP_WIDTH = 3;

export const UNCHECKED_FILES_SHOWN = 5;

export const ANY_FILE_GLOB = /^\*+(?:\/\*+)*$/u;

export const PROJECT_FILE_NOTE = 'a project file in each';

export const OWN_HOOKS = 'your own';

export const HOOKS_LABEL = 'existing hooks';

export const CI_LABEL = 'existing ci';

export const AGENT_FILES_LABEL = 'agent files';

export const LINT_FOLDERS_LABEL = 'lint folders';

export const LINT_SETUP_MESSAGE = 'old lint setup; gspot replaces it';

export const NOT_CHECKED_LABEL = 'not checked';

export const REPLACES_LABEL = 'gspot replaces';

export const LEAVES_LABEL = 'gspot leaves';

export const NO_GIT_MESSAGE =
    'no git repository: the hooks and the configurations that read git stay out until git init runs';

export const RUFF_SETTINGS_FILES = ['.ruff.toml', 'ruff.toml', 'pyproject.toml'] as const;

export const EDITORCONFIG_FILE = '.editorconfig';

export const EDITORCONFIG_COMMENT = /^\s*[#;]/u;

export const EDITORCONFIG_SECTION = /^\s*\[(.+)\]\s*$/u;

export const PRETTIER_FILE_FORMATS: Readonly<Record<string, 'yaml' | 'json' | 'toml'>> = {
    '.prettierrc': 'yaml',
    '.prettierrc.yml': 'yaml',
    '.prettierrc.yaml': 'yaml',
    '.prettierrc.json': 'json',
    '.prettierrc.json5': 'yaml',
    '.prettierrc.toml': 'toml',
};

export const PRETTIER_DEFAULTS = { tabWidth: 2, printWidth: 80, singleQuote: false } as const;

export const BUNDLER_PACKAGES: ReadonlySet<string> = new Set([
    'esbuild',
    'vite',
    'webpack',
    'rollup',
    'rolldown',
    '@rspack/core',
]);

export const IMPORT_EXTENSION_SETTING = 'tools.eslint.import_extension';

export const INIT_INSTALL_NOTES: ReadonlySet<string> = new Set([HOOKS_CHANGED_NOTE, TOOLS_CHANGED_NOTE]);

export const NO_TERMINAL_MESSAGE = 'There is no terminal to ask in. Pass --yes to accept the plan.';

export const CANCELED_MESSAGE = 'Canceled. Nothing was written.';

export const CONFIRM_PROMPT = 'Continue? [Y/n] ';

export const ACCEPT_ANSWER = /^(?:y|yes)?$/iu;

export const WROTE_PLAN_MESSAGE = 'Wrote the plan above.';

export const SETTINGS_EXIST_MESSAGE =
    'This repository already has a gspot.toml. Run gspot doctor to inspect its setup; it prints the gspot add line for newly detected configurations.';

export const NOTHING_WRITTEN_MESSAGE = 'Nothing written.\n';

export const NEXT_INSTALL_MESSAGE = 'Next: run gspot install to install the tools and turn on the Git hooks.';

export const CONFIGURATIONS_OPTION = '--configurations <names...>';

export const NO_CONFIGURATIONS_FLAG = '--no-configurations';

export const LEVEL_OPTION = '--level <level>';

export const YES_FLAG = '--yes';

export const JSON_NEEDS_YES_MESSAGE = '--json needs --yes, because gspot cannot ask while it prints JSON.';

export const COLUMN_GAP = 2;

export const CONFIGURATION_WIDTH = 16;

export const ORIGIN_WIDTH = 12;

export const ATTRIBUTES_ROW = {
    path: GITATTRIBUTES_FILE,
    note: 'marks the generated files and keeps LF line endings',
} as const;

export const CI_FILE_NOTES = {
    [GITHUB_WORKFLOW]: 'check workflow',
    [GITLAB_WORKFLOW]: `add include: [{ local: ${GITLAB_WORKFLOW} }] to .gitlab-ci.yml`,
} as const;

export const GSPOT_FOLDER_NOTE = 'generated files';

export const UNREAD_SUBMODULE_MESSAGE = 'submodule; init does not read it';

export const LINT_FOLDER_MESSAGE = 'a folder of lint scripts; check remaining references before deleting it';

export const DELETED_RULES_NOTE =
    '(your own lint rules in them do not carry over; read them with git show HEAD:<path>)';

export const LINT_FOLDERS_HEADING = 'lint folders; delete when nothing calls them';

export const CHANGE_LATER_MESSAGE =
    'Change the hooks and rule files later with gspot set hooks.enabled or rules.enabled.';

export const TOOL_PIN_NOUN = 'tool pin';

export const NPM_PIN_NOUN = 'pinned npm tool';

export const PYTHON_PIN_NOUN = 'pinned Python tool';

export const CI_FILE_NOTE = 'existing CI file';

export const CI_OFF_MESSAGE =
    'CI is off. To turn it on, run gspot set ci.enabled true; for GitLab, also run gspot set ci.provider gitlab.';

export const PRETTIER_SCRIPT_FILE = /\.[cm]?[jt]s$/u;

export const XCODE_DESTINATIONS = new Map<string | undefined, string>([
    ['iphoneos', 'generic/platform=iOS Simulator'],
    ['iphonesimulator', 'generic/platform=iOS Simulator'],
    ['macosx', 'platform=macOS'],
    ['watchos', 'generic/platform=watchOS Simulator'],
    ['watchsimulator', 'generic/platform=watchOS Simulator'],
    ['xros', 'generic/platform=visionOS Simulator'],
    ['xrsimulator', 'generic/platform=visionOS Simulator'],
]);

export const PREFACE_BODY = '# Change these settings with gspot set, unset, add, remove, ignore, or unignore.';

export const LEADING_COMMENTS = /^(?:#[^\n]*\n|[ \t]*\n)*/u;

export const LEFT_OUT_NOTES = {
    ci: 'CI stays off; run gspot set ci.enabled true',
    paths: 'names paths of that repository',
    code: 'runs code',
    repository: 'describes that repository',
    check: 'ignores a command check',
} as const;

export const LOCAL_RECORDS = { scope: 'path', import_rule: 'name', command_check: 'id' } as const;

export const FROM_CONFLICT_MESSAGE = 'takes the configurations of its file. Leave out';

export const FROM_OPTION = '--from <file>';
