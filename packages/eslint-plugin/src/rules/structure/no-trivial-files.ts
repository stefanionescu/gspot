import picomatch from 'picomatch';
import { basename } from 'node:path';
import { createRule } from '../../rule.ts';
import { PLUGIN_PREFIX } from '../../config/plugin.ts';
import { findPathInFolder } from '../../language/modules.ts';
import { isAlias, isTypeAlias } from '../../language/syntax.ts';
import type { TrivialFilesOptions } from '../../types/rules.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    INDEX_EXPORTS,
    INDEX_BASENAMES,
    BARREL_DECLARATIONS,
    DECLARING_DEFAULT_EXPORTS,
    TRIVIAL_FILE_OPTIONS_SCHEMA,
} from '../../config/structure.ts';

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

function countExports(statement: TSESTree.Node): number {
    if (statement.type === AST_NODE_TYPES.ExportNamedDeclaration) return statement.specifiers.length;
    if (statement.type === AST_NODE_TYPES.ExportAllDeclaration) return Number(statement.exportKind !== 'type');
    if (statement.type !== AST_NODE_TYPES.ExportDefaultDeclaration) return 0;
    const { declaration } = statement;
    if (DECLARING_DEFAULT_EXPORTS.has(declaration.type)) return 0;
    return declaration.type === AST_NODE_TYPES.ObjectExpression ? declaration.properties.length : 1;
}

function countDeclarations(statement: TSESTree.Node): number {
    if (statement.type === AST_NODE_TYPES.VariableDeclaration) return statement.declarations.length;
    if (statement.type === AST_NODE_TYPES.ExportDefaultDeclaration)
        return Number(DECLARING_DEFAULT_EXPORTS.has(statement.declaration.type));
    return Number(BARREL_DECLARATIONS.has(statement.type));
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

export const noTrivialFiles = createRule<TrivialFilesOptions, 'trivial' | 'reexport' | 'barrel'>({
    name: 'no-trivial-files',
    meta: {
        defaultOptions: [{ reexports: 'none', indexExports: INDEX_EXPORTS, forwardingFiles: [] }],
        type: 'suggestion',
        docs: {
            example:
                'A file containing only `import { value } from "./owner"; export { value };` reports `trivial`. Change consumers to import directly from `owner`, then delete the forwarding file. `export { value } from "./owner";` reports `reexport` once, in any file. With `reexports: "index-only"`, a file named index may re-export, and reports `barrel` when it exports more names than it declares and more than `indexExports`.',
            level: 'all',
            description:
                'Reports each `export … from`, and a file whose other top-level statements are only imports and aliases, such as `export const name = owner.name;`, `export type Alias = Owner;`, or `export type Alias<T> = Owner<T>;`. A type that gives a generic its arguments, such as `export type UserBox = Box<User>;`, defines a type and is not an alias. With `reexports: "index-only"`, files named index may re-export and forward, up to `indexExports` names when they export more names than they declare. A file that matches `forwardingFiles` may only forward, but still reports each re-export. Small functions are the job of `gspot/no-trivial-functions`.',
            why: 'A file that only forwards to another module adds a step to every import and hides where the code lives.',
            fix: 'Import re-exported values from the modules that define them, and use the original name of each alias. Then delete the forwarding file or the re-export. Split an index file that exports too many names.',
        },
        schema: [TRIVIAL_FILE_OPTIONS_SCHEMA],
        messages: {
            trivial:
                'This file only forwards or renames code. Import from the module that defines it, and delete this file.',
            reexport:
                'Export values at their declaration instead of re-exporting them. Import from the module that defines them.',
            barrel: 'This index file exports {{count}} names, more than it declares and more than {{limit}}. Import from the modules that define them, or split the file.',
        },
    },
    create(context, [options]) {
        const isIndex = options.reexports === 'index-only' && INDEX_BASENAMES.has(basename(context.physicalFilename));
        const path = findPathInFolder(
            (context.settings[PLUGIN_PREFIX] as { root?: string } | undefined)?.root ?? context.cwd,
            context.physicalFilename,
        );
        const isForwardingFile = path !== undefined && picomatch([...options.forwardingFiles], { dot: true })(path);
        return {
            Program(node) {
                const statements = node.body.filter((statement) => statement.type !== AST_NODE_TYPES.EmptyStatement);
                if (isIndex) {
                    const count = statements.reduce((total, statement) => total + countExports(statement), 0);
                    const declarations = statements.reduce(
                        (total, statement) => total + countDeclarations(statement),
                        0,
                    );
                    if (count > declarations && count > options.indexExports)
                        context.report({ node, messageId: 'barrel', data: { count, limit: options.indexExports } });
                    return;
                }
                const reexports = statements.filter(
                    (statement) =>
                        statement.type === AST_NODE_TYPES.ExportAllDeclaration ||
                        (statement.type === AST_NODE_TYPES.ExportNamedDeclaration && statement.source !== null),
                );
                for (const statement of reexports) context.report({ node: statement, messageId: 'reexport' });
                if (
                    !isForwardingFile &&
                    statements.length > reexports.length &&
                    statements.every((statement) => isForwarding(statement, context.sourceCode))
                )
                    context.report({ node, messageId: 'trivial' });
            },
        };
    },
});
