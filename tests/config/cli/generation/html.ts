/** Native built markup keeps compiler-owned serialization and HTML5 identifier syntax. */
export const BUILT_HTML_RULES = {
    'no-inline-style': 'off',
    'no-raw-characters': 'off',
    'void-style': 'off',
    'doctype-style': 'off',
    'no-trailing-whitespace': 'off',
    'valid-id': ['error', { relaxed: true }],
};

/** Native tool settings cannot disable coverage owned by the selected level. */
export const DISABLED_TOOL_RULES = [
    { configuration: 'javascript', tool: 'eslint', rule: 'eqeqeq', value: '"off"' },
    { configuration: 'javascript', tool: 'eslint', rule: 'eqeqeq', value: '0' },
    { configuration: 'markdown', tool: 'markdownlint', rule: 'MD045', value: 'false' },
    { configuration: 'files', tool: 'yamllint', rule: 'trailing-spaces', value: '"disable"' },
    { configuration: 'commits', tool: 'commitlint', rule: 'type-enum', value: '[0, "always", ["feat"]]' },
];
