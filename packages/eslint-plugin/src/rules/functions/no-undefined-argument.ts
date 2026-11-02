import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import { UNDEFINED_NAME } from '../../config/plugin.ts';
import type { TypeReader } from '../../types/plugin.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isOptionalParameter(node: TSESTree.CallExpression, types: TypeReader): boolean {
    const declaration = types.checker.getResolvedSignature(types.map.get(node))?.declaration;
    const parameters = declaration !== undefined && 'parameters' in declaration ? declaration.parameters : [];
    const parameter = parameters[node.arguments.length - 1];
    return (
        parameter !== undefined &&
        !('tagName' in parameter) &&
        (parameter.questionToken !== undefined || parameter.initializer !== undefined)
    );
}

export const noUndefinedArgument = createRule<[], 'undefined'>({
    name: 'no-undefined-argument',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports `undefined` passed as the last argument for a parameter that is optional or has a default value. It needs type information and reports nothing without it.',
            why: 'An optional parameter is already `undefined` when the argument is left out, so the explicit value only adds noise.',
            fix: 'Remove the last argument.',
            example:
                '`format(value, undefined)` reports `undefined` when `format(value, style?)` declares `style` optional.',
        },
        schema: [],
        messages: { undefined: 'Remove this undefined argument. The parameter is optional.' },
    },
    create(context) {
        const types = getTypes(context);
        if (types === undefined) return {};
        return {
            CallExpression(node) {
                const last = node.arguments.at(-1);
                if (
                    last?.type !== AST_NODE_TYPES.Identifier ||
                    last.name !== UNDEFINED_NAME ||
                    !isOptionalParameter(node, types)
                )
                    return;
                context.report({ node: last, messageId: 'undefined' });
            },
        };
    },
});
