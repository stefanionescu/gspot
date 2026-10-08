export const STORE = {
    selector: 'CallExpression[callee.name=/Store$/]',
    message: 'Pass a selector to the store hook.',
};
export const RAW_SQL = { selector: "TaggedTemplateExpression[tag.name='sql']", message: 'Use the query builder.' };
export const PROCEDURE = {
    selector: "CallExpression[callee.property.name='query']",
    message: 'Give the procedure an input.',
};
export const INJECTED = {
    selector: "Decorator[expression.callee.name='InjectRepository']",
    message: 'Inject the service.',
};

export const RESPONSE_MESSAGES =
    'response.json({ message: `Item ${identifier}` });\ncustom.info(`Item ${identifier}`);\n';
export const LEVEL_RULES = {
    'sonarjs/no-empty-test-file': 0,
    'sonarjs/no-parameter-reassignment': 0,
    'sonarjs/for-loop-increment-sign': 0,
    'security/detect-object-injection': 0,
    'security/detect-non-literal-fs-filename': 0,
    'security/detect-non-literal-require': 2,
    'n/no-sync': 2,
    'for-direction': 2,
};

export const ALIAS_IMPORT = 'import value from "#owner";\n';
