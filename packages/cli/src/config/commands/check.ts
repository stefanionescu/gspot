import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import type { CHECK_HOOKS } from '#cli/config/tools/installers.ts';
import { INSTALL_HELP } from '#cli/config/tools/programs.ts';
import type { CheckStatus } from '#cli/types/engine/run.ts';

// check flags and staged run

export const CHECK_INPUT_HOOKS = ['pre-push', 'commit-msg'] as const satisfies ReadonlyArray<
    (typeof CHECK_HOOKS)[number]
>;

export const CHECK_STAGES = ['commit', 'push'] as const;

export const CHECK_STOPPED_MESSAGE = 'Check stopped before every check finished.';

export const COMMIT_FILE_MESSAGE = '--hook commit-msg needs one commit message file after --.';

export const EMPTY_CHECKS_MESSAGE = 'Name a check, such as python/ruff.';

export const GIT_SETUP_FILES_ARGUMENTS = ['ls-files', '--cached', '-z', '--', SETTINGS_FILE, GSPOT_FOLDER] as const;

export const GIT_STAGED_SETTINGS_ARGUMENTS = ['show', `:${SETTINGS_FILE}`] as const;

export const HOOK_REFUSAL_REASONS = {
    'pre-push': 'it checks the pushed commits',
    'commit-msg': 'it checks the commit message',
} as const;

export const NOTHING_STAGED_MESSAGE = 'Nothing is staged.';

export const PUSH_INPUT_MESSAGE = 'Git sent pre-push input that is not UTF-8 text.';

export const PUSH_STDIN_MESSAGE =
    '--hook pre-push reads the lines that Git writes to standard input. Run it from the pre-push hook.';

export const SETUP_PATHS = [SETTINGS_FILE, `${GSPOT_FOLDER}/`] as const;

export const STAGE_SETUP_MESSAGE = `Stage ${SETTINGS_FILE} and ${GSPOT_FOLDER}/.`;

export const UNSTAGED_TOOLS_NOTE = `<files> changes that are not staged, so the installed tools are not the tools of the staged settings. ${STAGE_SETUP_MESSAGE}`;

// check report

export const ANNOTATION_ESCAPES: Readonly<Record<string, string>> = {
    '%': '%25',
    '\r': '%0D',
    '\n': '%0A',
    ':': '%3A',
    ',': '%2C',
};

export const ANNOTATION_MESSAGE_CHARACTERS = /[%\r\n]/gu;

export const ANNOTATION_PROPERTY_CHARACTERS = /[%\r\n:,]/gu;

export const CANCELED_RUN_MESSAGE = 'A signal stopped the run.';

export const CHECK_STATUS_COLORS = {
    passed: 'green',
    failed: 'red',
    missing: 'red',
    error: 'red',
    canceled: 'yellow',
    skipped: 'yellow',
} as const;

export const FINDINGS_SHOWN = 200;

export const FIXER_ERROR_PREFIX = /^(?:[\w.]*(?:Error|error))(?: \[[^\]]+\])?:\s*/u;

export const FIX_LABEL = 'fix:';

export const FIX_SENTENCE = /^Run the fix: command that the report prints[^.,;]*(?:\.|, then |; )\s*/u;

export const GITHUB_ANNOTATION_LIMIT = 10;

export const INSTALL_REMINDER = ' (run gspot install)';

export const NOTE_STATUSES = new Set(['missing', 'error', 'canceled', 'skipped']);

export const RERUN_LABEL = 'rerun:';

export const SENTENCE_END = /\.(?= |$)/u;

export const STANDARD_INSTALL_HELP = ` ${INSTALL_HELP}`;

export const STATUS_LABEL_WIDTH = 7;

export const SUMMARY_STATUSES: readonly CheckStatus[] = ['failed', 'error', 'canceled', 'missing', 'passed', 'skipped'];

export const UNCHANGED_FIX_MESSAGE = 'No fixer changed anything.';

// pre-push

export const EMPTY_PUSH_MESSAGE = 'The push sends no commits to check.\n';

export const NO_PENDING_REFS = 'none; see canceled checks above';
