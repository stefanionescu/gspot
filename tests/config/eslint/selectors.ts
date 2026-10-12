export const STORE = {
    selector: 'CallExpression[callee.name=/Store$/]',
    message: 'Pass a selector to the store hook.',
} as const;

export const RAW_SQL = {
    selector: "TaggedTemplateExpression[tag.name='sql']",
    message: 'Use the query builder.',
} as const;

export const PROCEDURE = {
    selector: "CallExpression[callee.property.name='query']",
    message: 'Give the procedure an input.',
} as const;

export const INJECTED = {
    selector: "Decorator[expression.callee.name='InjectRepository']",
    message: 'Inject the service.',
} as const;

export const RESPONSE_MESSAGES =
    'response.json({ message: `Item ${identifier}` });\ncustom.info(`Item ${identifier}`);\n';

export const ALIAS_IMPORT = 'import value from "#owner";\n';

export const SCOPE_CONFIGURATIONS = ['javascript', 'react'] as const;
