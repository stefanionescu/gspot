import { TYPO } from '#tests/data/checks/spelling.ts';

/** Tool fixes that leave one finding for the second fix pass and a manual fix. */
export const PARTIAL_FIX_CASES = [
    {
        configuration: 'sql',
        check: 'sql/sqlfluff',
        path: 'sample.sql',
        tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
        sample: 'select  * from foo;\n',
        partial: 'SELECT * FROM foo;\n',
        corrected: 'SELECT id FROM foo;\n',
    },
    {
        configuration: 'spelling',
        check: 'spelling/typos',
        path: 'sample.txt',
        tables: '',
        sample: `${TYPO.the} ${TYPO.whether}\n`,
        partial: `the ${TYPO.whether}\n`,
        corrected: 'the whether\n',
    },
] as const;

/** Settings that indent with tabs of width 4. */
export const TAB_FORMAT_SETTINGS = {
    tables: `[format]
indent_style = "tab"
indent_width = 4
`,
} as const;
