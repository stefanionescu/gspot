export const PROMISE_MATCHER_SELECTOR =
    'MemberExpression[property.name=/^(?:rejects|resolves)$/][object.type="CallExpression"][object.callee.name="expect"]';
