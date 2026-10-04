export const VALID_REPORT = { statistics: { total: { percentage: 0 } }, duplicates: [] };

/** The private npm executable prints the version declared by its package metadata. */
export const SCANNERS = {
    windows: { path: '.gspot/node_modules/.bin/jscpd.cmd', body: '@echo jscpd VERSION\r\n' },
    posix: { path: '.gspot/node_modules/.bin/jscpd', body: '#!/bin/sh\nprintf "jscpd VERSION\\n"\n' },
};

export const EXECUTION_FAILURES = [
    {
        name: 'a report without statistics',
        report: { duplicates: [] },
        flags: { code: 0 },
        diagnostic: 'statistics',
    },
    {
        name: 'a fatal native exit',
        report: VALID_REPORT,
        flags: { code: 1 },
        diagnostic: 'Native scan failed.',
    },
    {
        name: 'a deadline',
        report: VALID_REPORT,
        flags: { code: 1, isTimedOut: true },
        diagnostic: 'ran past 1 seconds',
    },
    {
        name: 'a cancellation',
        report: VALID_REPORT,
        flags: { code: 1, isCanceled: true },
        diagnostic: 'was canceled',
    },
];
