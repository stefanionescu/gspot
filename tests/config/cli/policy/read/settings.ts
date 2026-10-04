/** Native disabled values must produce the matching accepted-finding command. */
export const DISABLED_RULES = [
    { tool: 'eslint', configuration: 'javascript', rule: 'eqeqeq', value: 0, check: 'javascript/eslint' },
    { tool: 'eslint', configuration: 'javascript', rule: 'eqeqeq', value: 'off', check: 'javascript/eslint' },
    { tool: 'eslint', configuration: 'javascript', rule: 'eqeqeq', value: [0, 'always'], check: 'javascript/eslint' },
    {
        tool: 'eslint',
        configuration: 'javascript',
        rule: 'eqeqeq',
        value: ['off', 'always'],
        check: 'javascript/eslint',
    },
    {
        tool: 'commitlint',
        configuration: 'commits',
        rule: 'subject-case',
        value: [0, 'always', 'sentence-case'],
        check: 'commits/commitlint',
    },
    { tool: 'markdownlint', configuration: 'markdown', rule: 'MD044', value: false, check: 'markdown/markdownlint' },
    { tool: 'yamllint', configuration: 'files', rule: 'line-length', value: 'disable', check: 'files/yamllint' },
];
