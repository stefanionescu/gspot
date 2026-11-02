import { createRule } from '../rule.ts';
import { getQualifiedName } from '../modules.ts';
import { isDynamicString } from '../expressions.ts';
import { SCRIPT_URL, EVAL_FUNCTIONS } from '../config/servers.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getLeftmostText(node: TSESTree.BinaryExpression): string {
    let left: TSESTree.Node = node.left;
    while (left.type === AST_NODE_TYPES.BinaryExpression && left.operator === '+') left = left.left;
    return ASTUtils.getStringIfConstant(left) ?? '';
}

export const codeEval = createRule<[], 'dynamicCode' | 'scriptUrl'>({
    name: 'code-eval',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds code that runs a string as code: `eval`, `Function`, and the `vm` module functions called with an argument that is not a literal, and `javascript:` URLs built from a template literal or a concatenation with a computed part.',
            why: 'Code built at run time can run whatever an attacker puts into its input.',
            fix: 'Call the code directly, or select it from a fixed table of functions. Pass data as data, such as through `JSON.parse`.',
            example:
                'The call `eval(userInput)` reports `dynamicCode`. Call the function that the input names from a fixed table, such as `handlers[name]()`.',
        },
        schema: [],
        messages: {
            dynamicCode: 'This call runs code built at run time. Call the code directly instead.',
            scriptUrl: 'This javascript: URL runs code built at run time. Call the code directly instead.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const checkCall = (node: TSESTree.CallExpression | TSESTree.NewExpression): void => {
            const isDynamic = node.arguments.some(
                (argument) =>
                    argument.type !== AST_NODE_TYPES.Literal &&
                    (argument.type !== AST_NODE_TYPES.TemplateLiteral || argument.expressions.length > 0),
            );
            const isNamed = ['Identifier', 'MemberExpression'].includes(node.callee.type);
            if (isNamed && isDynamic && EVAL_FUNCTIONS.has(getQualifiedName(node, source)))
                context.report({ node: node.callee, messageId: 'dynamicCode' });
        };
        return {
            CallExpression: checkCall,
            NewExpression: checkCall,
            'TemplateLiteral[expressions.length>0]'(node: TSESTree.TemplateLiteral) {
                const [head] = node.quasis;
                const text = head?.value.raw ?? '';
                if (SCRIPT_URL.test(text)) context.report({ node, messageId: 'scriptUrl' });
            },
            'BinaryExpression[operator="+"]'(node: TSESTree.BinaryExpression) {
                const isOutermost =
                    node.parent.type !== AST_NODE_TYPES.BinaryExpression || node.parent.operator !== '+';
                if (isOutermost && isDynamicString(node) && SCRIPT_URL.test(getLeftmostText(node)))
                    context.report({ node, messageId: 'scriptUrl' });
            },
        };
    },
});
