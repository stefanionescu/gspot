export const PROGRESS_CLEAR = '\r\u{1B}[2K';

export const CHECK_LIST_SEPARATOR = ',';

export const NO_BASE_REVISION = /^0*$/u;

export const SHORT_HASH_LENGTH = 7;

export const PUSH_STDIN_MESSAGE =
    '--hook pre-push reads the lines that Git writes to standard input. Run it from the pre-push hook.';

export const PRE_COMMIT_OPTION = '--hook pre-commit';

export const COMMIT_FILE_MESSAGE = '--hook commit-msg needs one commit message file after --.';

export const DRY_RUN_MESSAGE = '--dry-run previews the fixes. Add --fix.';

export const CHECK_STOPPED_MESSAGE = 'Check stopped before every check finished.';

export const ONLY_OPTION = '--only <checks>';

export const CHANGED_OPTION = '--changed [ref]';

export const FIX_FLAG = '--fix';

export const HOOK_OPTION = '--hook <hook>';

export const VERBOSE_FLAG = '--verbose';

export const PUSH_INPUT_MESSAGE = 'Git sent pre-push input that is not UTF-8 text.';

export const EMPTY_CHECKS_MESSAGE = 'Name a check, such as --only python/ruff.';
