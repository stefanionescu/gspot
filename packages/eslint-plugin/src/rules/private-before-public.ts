import { createRule } from '#plugin/definition.ts';
import { isRequireCall } from '#plugin/imports.ts';
import { DECLARATIONS } from '#plugin/config/rules.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

function nameOf(statement: TSESTree.Statement): string {
    const declaration = statement.type === AST_NODE_TYPES.ExportNamedDeclaration ? statement.declaration : statement;
    if (!declaration) return 'this export';
    const named = declaration.type === AST_NODE_TYPES.VariableDeclaration ? declaration.declarations[0] : declaration;
    if ('id' in named && named.id?.type === AST_NODE_TYPES.Identifier) return named.id.name;
    return 'this declaration';
}

function isExport(statement: TSESTree.Statement): boolean {
    if (statement.type === AST_NODE_TYPES.ExportDefaultDeclaration) return true;
    return statement.type === AST_NODE_TYPES.ExportNamedDeclaration && statement.declaration !== null;
}

function isPrivateDeclaration(statement: TSESTree.Statement): boolean {
    if (!DECLARATIONS.has(statement.type) || (statement as { declare?: boolean }).declare === true) return false;
    return !(
        statement.type === AST_NODE_TYPES.VariableDeclaration &&
        statement.declarations.every((declarator) => isRequireCall(declarator.init))
    );
}

export const privateBeforePublic = createRule<[], 'order'>({
    name: 'private-before-public',
    meta: {
        type: 'problem',
        docs: {
            level: 'all',
            title: 'Private before public',
            example:
                'The sequence `export const a = 1;` followed by `const b = 2;` reports `order`. Move the non-exported `b` declaration before the exported `a` declaration.',
            summary: 'Checks that declarations the file keeps to itself come before the ones it exports.',
            why: 'The contract is what a reader wants at the end, after the parts it is built from; exports scattered among private helpers hide it.',
            fix: 'Move the non-exported declarations above every exported one, keeping their relative order.',
        },
        schema: [],
        messages: {
            order: '{{name}} is not exported but sits below the exported {{exported}}. Private declarations come first, exports last.',
        },
    },
    defaultOptions: [],
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
                            data: { name: nameOf(statement), exported: nameOf(firstExport) },
                        });
            },
        };
    },
});
