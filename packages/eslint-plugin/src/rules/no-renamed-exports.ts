import { unwrap } from '../syntax.ts';
import { createRule } from '../create-rule.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isRenamedValue(node: TSESTree.Expression | null): boolean {
    const unwrapped = unwrap(node);
    if (!unwrapped) return false;
    if (unwrapped.type === AST_NODE_TYPES.Identifier) return true;
    return unwrapped.type === AST_NODE_TYPES.MemberExpression && isRenamedValue(unwrapped.object);
}

export const noRenamedExports = createRule<[], 'renamed'>({
    name: 'no-renamed-exports',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            example:
                'The declaration `export const a = b;` reports `renamed`. Remove `a` and update its consumers to use `b` from its owner. A declaration that owns a value, such as `export const a = 1;`, does not report this finding.',
            description: 'Finds an exported constant that only renames another value.',
            why: 'Two names for one value split every search and every reader in two.',
            fix: 'Export the source value under its own name, or import the source where the renamed constant was used.',
        },
        schema: [],
        messages: { renamed: '{{name}} only renames {{source}}. Export the source value under its own name.' },
    },
    create(context) {
        return {
            ExportNamedDeclaration(node) {
                if (node.declaration?.type !== AST_NODE_TYPES.VariableDeclaration || node.declaration.kind !== 'const')
                    return;
                for (const declarator of node.declaration.declarations) {
                    const { init } = declarator;
                    if (!init || !isRenamedValue(init) || declarator.id.type !== AST_NODE_TYPES.Identifier) continue;
                    context.report({
                        node: declarator,
                        messageId: 'renamed',
                        data: { name: declarator.id.name, source: context.sourceCode.getText(init) },
                    });
                }
            },
        };
    },
});
