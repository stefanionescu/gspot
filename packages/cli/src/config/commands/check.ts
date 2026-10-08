/** The hook names accepted by --hook; commit-msg also supplies --message-file. */
export const HOOKS = ['pre-commit', 'pre-push', 'commit-msg'] as const;

export const CHECK_FLAG_DEFAULTS = { base: '', skip: [] as string[] };

// Git gives the pre-push hook the remote name and the remote URL.
export const PUSH_ARGUMENTS = 2;
