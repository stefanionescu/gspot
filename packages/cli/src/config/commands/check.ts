import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import type { CheckStatus } from '#cli/types/runs/check.ts';
import { SETTINGS_FILE } from '#cli/config/settings/settings.ts';

export const PROGRESS_CLEAR = '\r\u{1B}[2K';

export const CHECK_LIST_SEPARATOR = ',';

export const NO_BASE_REVISION = /^0*$/u;

export const SHORT_HASH_LENGTH = 7;

export const PUSH_STDIN_MESSAGE =
    '--hook pre-push reads the lines that Git writes to standard input. Run it from the pre-push hook.';

export const PRE_COMMIT_OPTION = '--hook pre-commit';

export const COMMIT_FILE_MESSAGE = '--hook commit-msg needs one commit message file after --.';

export const CHECK_STOPPED_MESSAGE = 'Check stopped before every check finished.';

export const ONLY_OPTION = '--only <checks>';

export const CHANGED_OPTION = '--changed [ref]';

export const FIX_FLAG = '--fix';

export const HOOK_OPTION = '--hook <hook>';

export const VERBOSE_FLAG = '--verbose';

export const PUSH_INPUT_MESSAGE = 'Git sent pre-push input that is not UTF-8 text.';

export const EMPTY_CHECKS_MESSAGE = 'Name a check, such as --only python/ruff.';

export const GIT_SETUP_FILES_ARGUMENTS = ['ls-files', '--cached', '-z', '--', SETTINGS_FILE, GSPOT_FOLDER] as const;

export const SETUP_PATHS = [SETTINGS_FILE, `${GSPOT_FOLDER}/`] as const;

export const STAGE_SETUP_MESSAGE = `Stage ${SETTINGS_FILE} and ${GSPOT_FOLDER}/.`;

export const FIX_ROUNDS = 3;

export const FIX_CANCELED_MESSAGE = 'The fix was canceled.';

export const STAGED_FLAG = '--staged';

export const CHANGED_FLAG = '--changed';

export const EMPTY_PUSH_MESSAGE = 'The push sends no commits to check.\n';

export const NO_PENDING_REFS = 'none; see canceled checks above';

export const NOTE_STATUSES = new Set(['missing', 'error', 'skipped']);

export const FINDINGS_SHOWN = 200;

export const CHECK_STATUS_COLORS = {
    passed: 'green',
    failed: 'red',
    missing: 'red',
    error: 'red',
    skipped: 'yellow',
} as const;

export const FIXER_ERROR_PREFIX = /^(?:[\w.]*(?:Error|error))(?: \[[^\]]+\])?:\s*/u;

export const TOOL_MISSING_MESSAGE = ' (a tool is missing; run gspot install)';

export const STAGED_FILES = 'the staged files';

export const UNCHANGED_FIX_MESSAGE = 'No fixer changed anything.';

export const WORKING_TREE = 'the working tree';

export const RUN_AGAIN = 'run again:';

export const STANDARD_INSTALL_HELP = ' Run gspot install.';

export const NO_FILES_MESSAGE = 'No matching files.';

export const DOCKER_MISSING_MESSAGE = 'Docker is not installed. Install Docker to run this check.';

export const CANCELED_CHECK_NOTE = 'The check was canceled.';

export const FAILED_STATUSES = new Set<CheckStatus>(['failed', 'error']);

export const CHECK_COMMAND = 'gspot check';

export const HOOK_FLAG = '--hook';

export const EMPTY_BASE = 'the base ref is empty';

export const CREATED_BRANCH_BASE = 'the base is a new branch';
