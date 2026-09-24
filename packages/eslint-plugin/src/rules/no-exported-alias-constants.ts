import type { TSESTree } from '@typescript-eslint/utils';
import { createRule } from '#plugin/rules/definition.ts';
// `export const A = B` where B is an identifier or a member expression.
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

const WRAPPERS = new Set(['ChainExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression']);

function isAlias(node: TSESTree.Expression | null): boolean {
    let current: TSESTree.Node | null = node;
    while (current && WRAPPERS.has(current.type)) current = (current as { expression: TSESTree.Node }).expression;
    if (!current) return false;
    if (current.type === AST_NODE_TYPES.Identifier) return true;
    return current.type === AST_NODE_TYPES.MemberExpression && isAlias(current.object);
}

export const noExportedAliasConstants = createRule<[], 'alias'>({
    name: 'no-exported-alias-constants',
    meta: {
        type: 'suggestion',
        docs: {
            title: 'No exported alias constants',
            example:
                'The declaration `export const a = b;` reports `alias`. Remove `a` and update its consumers to use `b` from its owner. A declaration that owns a value, such as `export const a = 1;`, does not report this finding.',
            summary: 'Finds an exported constant that only renames another value.',
            why: 'Two names for one value split every search and every reader in two.',
            fix: 'Export the source value under its own name, or import the source where the alias was used.',
        },
        schema: [],
        messages: { alias: '{{name}} only renames {{source}}. Export the source value directly instead of an alias.' },
    },
    defaultOptions: [],
    create(context) {
        return {
            ExportNamedDeclaration(node) {
                if (node.declaration?.type !== AST_NODE_TYPES.VariableDeclaration || node.declaration.kind !== 'const')
                    return;
                for (const declarator of node.declaration.declarations) {
                    const { init } = declarator;
                    if (!init || !isAlias(init) || declarator.id.type !== AST_NODE_TYPES.Identifier) continue;
                    context.report({
                        node: declarator,
                        messageId: 'alias',
                        data: { name: declarator.id.name, source: context.sourceCode.getText(init) },
                    });
                }
            },
        };
    },
});
