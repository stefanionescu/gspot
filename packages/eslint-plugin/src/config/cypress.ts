export const CYPRESS_QUERIES: ReadonlySet<string | null> = new Set([
    'children',
    'closest',
    'contains',
    'eq',
    'filter',
    'find',
    'first',
    'focused',
    'get',
    'last',
    'next',
    'nextAll',
    'nextUntil',
    'not',
    'parent',
    'parents',
    'parentsUntil',
    'prev',
    'prevAll',
    'prevUntil',
    'root',
    'shadow',
    'siblings',
]);

export const THEN_CALLBACK =
    'CallExpression[callee.type="MemberExpression"][callee.property.name="then"][optional=false][callee.optional=false][arguments.length=1] > :matches(ArrowFunctionExpression, FunctionExpression)[async=false][generator=false][params.length=1] > BlockStatement.body';

export const SELECTOR_TEXT = /^(?:'(?!@)|"(?!@)|`[^@`$])/u;

export const STRING_CALLS = new Set(['yielded.text', 'string.trim', 'string.toLowerCase', 'string.toUpperCase']);

export const ASSERTION_DEPTHS = new Map([
    ['expect', 3],
    ['assert', 2],
]);

export const LITERAL_KINDS = new Map([
    ['string', 'string'],
    ['number', 'value'],
    ['bigint', 'value'],
    ['boolean', 'value'],
    ['object', 'value'],
]);

export const SAFE_OPERANDS = new Map([
    ['TemplateLiteral', ['string', 'expressions']],
    ['UnaryExpression', ['value', 'argument']],
    ['BinaryExpression', ['value', 'left', 'right']],
    ['LogicalExpression', ['value', 'left', 'right']],
    ['ConditionalExpression', ['value', 'test', 'consequent', 'alternate']],
    ['ArrayExpression', ['record', 'elements']],
    ['ObjectExpression', ['record', 'properties']],
    ['Property', ['value', 'value']],
]);
