import { createRule } from '../../rule.ts';
import { SANITIZER_BYPASS_METHODS } from '../../config/web.ts';
import { getExpressionValue, getOptionProperties } from '../../language/expressions.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getSanitizerProperty(node: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    if (
        node.type !== AST_NODE_TYPES.MemberExpression ||
        node.computed ||
        node.property.type !== AST_NODE_TYPES.Identifier
    )
        return undefined;
    const receiver = getExpressionValue(node.object, source) ?? node.object;
    return receiver.type === AST_NODE_TYPES.ObjectExpression
        ? getOptionProperties(receiver, source).get(node.property.name)?.value
        : undefined;
}

function isLiteralSanitizerValue(
    node: TSESTree.Node,
    source: TSESLint.SourceCode,
    seen = new Set<TSESTree.Node>(),
): boolean {
    const value = getExpressionValue(node, source) ?? node;
    if (seen.has(value)) return false;
    seen.add(value);
    if (value.type === AST_NODE_TYPES.Literal) return true;
    if (value.type === AST_NODE_TYPES.TemplateLiteral) return value.expressions.length === 0;
    const property = getSanitizerProperty(value, source);
    return property !== undefined && isLiteralSanitizerValue(property, source, seen);
}

export const noUnsafeSanitizerBypass = createRule<[], 'bypass'>({
    name: 'no-unsafe-sanitizer-bypass',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Reports Angular sanitizer bypass calls whose value is not a known literal.',
            why: 'Bypassing sanitization lets untrusted HTML, scripts, styles, or URLs reach the browser.',
            fix: 'Keep Angular sanitization enabled for dynamic values. Bypass it only for a reviewed literal.',
            example:
                'Bind a dynamic value through the normal Angular template binding instead of bypassSecurityTrustHtml.',
        },
        schema: [],
        messages: { bypass: 'Keep sanitization enabled for this dynamic value instead of bypassing it.' },
    },
    create(context) {
        return {
            CallExpression: (node) => {
                const { callee } = node;
                if (
                    callee.type !== AST_NODE_TYPES.MemberExpression ||
                    callee.property.type !== AST_NODE_TYPES.Identifier ||
                    !SANITIZER_BYPASS_METHODS.has(callee.property.name)
                )
                    return;
                const argument = node.arguments[0];
                if (
                    argument !== undefined &&
                    node.arguments.length === 1 &&
                    !isLiteralSanitizerValue(argument, context.sourceCode)
                )
                    context.report({ node: callee.property, messageId: 'bypass' });
            },
        };
    },
});
