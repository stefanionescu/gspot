const STORE = {
    selector: 'CallExpression[callee.name=/Store$/]',
    message: 'Pass a selector to the store hook.',
} as const;

const PROCEDURE = {
    selector: "CallExpression[callee.property.name='query']",
    message: 'Give the procedure an input.',
} as const;

export const RESPONSE_MESSAGES =
    'response.json({ message: `Item ${identifier}` });\ncustom.info(`Item ${identifier}`);\n';

export const ALIAS_IMPORT = 'import value from "#owner";\n';

export const SCOPE_CONFIGURATIONS = ['javascript', 'react'] as const;

export const SELECTOR_GROUP_CASES = [
    {
        name: 'general selectors apply in first-mention order',
        selectors: [STORE, PROCEDURE],
        expected: [{ selectors: [STORE, PROCEDURE] }],
    },
];
