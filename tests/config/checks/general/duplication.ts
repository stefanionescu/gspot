export const JSCPD_SCOPE_FINDINGS = [
    {
        check: 'duplication/jscpd',
        help: 'Move the shared block into one function both callers use.',
        file: 'scripts/café.sh',
        line: 3,
        rule: 'clone',
        message: '30 lines repeat scripts/original.sh:7.',
        fixable: false,
    },
] as const;
