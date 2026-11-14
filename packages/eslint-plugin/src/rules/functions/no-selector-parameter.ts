import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import { listChildren } from '../../language/syntax.ts';
import type { TypeReader, FunctionNode } from '../../types/plugin.ts';
import { ASTUtils, TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { EFFECT_CHILD_KEYS, SIDE_EFFECT_NODES, EVENT_LISTENER_KEY } from '../../config/functions.ts';

function isCallbackArgument(node: FunctionNode): boolean {
    const { parent } = node;
    if (parent.type === AST_NODE_TYPES.CallExpression) return parent.arguments.some((value) => Object.is(value, node));
    return (
        parent.type === AST_NODE_TYPES.JSXExpressionContainer ||
        (parent.type === AST_NODE_TYPES.Property && EVENT_LISTENER_KEY.test(String(ASTUtils.getPropertyName(parent))))
    );
}

function hasSideEffects(node: TSESTree.Node): boolean {
    if (SIDE_EFFECT_NODES.has(node.type)) return true;
    return listChildren(node, EFFECT_CHILD_KEYS).some((child) => hasSideEffects(child));
}

function getSelector(node: TSESTree.Identifier, source: TSESLint.SourceCode, types: TypeReader): string | undefined {
    const definition = ASTUtils.findVariable(source.getScope(node), node)?.defs.at(-1);
    const parameter = definition?.type === TSESLint.Scope.DefinitionType.Parameter ? definition.name : undefined;
    if (!ASTUtils.isIdentifier(parameter) || parameter.parent.type === AST_NODE_TYPES.Property) return undefined;
    const type = types.checker.getBaseTypeOfLiteralType(types.get(parameter));
    return type === types.checker.getBooleanType() ? parameter.name : undefined;
}

export const noSelectorParameter = createRule<[], 'selector'>({
    name: 'no-selector-parameter',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            requiresTypeChecking: true,
            description:
                'Reports a boolean parameter that the only statement of a function tests to choose between two actions.',
            why: 'A boolean that selects the behavior makes one function do two jobs, and each call site reads as an unexplained `true` or `false`.',
            fix: 'Split the function into one function for each action, and call the one that fits.',
            example:
                '`function save(draft: boolean) { if (draft) store(); else publish(); }` reports `selector` at `draft`.',
        },
        schema: [],
        messages: { selector: 'Split this function instead of using {{name}} to choose what it does.' },
    },
    create(context) {
        const source = context.sourceCode;
        const types = getTypes(context);
        if (types === undefined) return {};
        const bodies = new Set<TSESTree.Node>();
        const tests: TSESTree.Node[] = [];
        return {
            ':function': function (node: FunctionNode) {
                const isSkipped = node.type !== AST_NODE_TYPES.FunctionDeclaration && isCallbackArgument(node);
                const statements = node.body.type === AST_NODE_TYPES.BlockStatement ? node.body.body : [];
                const [statement] = statements;
                if (!isSkipped && statement !== undefined && statements.length === 1) bodies.add(statement);
            },
            ConditionalExpression: (node) => {
                if (bodies.has(node.parent) && (hasSideEffects(node.consequent) || hasSideEffects(node.alternate)))
                    tests.push(node.test);
            },
            IfStatement: (node) => {
                if (bodies.has(node) && node.alternate !== null) tests.push(node.test);
            },
            'IfStatement:exit': (node: TSESTree.IfStatement) => {
                if (bodies.has(node) && node.alternate !== null) tests.pop();
            },
            Identifier(node) {
                if (tests.length === 0) return;
                const ancestors = new Set(source.getAncestors(node));
                if (tests.every((test) => !Object.is(test, node) && !ancestors.has(test))) return;
                const name = getSelector(node, source, types);
                if (name !== undefined) context.report({ node, messageId: 'selector', data: { name } });
            },
        };
    },
});
