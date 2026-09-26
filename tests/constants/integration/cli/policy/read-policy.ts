// The literal values integration/cli/policy/read-policy reads: names, patterns, limits, and tables.

export const GOOD_IGNORE =
    '[[ignore]]\ncheck = "bash/shellcheck"\nreason = "The launcher script checks its own arguments."\n';
