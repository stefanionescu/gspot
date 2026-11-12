import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';

export const PUSH_STDIN_MESSAGE =
    '--hook pre-push reads the lines that Git writes to standard input. Run it from the pre-push hook.';

export const CHECK_STAGES = ['commit', 'push'] as const;

export const CHECK_INPUT_HOOKS = ['pre-push', 'commit-msg'] as const;

export const COMMIT_FILE_MESSAGE = '--hook commit-msg needs one commit message file after --.';

export const CHECK_STOPPED_MESSAGE = 'Check stopped before every check finished.';

export const ONLY_OPTION = '--only <checks>';

export const SKIP_OPTION = '--skip <checks>';

export const BASE_OPTION = '--base <ref>';

export const HOOK_OPTION = '--hook <hook>';

export const PUSH_INPUT_MESSAGE = 'Git sent pre-push input that is not UTF-8 text.';

export const GIT_SETUP_FILES_ARGUMENTS = ['ls-files', '--cached', '-z', '--', SETTINGS_FILE, GSPOT_FOLDER] as const;

export const SETUP_PATHS = [SETTINGS_FILE, `${GSPOT_FOLDER}/`] as const;

export const GIT_STAGED_SETTINGS_ARGUMENTS = ['show', `:${SETTINGS_FILE}`] as const;

export const STAGE_SETUP_MESSAGE = `Stage ${SETTINGS_FILE} and ${GSPOT_FOLDER}/.`;

export const UNSTAGED_TOOLS_NOTE = `<files> changes that are not staged, so the installed tools are not the tools of the staged settings. ${STAGE_SETUP_MESSAGE}`;

export const NOTHING_STAGED_MESSAGE = 'Nothing is staged.';

export const EMPTY_PUSH_MESSAGE = 'The push sends no commits to check.\n';

export const NO_PENDING_REFS = 'none; see canceled checks above';

export const NOTE_STATUSES = new Set(['missing', 'error', 'canceled', 'skipped']);

export const FINDINGS_SHOWN = 200;

export const CHECK_STATUS_COLORS = {
    passed: 'green',
    failed: 'red',
    missing: 'red',
    error: 'red',
    canceled: 'yellow',
    skipped: 'yellow',
} as const;

export const FIXER_ERROR_PREFIX = /^(?:[\w.]*(?:Error|error))(?: \[[^\]]+\])?:\s*/u;

export const INSTALL_REMINDER = ' (run gspot install)';

export const STATUS_LABEL_WIDTH = 7;

export const SENTENCE_END = /\.(?= |$)/u;

export const UNCHANGED_FIX_MESSAGE = 'No fixer changed anything.';

export const FIX_LABEL = 'fix:';

export const RERUN_LABEL = 'rerun:';

export const NOT_SET = 'not set';

export const CANCELED_RUN_MESSAGE = 'A signal stopped the run.';

export const REASON_OPTION_TEXT = ' [--reason "<why>"]';

export const STANDARD_INSTALL_HELP = ' Run gspot install.';

export const KEY_GAP = 2;

export const VALUE_WIDTH = 28;

export const LIST_KINDS = ['configurations', 'settings'] as const;

export const REASON_HEADER = 'needs a reason when';

export const LIST_ARGUMENT = '[configurations|settings]';

export const VERSION_GAP = 4;

export const TOOL_STATE_COLORS = {
    ok: 'green',
    error: 'red',
    missing: 'red',
    outdated: 'red',
    newer: 'red',
    system: 'dim',
} as const;

export const CI_FILE_SUFFIXES = { github: '', gitlab: ' (include from .gitlab-ci.yml)' } as const;

export const ORIGIN_URL_SETTING = 'remote.origin.url';

export const REMOTE_URL_SCHEME = /^(?:https?|ssh):\/\//u;

export const REMOTE_URL_USER = /^[^@/]+@/u;

export const CI_OFF_NOTES = {
    github: 'off; gspot set ci.enabled true writes the check workflow',
    gitlab: 'off; gspot set ci.enabled true and gspot set ci.provider gitlab write the check workflow',
} as const;

export const RUN_IN_COPY_MESSAGE = 'Runs on a copy of the selected files in a temporary folder.';

export const REPOSITORY_COMMAND = 'repository command';

export const SELECTED_YES_MESSAGE = 'Selected in this repository: yes';

export const DETECTED_BY = 'Detected by';

export const LANGUAGE_FILES_MESSAGE = 'every file a language configuration selects';

export const TEST_FILES_MESSAGE = 'the files that test_files names';

export const PRETTIER_FILES_MESSAGE = 'the file types of the selected Prettier plugins';

export const ESLINT_FILES_MESSAGE = 'the file types of the selected ESLint plugins';

export const TOOL_PINS = 'Tools it pins';

export const BINARY_ELIGIBLE_MESSAGE = 'binary: eligible for secrets and size checks';

export const GENERATED_ELIGIBLE_MESSAGE = 'generated: eligible for secret checks and checks for stale generated files';

export const VENDORED_ELIGIBLE_MESSAGE = 'vendored: eligible for secrets, license, and security checks';

export const UNCHECKED_REASON = 'no selected check reads this file';

export const IGNORED_FILE_MESSAGE =
    'An ignore in gspot.toml covers this file. To check it, run gspot unignore --paths <path> with the path that the ignore names.';

export const MARK_GENERATED_MESSAGE =
    'Mark generated or copied files linguist-generated or linguist-vendored in .gitattributes, or run gspot add <configuration>.';

export const REASON_HELP =
    'If you set this value, give a reason: write it as { value = ..., reason = "..." }, or run gspot set with --reason.';

export const LINT_RULE_LABELS = [
    ['description', 'What it looks for'],
    ['why', 'Why'],
    ['fix', 'What to do'],
    ['example', 'Example'],
] as const;

export const GIT_UNBORN_HEAD_ARGUMENTS = ['symbolic-ref', 'HEAD', 'refs/heads/main'] as const;

export const SCAN_SETTINGS_MESSAGE =
    'This repository already has a gspot.toml, so gspot scan has nothing to preview. Run gspot check. To try an upgrade or a level change, commit first, so that you can check out that commit to go back.';

export const SCAN_NO_FILES_MESSAGE =
    'gspot scan checks a copy of the tracked files, and this repository tracks none. Stage your files with git add, then run gspot scan again.';

export const SCAN_STOPPED_MESSAGE = 'Scan stopped before it finished. Your repository did not change.';

export const SCAN_LOCKFILE_MESSAGE = 'Stage <lockfile>, so the scan picks the same package manager as init.';

export const SCAN_EXAMPLES_SHOWN = 3;

export const SCAN_RULES_SHOWN = 5;

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

export const SCAN_FORMAT_CHECKS: ReadonlySet<string> = new Set([
    'bash/shfmt',
    'format/editorconfig-checker',
    'format/prettier',
    'python/ruff-format',
    'swift/swiftformat',
    'toml/taplo',
]);

export const SCAN_BUILT_IN_TOOL = 'gspot';

export const SCAN_FORMATTING_TITLE = 'Formatting';

export const SCAN_NOT_RUN_TITLE = 'Could not run';

export const SCAN_LEFT_OUT_TITLE = 'Not run in a scan, because they run your code';

export const SCAN_PLAN_TITLE = 'What gspot init would do';

export const SCAN_COMMANDS_TITLE = 'Commands that would break';

export const SCAN_CARRYOVER_TITLE = 'What gspot init would carry over and drop';

export const SCAN_NEXT_STEPS_TITLE = 'Next steps';

export const SCAN_NEXT_STEPS = ['Commit the setup files.', 'Fix each file as you touch it.'] as const;

export const BYTES_PER_MEGABYTE = 1_048_576;
