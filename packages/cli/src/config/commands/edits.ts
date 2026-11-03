import { HOOKS_CHANGED_NOTE, TOOLS_CHANGED_NOTE } from '#cli/config/generation.ts';

export const IGNORE_CHECK_MESSAGE = 'Run gspot ignore <check> --reason "<why>".';

export const UNCHANGED_SETTINGS_MESSAGE = 'No change: gspot.toml already says this.';

export const REPAIRED_FILES_MESSAGE = 'gspot.toml already says this.';

export const RULE_WITHOUT_CHECK_MESSAGE =
    'An ignore without a check cannot take --rule. Name the check that owns the rule.';

export const TOOLS_INSTALLED_MESSAGE = 'No change: every tool is installed.';

export const TOOLS_CHANGED_MESSAGE = 'Installed the tools.';

export const TOOLS_MISSING_MESSAGE = 'Some tools are still missing.';

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

export const INIT_INSTALL_NOTES: ReadonlySet<string> = new Set([HOOKS_CHANGED_NOTE, TOOLS_CHANGED_NOTE]);

export const WROTE_PLAN_MESSAGE = 'Wrote the plan above.';

export const SETTINGS_EXIST_MESSAGE =
    'This repository already has a gspot.toml. Run gspot doctor to inspect its setup, and gspot check --only gspot/detected-configurations for the gspot add line of each newly detected configuration.';

export const NEXT_INSTALL_MESSAGE = 'Next: gspot install, then gspot check --fix, then gspot baseline.';

export const NEXT_PIN_MESSAGE =
    'Next: run {runner} install to install the gspot that {file} now pins, then gspot install, then gspot check --fix, then gspot baseline.';

export const CONFIGURATIONS_OPTION = '--configurations <names>';

export const NO_CONFIGURATIONS_FLAG = '--no-configurations';

export const LEVEL_OPTION = '--level <level>';

export const LOCAL_RECORDS = { scope: 'path', import_rule: 'name', command_check: 'id' } as const;

export const FROM_CONFLICT_MESSAGE =
    '--from takes the configurations of its file. Leave out {flag}, or edit a copy of the file.';

export const FROM_OPTION = '--from <file>';

export const CONFIGURATION_LIST_SEPARATOR = ',';

export const ADD_REMOVE_MESSAGE = 'Use gspot add or gspot remove to change configurations.';

export const FIX_APPLY_MESSAGE = 'Fix that, then run gspot apply.';

export const COMMAND_SUGGESTION = /\(Did you mean ([^?)]+)\??\)/u;
