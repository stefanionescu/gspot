import { createRule } from '#plugin/definition.ts';
import { isRequireCall } from '#plugin/imports.ts';
import { getDeclarationNames } from '#plugin/syntax.ts';
import { DECLARATIONS } from '#plugin/config/private-before-public.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getDeclarationName(statement: TSESTree.Statement): string {
    if (statement.type === AST_NODE_TYPES.ExportDefaultDeclaration) return 'the default export';
    const declaration = statement.type === AST_NODE_TYPES.ExportNamedDeclaration ? statement.declaration : statement;
    if (!declaration) return 'this export';
    return getDeclarationNames(declaration)[0] ?? 'declaration';
}

function isExport(statement: TSESTree.Statement): boolean {
    if (statement.type === AST_NODE_TYPES.ExportDefaultDeclaration) return true;
    return statement.type === AST_NODE_TYPES.ExportNamedDeclaration && statement.declaration !== null;
}

function isPrivateDeclaration(statement: TSESTree.Statement): boolean {
    if (!DECLARATIONS.has(statement.type) || ('declare' in statement && statement.declare)) return false;
    return !(
        statement.type === AST_NODE_TYPES.VariableDeclaration &&
        statement.declarations.every((declarator) => isRequireCall(declarator.init))
    );
}

export const privateBeforePublic = createRule<[], 'order'>({
    name: 'private-before-public',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            title: 'Private before public',
            example:
                'The sequence `export const a = 1;` followed by `const b = 2;` reports `order`. Move the non-exported `b` declaration before the exported `a` declaration.',
            description: 'Checks that declarations the file keeps to itself come before the ones it exports.',
            why: 'The contract is what a reader wants at the end, after the parts it is built from; exports scattered among private helpers hide it.',
            fix: 'Move the non-exported declarations above every exported one, keeping their relative order.',
        },
        schema: [],
        messages: {
            order: '{{name}} is not exported but sits below {{exported}}. Private declarations come first, exports last.',
        },
    },
    create(context) {
        return {
            Program(node) {
                const firstExport = node.body.find((statement) => isExport(statement));
                if (firstExport === undefined) return;
                const after = node.body.slice(node.body.indexOf(firstExport) + 1);
                for (const statement of after)
                    if (isPrivateDeclaration(statement))
                        context.report({
                            node: statement,
                            messageId: 'order',
                            data: { name: getDeclarationName(statement), exported: getDeclarationName(firstExport) },
                        });
            },
        };
    },
});
