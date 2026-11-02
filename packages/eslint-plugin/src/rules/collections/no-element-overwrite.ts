import { createRule } from '../../rule.ts';
import type { KeyWrite } from '../../types/rules.ts';
import { haveSameTokens } from '../../language/syntax.ts';
import { KEY_WRITE_ARGUMENTS } from '../../config/collections.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getKey(node: TSESTree.Node | undefined): string | undefined {
    if (node?.type === AST_NODE_TYPES.Identifier) return node.name;
    const isKey = node?.type === AST_NODE_TYPES.Literal && ['string', 'number'].includes(typeof node.value);
    return isKey ? String(node.value) : undefined;
}

function containsTokens(value: TSESTree.Node, expression: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const wanted = source.getTokens(value).map((token) => token.value);
    const tokens = source.getTokens(expression).map((token) => token.value);
    return tokens.some((_, start) => wanted.every((token, offset) => tokens[start + offset] === token));
}

function getIndexWrite(expression: TSESTree.AssignmentExpression, source: TSESLint.SourceCode): KeyWrite | undefined {
    const { left, right, operator } = expression;
    if (operator !== '=' || left.type !== AST_NODE_TYPES.MemberExpression || !left.computed) return undefined;
    const key = getKey(left.property);
    if (key === undefined || containsTokens(left.object, right, source)) return undefined;
    return { collection: left.object, key, node: expression };
}

function getCollectionWrite({ callee, arguments: values }: TSESTree.CallExpression): KeyWrite | undefined {
    if (callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const method = ASTUtils.getPropertyName(callee);
    if (method === null || KEY_WRITE_ARGUMENTS.get(method) !== values.length) return undefined;
    const key = getKey(values[0]);
    return key === undefined ? undefined : { collection: callee.object, key, node: callee.parent };
}

function getKeyWrite(statement: TSESTree.Node, source: TSESLint.SourceCode): KeyWrite | undefined {
    if (statement.type !== AST_NODE_TYPES.ExpressionStatement) return undefined;
    const { expression } = statement;
    if (expression.type === AST_NODE_TYPES.AssignmentExpression) return getIndexWrite(expression, source);
    return expression.type === AST_NODE_TYPES.CallExpression ? getCollectionWrite(expression) : undefined;
}

export const noElementOverwrite = createRule<[], 'overwrite'>({
    name: 'no-element-overwrite',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a statement that writes the same index or key of a collection as an earlier statement of an unbroken run of writes to that collection: `items[key] = value`, `map.set(key, value)`, and `set.add(key)`. A literal or a variable name counts as the key, and a write whose value reads the collection passes.',
            why: 'The second write replaces the first before anything reads it, which usually means one key is wrong.',
            fix: 'Correct the key that should differ, or delete the write whose value is lost.',
            example: '`labels[0] = "first"; labels[0] = "second";` reports `overwrite` at the second write.',
        },
        schema: [],
        messages: { overwrite: 'This write replaces {{key}}, which line {{line}} already set. Check the key.' },
    },
    create(context) {
        const source = context.sourceCode;
        const inspect = (statements: readonly TSESTree.Node[]) => {
            const written = new Map<string, KeyWrite>();
            let collection: TSESTree.Node | undefined;
            for (const statement of statements) {
                const write = getKeyWrite(statement, source);
                if (
                    write === undefined ||
                    (collection !== undefined && !haveSameTokens(write.collection, collection, source))
                )
                    written.clear();
                if (write === undefined) continue;
                const earlier = written.get(write.key);
                if (earlier !== undefined) {
                    const line = earlier.node.loc.start.line;
                    context.report({ node: write.node, messageId: 'overwrite', data: { key: write.key, line } });
                }
                written.set(write.key, write);
                collection = write.collection;
            }
        };
        return {
            Program: (node) => {
                inspect(node.body);
            },
            BlockStatement: (node) => {
                inspect(node.body);
            },
            SwitchCase: (node) => {
                inspect(node.consequent);
            },
        };
    },
});
