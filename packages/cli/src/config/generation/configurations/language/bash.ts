export const SHELLCHECK_OPTIONS = [
    ['source-path', 'SCRIPTDIR'],
    ['external-sources', 'true'],
] as const;

export const SHELLCHECK_ALL_LEVEL_ON = [
    'add-default-case',
    'avoid-negated-conditions',
    'avoid-nullary-conditions',
    'deprecate-which',
    'quote-safe-variables',
    'require-double-brackets',
    'require-variable-braces',
    'useless-use-of-cat',
] as const;

export const SHELLCHECK_CHECKS = [
    'check-extra-masked-returns',
    'check-set-e-suppressed',
    'check-unassigned-uppercase',
] as const;

export const SHELLCHECK_CHECK = 'bash/shellcheck';
