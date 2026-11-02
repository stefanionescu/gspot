import { createRule } from '../rule.ts';
import { readTypes } from '../checker.ts';
import { listChildren } from '../syntax.ts';
import type { TypeReader } from '../types/plugin.ts';
import type { FunctionNode } from '../types/rules.ts';
import { ASTUtils, TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { EFFECT_CHILD_KEYS, SIDE_EFFECT_NODES, EVENT_LISTENER_KEY } from '../config/calls.ts';

function isCallbackArgument(node: FunctionNode): boolean {
    const { parent } = node;
    if (parent.type === AST_NODE_TYPES.CallExpression) return parent.arguments.some((value) => Object.is(value, node));
    if (parent.type === AST_NODE_TYPES.JSXExpressionContainer) return true;
    return parent.type === AST_NODE_TYPES.Property && EVENT_LISTENER_KEY.test(String(ASTUtils.getPropertyName(parent)));
}

function hasSideEffects(node: TSESTree.Node): boolean {
    if (SIDE_EFFECT_NODES.has(node.type)) return true;
    return listChildren(node, EFFECT_CHILD_KEYS).some((child) => hasSideEffects(child));
}

function readSelector(node: TSESTree.Identifier, source: TSESLint.SourceCode, types: TypeReader): string | undefined {
    const definition = ASTUtils.findVariable(source.getScope(node), node)?.defs.at(-1);
    const parameter = definition?.type === TSESLint.Scope.DefinitionType.Parameter ? definition.name : undefined;
    if (!ASTUtils.isIdentifier(parameter) || parameter.parent.type === AST_NODE_TYPES.Property) return undefined;
    const type = types.checker.getBaseTypeOfLiteralType(types.read(parameter));
    return type === types.checker.getBooleanType() ? parameter.name : undefined;
}

export const noSelectorParameter = createRule<[], 'selector'>({
    name: 'no-selector-parameter',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a boolean parameter that the only statement of a function tests to choose between two actions: an `if` with an `else`, or a conditional expression whose branches have side effects. Callback arguments, JSX handlers, and `on*` handler properties do not count. The rule needs type information.',
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
        const types = readTypes(context);
        if (types === undefined) return {};
        const bodies = new Set<TSESTree.Node>();
        const tests: TSESTree.Node[] = [];
        const inspectFunction = (node: FunctionNode) => {
            const isSkipped = node.type !== AST_NODE_TYPES.FunctionDeclaration && isCallbackArgument(node);
            const statements = node.body.type === AST_NODE_TYPES.BlockStatement ? node.body.body : [];
            const [statement] = statements;
            if (!isSkipped && statement !== undefined && statements.length === 1) bodies.add(statement);
        };
        return {
            FunctionDeclaration: inspectFunction,
            FunctionExpression: inspectFunction,
            ArrowFunctionExpression: inspectFunction,
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
                if (!tests.some((test) => Object.is(test, node) || ancestors.has(test))) return;
                const name = readSelector(node, source, types);
                if (name !== undefined) context.report({ node, messageId: 'selector', data: { name } });
            },
        };
    },
});
