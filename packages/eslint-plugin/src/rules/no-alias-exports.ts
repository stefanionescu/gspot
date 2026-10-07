import { unwrap } from '#plugin/syntax.ts';
import { createRule } from '#plugin/create-rule.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isAlias(node: TSESTree.Expression | null): boolean {
    const current = unwrap(node);
    if (!current) return false;
    if (current.type === AST_NODE_TYPES.Identifier) return true;
    return current.type === AST_NODE_TYPES.MemberExpression && isAlias(current.object);
}

export const noAliasExports = createRule<[], 'alias'>({
    name: 'no-alias-exports',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            title: 'No exported alias constants',
            example:
                'The declaration `export const a = b;` reports `alias`. Remove `a` and update its consumers to use `b` from its owner. A declaration that owns a value, such as `export const a = 1;`, does not report this finding.',
            description: 'Finds an exported constant that only renames another value.',
            why: 'Two names for one value split every search and every reader in two.',
            fix: 'Export the source value under its own name, or import the source where the alias was used.',
        },
        schema: [],
        messages: { alias: '{{name}} only renames {{source}}. Export the source value directly instead of an alias.' },
    },
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
