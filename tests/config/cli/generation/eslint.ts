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
