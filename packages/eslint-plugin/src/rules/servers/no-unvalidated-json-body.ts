import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { BODY_SCHEMA_PARSERS, JSON_BODY_READ, SCHEMA_PARSERS } from '../../config/servers.ts';
import { createRule } from '../../rule.ts';

function isParsedBy(node: TSESTree.Node, parsers: ReadonlySet<string | null>): boolean {
    const call = node.parent;
    if (call?.type !== AST_NODE_TYPES.CallExpression || call.arguments[0]?.range[0] !== node.range[0]) return false;
    return call.callee.type === AST_NODE_TYPES.MemberExpression && parsers.has(ASTUtils.getPropertyName(call.callee));
}

function isValidatedLater(wait: TSESTree.AwaitExpression, source: TSESLint.SourceCode): boolean {
    const declarator = wait.parent;
    if (declarator.type !== AST_NODE_TYPES.VariableDeclarator || declarator.id.type !== AST_NODE_TYPES.Identifier)
        return false;
    const references = source.getDeclaredVariables(declarator).flatMap((variable) => variable.references);
    return references.some(({ identifier }) => isParsedBy(identifier, BODY_SCHEMA_PARSERS));
}

export const noUnvalidatedJsonBody = createRule<[], 'unvalidated'>({
    name: 'no-unvalidated-json-body',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'none',
            description:
                'Reports `await req.json()` and `await request.json()` whose result no schema parses with `parse` or `safeParse`. No config turns it on; gspot turns it on for the Supabase edge functions.',
            why: 'A request body comes from the client, so any field can be missing or of the wrong type. Code that trusts it can write bad data or fail in ways that leak details.',
            fix: 'Parse the body with a schema, such as a Zod schema, before the code reads it.',
            example:
                '`const body = await req.json();` with no schema reports `unvalidated`. Write `const body = Order.parse(await req.json());`.',
        },
        schema: [],
        messages: {
            unvalidated:
                'The function reads the request body without a schema. Parse it with a schema, such as a Zod schema.',
        },
    },
    create(context) {
        return {
            [JSON_BODY_READ](node: TSESTree.AwaitExpression) {
                const source = context.sourceCode;
                const isValidated = isParsedBy(node, SCHEMA_PARSERS) || isValidatedLater(node, source);
                if (!isValidated) context.report({ node, messageId: 'unvalidated' });
            },
        };
    },
});
