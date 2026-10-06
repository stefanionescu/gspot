/** Native disabled values must produce the matching accepted-finding command. */
export const DISABLED_RULES = [
    {
        tool: 'commitlint',
        configuration: 'commits',
        rule: 'subject-case',
        value: [0, 'always', 'sentence-case'],
        check: 'commits/commitlint',
    },
    { tool: 'yamllint', configuration: 'files', rule: 'line-length', value: 'disable', check: 'files/yamllint' },
];
