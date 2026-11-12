import { basename, dirname, resolve } from 'node:path';

import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import picomatch from 'picomatch';

import {
    BARREL_DECLARATIONS,
    DECLARING_DEFAULT_EXPORTS,
    INDEX_BASENAMES,
    INDEX_EXPORTS,
    PUBLISHED_PATH_FIELDS,
    TRIVIAL_FILE_OPTIONS_SCHEMA,
} from '../../config/structure.ts';
import { findPathInRoot } from '../../language/modules.ts';
import { listManifestPaths, readManifest } from '../../language/packages.ts';
import { isTypeAlias } from '../../language/syntax.ts';
import { isAlias } from '../../language/variables.ts';
import { createRule } from '../../rule.ts';
import type { TrivialFilesContext, TrivialFilesOptions } from '../../types/structure.ts';

function listPublishedPaths(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (value === null || typeof value !== 'object') return [];
    return Object.values(value).flatMap((child) => listPublishedPaths(child));
}

function isPublishedFile(context: TrivialFilesContext): boolean {
    const [manifest] = listManifestPaths(context);
    const fields = manifest === undefined ? undefined : readManifest(manifest);
    if (manifest === undefined || fields === undefined) return false;
    const file = resolve(context.physicalFilename);
    return PUBLISHED_PATH_FIELDS.flatMap((field) => listPublishedPaths(fields[field])).some(
        (published) => resolve(dirname(manifest), published) === file,
    );
}

function listBoundValues(statement: TSESTree.Node): Array<TSESTree.Node | null> {
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
    return Number(
        statement.type === AST_NODE_TYPES.ExportDefaultDeclaration
            ? DECLARING_DEFAULT_EXPORTS.has(statement.declaration.type)
            : BARREL_DECLARATIONS.has(statement.type),
    );
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

function checkIndexFile(
    context: TrivialFilesContext,
    node: TSESTree.Program,
    statements: readonly TSESTree.ProgramStatement[],
    limit: number,
): void {
    const count = statements.reduce((total, statement) => total + countExports(statement), 0);
    const declarations = statements.reduce((total, statement) => total + countDeclarations(statement), 0);
    if (count > declarations && count > limit) context.report({ node, messageId: 'barrel', data: { count, limit } });
}

function checkForwardingFile(
    context: TrivialFilesContext,
    node: TSESTree.Program,
    statements: readonly TSESTree.ProgramStatement[],
    forwardingFiles: readonly string[],
): void {
    const reexports = statements.filter(
        (statement) =>
            statement.type === AST_NODE_TYPES.ExportAllDeclaration ||
            (statement.type === AST_NODE_TYPES.ExportNamedDeclaration && statement.source !== null),
    );
    for (const statement of reexports) context.report({ node: statement, messageId: 'reexport' });
    const path = findPathInRoot(context);
    const isForwardingFile = path !== undefined && picomatch([...forwardingFiles], { dot: true })(path);
    if (
        !isForwardingFile &&
        statements.length > reexports.length &&
        statements.every((statement) => isForwarding(statement, context.sourceCode))
    )
        context.report({ node, messageId: 'trivial' });
}

export const noTrivialFiles = createRule<TrivialFilesOptions, 'trivial' | 'reexport' | 'barrel'>({
    name: 'no-trivial-files',
    meta: {
        defaultOptions: [{ reexports: 'none', indexExports: INDEX_EXPORTS, forwardingFiles: [] }],
        type: 'suggestion',
        docs: {
            example:
                'A file containing only `import { value } from "./owner"; export { value };` reports `trivial`. Change consumers to import directly from `owner`, then delete the forwarding file. `export { value } from "./owner";` reports `reexport` once, in any file. With `reexports: "index-only"`, a file named index may re-export, and reports `barrel` when it exports more names than it declares and more than `indexExports`. A file that the nearest package.json names in `exports`, `main`, or `bin` passes, because other packages import it by that path.',
            level: 'all',
            description:
                'Reports each `export … from`, and a file whose other top-level statements are only imports and aliases. With `reexports: "index-only"`, an index file may re-export up to `indexExports` names.',
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
        if (isPublishedFile(context)) return {};
        const isIndex = options.reexports === 'index-only' && INDEX_BASENAMES.has(basename(context.physicalFilename));
        return {
            Program(node) {
                const statements = node.body.filter((statement) => statement.type !== AST_NODE_TYPES.EmptyStatement);
                if (isIndex) checkIndexFile(context, node, statements, options.indexExports);
                else checkForwardingFile(context, node, statements, options.forwardingFiles);
            },
        };
    },
});
