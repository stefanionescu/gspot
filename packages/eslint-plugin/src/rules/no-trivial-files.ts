import { posix } from 'node:path';
import { unwrap } from '../syntax.ts';
import { createRule } from '../create-rule.ts';
import { INDEX_BASENAMES } from '../config/paths.ts';
import { ALIASED_VALUES } from '../config/syntax.ts';
import type { TrivialFilesOptions } from '../types/rules.ts';
import { OPTIONS_SCHEMA } from '../config/rules/no-trivial-files.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function listBoundValues(statement: TSESTree.Node): (TSESTree.Node | null)[] {
    switch (statement.type) {
        case AST_NODE_TYPES.ExportDefaultDeclaration: {
            return [statement.declaration];
        }
        case AST_NODE_TYPES.TSExportAssignment: {
            return [statement.expression];
        }
        case AST_NODE_TYPES.VariableDeclaration: {
            return statement.declarations.map((declarator) => declarator.init);
        }
        default: {
            return [];
        }
    }
}

function isTypeAlias(node: TSESTree.TSTypeAliasDeclaration): boolean {
    const type = node.typeAnnotation;
    if (type.type !== AST_NODE_TYPES.TSTypeReference) return false;
    return (
        type.typeArguments === undefined ||
        type.typeArguments.params.every((argument) => argument.type === AST_NODE_TYPES.TSTypeReference)
    );
}

function isForwarding(statement: TSESTree.Node): boolean {
    switch (statement.type) {
        case AST_NODE_TYPES.ImportDeclaration:
        case AST_NODE_TYPES.TSImportEqualsDeclaration:
        case AST_NODE_TYPES.ExportAllDeclaration: {
            return true;
        }
        case AST_NODE_TYPES.ExportNamedDeclaration: {
            return statement.declaration === null || isForwarding(statement.declaration);
        }
        case AST_NODE_TYPES.TSTypeAliasDeclaration: {
            return isTypeAlias(statement);
        }
        default: {
            const values = listBoundValues(statement);
            return values.length > 0 && values.every((value) => ALIASED_VALUES.has(unwrap(value)?.type ?? ''));
        }
    }
}

export const noTrivialFiles = createRule<TrivialFilesOptions, 'trivial'>({
    name: 'no-trivial-files',
    meta: {
        defaultOptions: [{ allowIndex: false }],
        type: 'suggestion',
        docs: {
            example:
                'A file containing only `export { value } from "./owner";` reports `trivial`. Change consumers to import directly from `owner`, then delete the forwarding file. Set `allowIndex: true` to permit an index barrel.',
            level: 'all',
            description:
                'Reports a file whose top-level statements are only imports, re-exports, and aliases, such as `export const name = owner.name;` or `export type Alias = Owner;`. Small functions are the job of `gspot/no-trivial-functions`.',
            why: 'A file that only forwards to another module adds a step to every import and hides where the code lives.',
            fix: 'Import re-exported values from the modules that define them, and use the original name of each alias. Then delete the forwarding file.',
        },
        schema: [OPTIONS_SCHEMA],
        messages: {
            trivial:
                'This file only forwards or renames code. Import from the module that defines it, and delete this file.',
        },
    },
    create(context, [options]) {
        if (options.allowIndex && INDEX_BASENAMES.has(posix.basename(context.physicalFilename.replaceAll('\\', '/'))))
            return {};
        return {
            Program(node) {
                const statements = node.body.filter((statement) => statement.type !== AST_NODE_TYPES.EmptyStatement);
                if (statements.length > 0 && statements.every((statement) => isForwarding(statement)))
                    context.report({ node, messageId: 'trivial' });
            },
        };
    },
});
