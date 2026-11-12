import type { Group } from '#cli/types/manifests.ts';

// install

export const FILES_CHANGED_MESSAGE = 'Wrote the generated files, and every tool is installed.';

export const INSTALLATION_STOPPED_MESSAGE = 'Installation stopped before every tool was installed.';

export const TOOLS_CHANGED_MESSAGE = 'Installed the tools.';

export const TOOLS_INSTALLED_MESSAGE = 'No change: every generated file is up to date, and every tool is installed.';

export const TOOLS_MISSING_MESSAGE = 'Some tools are still missing.';

// init

export const FROM_CONFLICT_MESSAGE =
    '--from takes the configurations of its file. Leave out --configurations, or edit a copy of the file.';

export const INIT_STOPPED_MESSAGE = `${INSTALLATION_STOPPED_MESSAGE} Init wrote gspot.toml and the generated files, and deleted the configs that they replace. The tools and the Git hooks are not installed. Run gspot install to finish the setup. To go back instead, restore the files that git status lists as changed or deleted, and delete the new ones.`;

export const NEXT_PIN_MESSAGE =
    'Next: run {runner} install to install the gspot that {file} now pins, commit the setup files, then fix each file as you touch it.';

export const NEXT_STEPS_MESSAGE = 'Next: commit the setup files, then fix each file as you touch it.';

export const SETTINGS_EXIST_MESSAGE =
    'This repository already has a gspot.toml. Run gspot doctor to inspect its setup, and gspot check --only gspot/detected-configurations for the gspot add line of each newly detected configuration.';

export const WROTE_PLAN_MESSAGE = 'Wrote the plan above.';

// init report

export const AGENT_FILES_LABEL = 'agent files';

export const ANY_FILE_GLOB = /^\*+(?:\/\*+)*$/u;

export const CI_LABEL = 'existing ci';

export const DETECTION_GAP_WIDTH = 3;

export const DETECTION_LABEL_WIDTH = 20;

export const GROUP_LABELS = {
    language: 'Languages',
    framework: 'Frameworks',
    platform: 'Platforms',
    database: 'Databases',
    testing: 'Testing',
    infrastructure: 'Infrastructure',
    library: 'Libraries',
    general: 'General',
} as const satisfies Record<Group, string>;

export const HOOKS_LABEL = 'existing hooks';

export const LEAVES_LABEL = 'gspot leaves';

export const LINT_FOLDERS_LABEL = 'lint folders';

export const LINT_SETUP_MESSAGE = 'may hold old lint scripts; gspot leaves it';

export const NOT_CHECKED_LABEL = 'not checked';

export const OWN_HOOKS = 'your own';

export const PROJECT_FILE_NOTE = 'a project file in each';

export const REPLACES_LABEL = 'gspot replaces';

export const UNCHECKED_FILES_SHOWN = 5;

// scan

export const GIT_UNBORN_HEAD_ARGUMENTS = ['symbolic-ref', 'HEAD', 'refs/heads/main'] as const;

export const SCAN_LEFT_OUT_NEEDS = new Set(['build', 'project-code']);

export const SCAN_LOCKFILE_MESSAGE = 'Stage <lockfile>, so the scan picks the same package manager as init.';

export const SCAN_NO_FILES_MESSAGE =
    'gspot scan checks a copy of the tracked files, and this repository tracks none. Stage your files with git add, then run gspot scan again.';

export const SCAN_SETTINGS_MESSAGE =
    'This repository already has a gspot.toml, so gspot scan has nothing to preview. Run gspot check. To try an upgrade or a level change, commit first, so that you can check out that commit to go back.';

export const SCAN_STOPPED_MESSAGE = 'Scan stopped before it finished. Your repository did not change.';

// scan report

export const SCAN_BUILT_IN_TOOL = 'gspot';

export const SCAN_CARRYOVER_TITLE = 'What gspot init would carry over and drop';

export const SCAN_CODE_CATEGORY = 'Code';

export const SCAN_CATEGORIES = [
    { name: 'Secrets', configurations: ['secrets'] },
    { name: 'Security', configurations: ['security'] },
    { name: 'Dependencies', configurations: ['dependencies', 'licenses'] },
    { name: SCAN_CODE_CATEGORY, configurations: [] },
    { name: 'Docs and spelling', configurations: ['docs', 'markdown', 'prose', 'spelling'] },
    { name: 'Layout', configurations: ['json', 'naming', 'repository', 'structure', 'toml', 'xml', 'yaml'] },
    { name: 'Setup', configurations: ['commits', 'gspot'] },
] as const;

export const SCAN_COMMANDS_TITLE = 'Commands that would break';

export const SCAN_EXAMPLES_SHOWN = 3;

export const SCAN_FORMATTING_TITLE = 'Formatting';

export const SCAN_FORMAT_CHECKS: ReadonlySet<string> = new Set([
    'bash/shfmt',
    'format/editorconfig-checker',
    'format/prettier',
    'python/ruff-format',
    'swift/swiftformat',
    'toml/taplo',
]);

export const SCAN_LEFT_OUT_TITLE = 'Not run in a scan, because they run your code';

export const SCAN_NEXT_STEPS = ['Commit the setup files.', 'Fix each file as you touch it.'] as const;

export const SCAN_NEXT_STEPS_TITLE = 'Next steps';

export const SCAN_NOT_RUN_TITLE = 'Could not run';

export const SCAN_PLAN_TITLE = 'What gspot init would do';

export const SCAN_RULES_SHOWN = 5;
