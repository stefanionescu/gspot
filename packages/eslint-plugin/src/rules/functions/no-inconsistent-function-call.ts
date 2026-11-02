import { createRule } from '../../rule.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function findCalledVariable(
    node: TSESTree.CallExpression | TSESTree.NewExpression,
    source: TSESLint.SourceCode,
): TSESLint.Scope.Variable | undefined {
    if (node.callee.type !== AST_NODE_TYPES.Identifier) return undefined;
    const variable = ASTUtils.findVariable(source.getScope(node), node.callee);
    return variable === null || variable.defs.length === 0 ? undefined : variable;
}

export const noInconsistentFunctionCall = createRule<[], 'inconsistent'>({
    name: 'no-inconsistent-function-call',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a call of a function declared in the file when an earlier call of the same function used `new` and this one does not, or the reverse. Each function is reported once.',
            why: 'A function meant for `new` sets up `this`, and a plain function does not, so one of the two calls behaves differently than intended.',
            fix: 'Call the function the same way everywhere: always with `new` for a constructor, never for a plain function.',
            example:
                '`const first = new Point(1, 2); const second = Point(3, 4);` reports `inconsistent` at the second call.',
        },
        schema: [],
        messages: {
            inconsistent: 'Line {{line}} calls this function {{other}} new. Call it the same way here.',
        },
    },
    create(context) {
        const constructed = new Map<TSESLint.Scope.Variable, TSESTree.Node>();
        const called = new Map<TSESLint.Scope.Variable, TSESTree.Node>();
        const reported = new Set<TSESLint.Scope.Variable>();
        const inspect = (node: TSESTree.CallExpression | TSESTree.NewExpression) => {
            const variable = findCalledVariable(node, context.sourceCode);
            if (variable === undefined || reported.has(variable)) return;
            const [same, opposite, other] =
                node.type === AST_NODE_TYPES.NewExpression
                    ? ([constructed, called, 'without'] as const)
                    : ([called, constructed, 'with'] as const);
            const earlier = opposite.get(variable);
            if (earlier === undefined) {
                same.set(variable, node);
                return;
            }
            reported.add(variable);
            context.report({
                node: node.callee,
                messageId: 'inconsistent',
                data: { line: earlier.loc.start.line, other },
            });
        };
        return { CallExpression: inspect, NewExpression: inspect };
    },
});
