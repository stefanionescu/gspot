import { createRule } from '../../rule.ts';
import type { FunctionNode } from '../../types/plugin.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    DECLARATION_FILE,
    VALUE_CONTAINERS,
    TYPED_VALUE_PARENTS,
    BOOLEAN_UNION_MEMBERS,
} from '../../config/functions.ts';

function isBooleanType(annotation: TSESTree.TSTypeAnnotation | undefined): boolean {
    const type = annotation?.typeAnnotation;
    if (type?.type !== AST_NODE_TYPES.TSUnionType) return type?.type === AST_NODE_TYPES.TSBooleanKeyword;
    return (
        type.types.some((member) => member.type === AST_NODE_TYPES.TSBooleanKeyword) &&
        type.types.every((member) => BOOLEAN_UNION_MEMBERS.has(member.type))
    );
}

function findBooleanParameter(parameter: TSESTree.Parameter): TSESTree.Identifier | undefined {
    const target = parameter.type === AST_NODE_TYPES.TSParameterProperty ? parameter.parameter : parameter;
    const name = target.type === AST_NODE_TYPES.AssignmentPattern ? target.left : target;
    if (name.type !== AST_NODE_TYPES.Identifier) return undefined;
    const hasBooleanDefault =
        target.type === AST_NODE_TYPES.AssignmentPattern &&
        target.right.type === AST_NODE_TYPES.Literal &&
        typeof target.right.value === 'boolean';
    return hasBooleanDefault || isBooleanType(name.typeAnnotation) ? name : undefined;
}

function isTypedDeclaration(node: TSESTree.Node): boolean {
    if (node.type === AST_NODE_TYPES.VariableDeclarator) return node.id.typeAnnotation !== undefined;
    if (node.type === AST_NODE_TYPES.PropertyDefinition) return node.typeAnnotation !== undefined;
    return node.type === AST_NODE_TYPES.MethodDefinition && (node.kind === 'set' || node.override);
}

/**
Tell whether a declared type fixes the signature of a function value: the parameter of the call that takes it, the
annotation of the variable or class property that holds it, an assertion around it, or the member that it overrides.
*/
function hasFixedSignature(node: FunctionNode): boolean {
    let value: TSESTree.Node = node;
    while (value.parent !== undefined && VALUE_CONTAINERS.has(value.parent.type)) value = value.parent;
    const { parent } = value;
    if (parent === undefined) return false;
    if (parent.type === AST_NODE_TYPES.CallExpression || parent.type === AST_NODE_TYPES.NewExpression)
        return parent.arguments.some((argument) => Object.is(argument, value));
    return TYPED_VALUE_PARENTS.has(parent.type) || isTypedDeclaration(parent);
}

export const noBooleanParameters = createRule<[], 'positional'>({
    name: 'no-boolean-parameters',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a positional parameter typed `boolean`, by its annotation or by a `true` or `false` default.',
            why: 'A `true` or `false` at the call site says nothing about what it turns on.',
            fix: 'Take an options object with a named boolean, or split the function into one function for each case.',
            example:
                '`export function print(error: unknown, isVerbose: boolean) {}` reports `positional` at `isVerbose`, and so does `const save = (draft = false) => {};`. `function save({ draft }: { draft: boolean }) {}` does not report this finding, and neither does a function whose signature a declared type fixes, such as the callback in `items.filter((isReady: boolean) => isReady)`.',
        },
        schema: [],
        messages: { positional: 'Take an options object such as `{ verbose }`, or split the function.' },
    },
    create(context) {
        if (DECLARATION_FILE.test(context.filename)) return {};
        return {
            'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression': function (node: FunctionNode) {
                if (hasFixedSignature(node)) return;
                for (const parameter of node.params) {
                    const name = findBooleanParameter(parameter);
                    if (name !== undefined) context.report({ node: name, messageId: 'positional' });
                }
            },
        };
    },
});
