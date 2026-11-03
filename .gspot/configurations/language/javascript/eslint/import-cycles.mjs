import config from './eslint.mjs';

export default [
    ...config.map(({ rules: _rules, ...block }) => block),
    {
        linterOptions: { reportUnusedDisableDirectives: 'off' },
        rules: { 'import-x/no-cycle': ['error', { ignoreExternal: true }] },
    },
];
