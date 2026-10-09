export const GOOD_IGNORE =
    '[[ignore]]\ncheck = "bash/shellcheck"\nreason = "The launcher script checks its own arguments."\n';

/** Missing reasons retain the authored coordinate and any valid sibling ignore. */
export const MISSING_REASON_CASES = [
    {
        name: 'a missing ignore reason',
        validIgnore: '',
        index: 0,
        checks: [],
        reason: 'The native shell is checked by the project command.',
    },
    {
        name: 'an ignore without a reason is a finding at its key path, and the other ignore stands',
        validIgnore: GOOD_IGNORE,
        index: 1,
        checks: ['bash/shellcheck'],
        reason: 'The syntax check reads the shebang alone.',
    },
];
