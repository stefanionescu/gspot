import { basename } from 'node:path';
import { isAlias } from '../syntax.ts';
import { createRule } from '../rule.ts';
import type { TrivialFilesOptions } from '../types/rules.ts';
import { INDEX_BASENAMES, TRIVIAL_FILE_OPTIONS_SCHEMA } from '../config/rules.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

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
    const parameters = (node.typeParameters?.params ?? []).map((parameter) =>
        parameter.constraint === undefined && parameter.default === undefined ? parameter.name.name : null,
    );
    const passed = (type.typeArguments?.params ?? []).map((argument) =>
        argument.type === AST_NODE_TYPES.TSTypeReference &&
        argument.typeName.type === AST_NODE_TYPES.Identifier &&
        argument.typeArguments === undefined
            ? argument.typeName.name
            : undefined,
    );
    return passed.length === parameters.length && passed.every((name, index) => name === parameters[index]);
}

function isForwarding(statement: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    switch (statement.type) {
        case AST_NODE_TYPES.ImportDeclaration: {
            return statement.specifiers.length > 0;
        }
        case AST_NODE_TYPES.TSImportEqualsDeclaration:
        case AST_NODE_TYPES.ExportAllDeclaration: {
            return true;
        }
        case AST_NODE_TYPES.ExportNamedDeclaration: {
            return statement.declaration === null || isForwarding(statement.declaration, source);
        }
        case AST_NODE_TYPES.TSTypeAliasDeclaration: {
            return isTypeAlias(statement);
        }
        default: {
            const values = listBoundValues(statement);
            return values.length > 0 && values.every((value) => isAlias(value, source.getScope(statement)));
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
                'Reports a file whose top-level statements are only imports, re-exports, and aliases, such as `export const name = owner.name;`, `export type Alias = Owner;`, or `export type Alias<T> = Owner<T>;`. A type that gives a generic its arguments, such as `export type UserBox = Box<User>;`, defines a type and is not an alias. Small functions are the job of `gspot/no-trivial-functions`.',
            why: 'A file that only forwards to another module adds a step to every import and hides where the code lives.',
            fix: 'Import re-exported values from the modules that define them, and use the original name of each alias. Then delete the forwarding file.',
        },
        schema: [TRIVIAL_FILE_OPTIONS_SCHEMA],
        messages: {
            trivial:
                'This file only forwards or renames code. Import from the module that defines it, and delete this file.',
        },
    },
    create(context, [options]) {
        if (options.allowIndex && INDEX_BASENAMES.has(basename(context.physicalFilename))) return {};
        return {
            Program(node) {
                const statements = node.body.filter((statement) => statement.type !== AST_NODE_TYPES.EmptyStatement);
                if (
                    statements.length > 0 &&
                    statements.every((statement) => isForwarding(statement, context.sourceCode))
                )
                    context.report({ node, messageId: 'trivial' });
            },
        };
    },
});
