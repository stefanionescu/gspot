import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { SWIFT_FILES } from '#cli/config/configurations/swift.ts';
import { GITATTRIBUTES_FILE } from '#cli/config/repository/files.ts';
import { SQL_FILES, PYTHON_FILES } from '#cli/config/configurations/python.ts';
import { GITHUB_WORKFLOW, GITLAB_WORKFLOW, HOOKS_CHANGED_NOTE, TOOLS_CHANGED_NOTE } from '#cli/config/generation.ts';

export const IGNORE_CHECK_MESSAGE = 'Run gspot ignore <check> --reason "<why>".';

export const UNCHANGED_SETTINGS_MESSAGE = 'No change: gspot.toml already says this.';

export const REPAIRED_FILES_MESSAGE = 'gspot.toml already says this.';

export const RULE_WITHOUT_CHECK_MESSAGE =
    'An ignore without a check cannot take --rule. Name the check that owns the rule.';

export const TOOL_PROJECT_FILES: ReadonlySet<string> = new Set([
    GSPOT_PATHS.miseProject,
    GSPOT_PATHS.npmProject,
    GSPOT_PATHS.pythonProject,
]);

export const TOOL_PROJECTS_MESSAGE = 'The tool projects in .gspot do not match gspot.toml. Run gspot apply first.';

export const TOOLS_INSTALLED_MESSAGE = 'No change: every tool is installed.';

export const TOOLS_CHANGED_MESSAGE = 'Installed the tools.';

export const INSTALLATION_STOPPED_MESSAGE = 'Installation stopped before every tool was installed.';

export const GSPOT_REMOVE = 'gspot remove';

export const REMOVE_CONFIGURATION_MESSAGE = 'Run gspot remove <configuration> --reason "<why>".';

export const NUMBER_TEXT = /^-?\d+(?:\.\d+)?$/u;

export const TOML_COMPOUND_START = /^[[{]/u;

export const TOML_QUOTES = /^(["'])(.*)\1$/su;

export const BOOLEAN_WORDS: ReadonlySet<string> = new Set(['true', 'false']);

export const DASH_VALUE_HELP =
    'To pass a value that starts with -, put -- before the values: gspot set ci.setup_command -- bun install --frozen-lockfile.';

export const NO_CHECK_IGNORE_TEXTS = {
    unmatched: 'no ignore without a check matches',
    removed: 'without a check',
} as const;

export const ESCAPED_GLOB_CHARACTERS = /\\([()[\]{}*?!+@])/gu;

export const VERIFY_FLAG = '--verify';

export const NAME_ONLY_FLAG = '--name-only';

export const READ_COMMITTED_MESSAGE =
    'Cannot read your committed tool configs. Run git status, then commit or stash the change.';

export const PRETTIER_SCRIPT_NOTE =
    'gspot cannot read this Prettier config, so set format.indent_width and format.print_width by hand';

export const DROPPED_LINE_SETTINGS =
    /^[ \t]*(?:end_of_line[ \t]*=[ \t]*crlf|insert_final_newline[ \t]*=[ \t]*false)[ \t]*$/imu;

export const DROPPED_LINE_SETTINGS_NOTE =
    'drops its crlf or missing final newline: gspot always writes lf and a final newline';

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

export const PRETTIER_DEFAULTS = { tabWidth: 2, printWidth: 80, singleQuote: false, useTabs: false } as const;

export const FORMATTER_DEFAULTS = [
    {
        tag: 'python',
        paths: PYTHON_FILES,
        format: { indent_style: 'space', indent_width: 4, print_width: 88, quotes: 'double' },
    },
    { tag: 'swift', paths: SWIFT_FILES, format: { indent_style: 'space', indent_width: 4, print_width: 120 } },
    { tag: 'sql', paths: SQL_FILES, format: { indent_style: 'space', indent_width: 4, print_width: 80 } },
] as const;

export const PROSE_TAGS: ReadonlySet<string> = new Set(['text', 'markdown']);

export const BUNDLER_PACKAGES: ReadonlySet<string> = new Set([
    'esbuild',
    'vite',
    'webpack',
    'rollup',
    'rolldown',
    '@rspack/core',
]);

export const IMPORT_EXTENSION_SETTING = 'javascript.import_extension';

export const INIT_INSTALL_NOTES: ReadonlySet<string> = new Set([HOOKS_CHANGED_NOTE, TOOLS_CHANGED_NOTE]);

export const WROTE_PLAN_MESSAGE = 'Wrote the plan above.';

export const SETTINGS_EXIST_MESSAGE =
    'This repository already has a gspot.toml. Run gspot doctor to inspect its setup; it prints the gspot add line for newly detected configurations.';

export const NEXT_INSTALL_MESSAGE = 'Next: gspot install, then gspot baseline.';

export const CONFIGURATIONS_OPTION = '--configurations <names>';

export const NO_CONFIGURATIONS_FLAG = '--no-configurations';

export const LEVEL_OPTION = '--level <level>';

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
    'Change the hooks and rule files later with gspot set hooks.enabled or rule_files.enabled.';

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

export const HAND_EDIT_RECORDS = '[[scope]], [[command_check]], and [[import_rule]] take a hand edit.';

export const LEADING_COMMENTS = /^(?:#[^\n]*\n|[ \t]*\n)*/u;

export const LOCAL_RECORDS = { scope: 'path', import_rule: 'name', command_check: 'id' } as const;

export const FROM_CONFLICT_MESSAGE =
    '--from takes the configurations of its file. Leave out {flag}, or edit a copy of the file.';

export const FROM_OPTION = '--from <file>';

export const CONFIGURATION_LIST_SEPARATOR = ',';

export const ADD_REMOVE_MESSAGE = 'Use gspot add or gspot remove to change configurations.';

export const FIX_APPLY_MESSAGE = 'Fix that, then run gspot apply.';

export const COMMAND_SUGGESTION = /\(Did you mean ([^?)]+)\??\)/u;

export const FORMAT_CONFIGURATION = 'format';

export const OPENAPI_CONFIGURATION = 'openapi';
