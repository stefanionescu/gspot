export const GLOB_BRACKETS = /[()[\]]/u;

export const UNTIL_OPTION = '--until <date>';

export const IGNORE_CHECK_MESSAGE = 'Run gspot ignore <check> --reason "<why>".';

export const RULE_WITHOUT_CHECK_MESSAGE =
    'An ignore without a check cannot take --rule. Name the check that owns the rule.';

export const UNTIL_FORMAT_MESSAGE = '--until needs a calendar date in YYYY-MM-DD form (UTC).';

export const PAST_UNTIL_MESSAGE = '--until must be a date after today (UTC).';
