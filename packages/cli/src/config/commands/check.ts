/** The hook names accepted by --hook; commit-msg also supplies --message-file. */
export const HOOKS = ['pre-commit', 'pre-push', 'commit-msg'] as const;

export const CHECK_FLAG_DEFAULTS = { base: '', skip: [] as string[] };
