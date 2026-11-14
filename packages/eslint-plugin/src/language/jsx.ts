import { BOOLEAN_TEXTS } from '../config/accessibility.ts';
import type { JsxAttributeValue } from '../types/accessibility.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function normalizeLiteral(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const text = value.toLowerCase();
    return BOOLEAN_TEXTS.has(text) ? text === 'true' : value;
}

function getAttributeValue(value: TSESTree.JSXAttribute['value']): unknown {
    if (value === null) return true;
    const expression = value.type === AST_NODE_TYPES.JSXExpressionContainer ? value.expression : value;
    if (expression.type === AST_NODE_TYPES.Literal) return normalizeLiteral(expression.value);
    return expression.type === AST_NODE_TYPES.TemplateLiteral && expression.expressions.length === 0
        ? expression.quasis[0]?.value.cooked
        : null;
}

export function getElementName(name: TSESTree.JSXTagNameExpression): string {
    if (name.type === AST_NODE_TYPES.JSXIdentifier) return name.name;
    return name.type === AST_NODE_TYPES.JSXNamespacedName
        ? `${name.namespace.name}:${name.name.name}`
        : `${getElementName(name.object)}.${name.property.name}`;
}

/**
Get an attribute of a JSX opening tag by its name, in any letter case. The code may write its value as a string,
as a literal in braces, or leave it out for `true`. The strings `"true"` and `"false"` read as booleans.
*/
export function getAttribute(element: TSESTree.JSXOpeningElement, name: string): JsxAttributeValue | undefined {
    const attribute = element.attributes.find(
        (child): child is TSESTree.JSXAttribute =>
            child.type === AST_NODE_TYPES.JSXAttribute &&
            getElementName(child.name).toLowerCase() === name.toLowerCase(),
    );
    return attribute === undefined ? undefined : { node: attribute, value: getAttributeValue(attribute.value) };
}
