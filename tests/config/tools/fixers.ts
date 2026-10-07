import { TYPO } from '#tests/config/harness/spelling.ts';

/** Native fixes leave an unresolved finding for the repeated fix and manual correction. */
export const PARTIAL_FIX_CASES = [
    {
        configuration: 'sql',
        check: 'sql/sqlfluff',
        path: 'sample.sql',
        tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
        defect: 'select  * from foo;\n',
        partial: 'SELECT * FROM foo;\n',
        corrected: 'SELECT id FROM foo;\n',
    },
    {
        configuration: 'spelling',
        check: 'spelling/typos',
        path: 'sample.txt',
        tables: '',
        defect: `${TYPO.the} ${TYPO.whether}\n`,
        partial: `the ${TYPO.whether}\n`,
        corrected: 'the whether\n',
    },
];
