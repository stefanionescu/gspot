import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';

export const APPLY_WRITE_MESSAGE = 'Run gspot apply to write these files.';

export const INSTALL_WRITE_MESSAGE = 'Run gspot install to write the tool lockfiles.';

export const DRY_RUN_NOTE = 'Dry run: nothing was written.';

export const DRY_RUN_FLAG = '--dry-run';

export const SCOPE_OPTION = '--scope <path>';

export const REASON_OPTION = '--reason <text>';

export const RULE_OPTION = '--rule <rule>';

export const PATHS_OPTION = '--paths <path...>';

export const GLOB_BRACKETS = /[()[\]]/u;

export const IGNORE_CHECK_MESSAGE = 'Run gspot ignore <check> --reason "<why>".';

export const RULE_WITHOUT_CHECK_MESSAGE =
    'An ignore without a check cannot take --rule. Name the check that owns the rule.';

export const TOOL_PROJECT_FILES: ReadonlySet<string> = new Set([
    GSPOT_PATHS.miseProject,
    GSPOT_PATHS.npmProject,
    GSPOT_PATHS.pythonProject,
]);

export const TOOL_PROJECTS_MESSAGE = 'The tool projects in .gspot do not match gspot.toml. Run gspot apply first.';

export const TOOLS_INSTALLED_MESSAGE = 'No change: every tool is installed.';

export const INSTALLATION_STOPPED_MESSAGE = 'Installation stopped before every tool was installed.';

export const KEY_GAP = 2;

export const VALUE_WIDTH = 28;

export const LIST_KINDS = ['configurations', 'settings'] as const;

export const REASON_HEADER = 'reason needed when';

export const OFF_BY_LEVEL = 'off (level)';

export const NO_MATCHING_FILES = 'no matching files';

export const LIST_USAGE = '[options] [configurations|settings]';

export const GSPOT_REMOVE = 'gspot remove';

export const REMOVE_CONFIGURATION_MESSAGE = 'Run gspot remove <configuration> --reason "<why>".';

export const NUMBER_TEXT = /^-?\d+(?:\.\d+)?$/u;

export const TOML_COMPOUND_START = /^[[{]/u;

export const DASH_VALUE_HELP =
    'To pass a value that starts with -, put -- before the values: gspot set ci.setup_command -- bun install --frozen-lockfile.';

export const NO_CHECK_IGNORE_TEXTS = {
    unmatched: 'no ignore without a check matches',
    removed: 'without a check',
} as const;

export const ESCAPED_GLOB_CHARACTERS = /\\([()[\]{}*?!+@])/gu;
