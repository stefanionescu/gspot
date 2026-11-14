import { createRule } from '../../rule.ts';
import type { FunctionNode } from '../../types/plugin.ts';
import { findFunction } from '../../language/functions.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { getOptionValue } from '../../language/expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { REGENERATE_METHOD, AUTHENTICATE_FUNCTION, ROUTE_CALLBACK_POSITION } from '../../config/servers.ts';

function isStateless(source: Readonly<TSESLint.SourceCode>, options: TSESTree.Node | undefined): boolean {
    if (options?.type !== AST_NODE_TYPES.ObjectExpression) return false;
    return getOptionValue(options, 'session', source)?.value === false;
}

function findAuthenticatedCallback(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression,
): FunctionNode | undefined {
    const route = node.parent.type === AST_NODE_TYPES.CallExpression ? node.parent : undefined;
    if (route === undefined || getQualifiedName(node, source) !== AUTHENTICATE_FUNCTION) return undefined;
    return isStateless(source, node.arguments[1])
        ? undefined
        : findFunction(route.arguments[ROUTE_CALLBACK_POSITION], source);
}

export const requireSessionRegeneration = createRule<[], 'keptSession'>({
    name: 'require-session-regeneration',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds route callbacks that come after `passport.authenticate` in the same route and never call `regenerate`, unless the authentication passes `session: false`.',
            why: 'A session that keeps its identifier after login lets an attacker who planted that identifier take over the signed-in session.',
            fix: 'Call `req.session.regenerate` in the callback that runs after authentication, and copy the data you keep into the new session.',
            example:
                'The route `app.post("/login", passport.authenticate("local"), function (req, res) { res.redirect("/"); })` reports `keptSession`. Call `req.session.regenerate(...)` in the callback.',
        },
        schema: [],
        messages: { keptSession: 'Create a new session after authentication. Call req.session.regenerate here.' },
    },
    create(context) {
        const source = context.sourceCode;
        const callbacks: FunctionNode[] = [];
        const regenerations: TSESTree.CallExpression[] = [];
        return {
            CallExpression(node) {
                const callback = findAuthenticatedCallback(source, node);
                if (callback) callbacks.push(callback);
                if (
                    node.callee.type === AST_NODE_TYPES.MemberExpression &&
                    ASTUtils.getPropertyName(node.callee) === REGENERATE_METHOD
                )
                    regenerations.push(node);
            },
            'Program:exit': function () {
                for (const callback of callbacks)
                    if (regenerations.every((call) => !source.getAncestors(call).includes(callback)))
                        context.report({ node: callback, messageId: 'keptSession' });
            },
        };
    },
});
