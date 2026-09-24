import { createRule } from '#plugin/rules/definition.ts';
import type { TSESTree } from '@typescript-eslint/utils';
// A non-index file that only re-exports.
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { isIndexFile, lintedFile } from '#plugin/files.ts';

const SKIPPED = new Set(['ImportDeclaration', 'TSImportEqualsDeclaration', 'EmptyStatement']);

function classify(statement: TSESTree.Statement): 'skip' | 'reexport' | 'declaration' {
    if (SKIPPED.has(statement.type)) return 'skip';
    if (statement.type === AST_NODE_TYPES.ExportAllDeclaration) return 'reexport';
    if (statement.type === AST_NODE_TYPES.ExportNamedDeclaration)
        return statement.declaration ? 'declaration' : 'reexport';
    return 'declaration';
}

export const noExportOnlyFiles = createRule<[], 'exportOnly'>({
    name: 'no-export-only-files',
    meta: {
        type: 'problem',
        docs: {
            title: 'Keep implementation with exports',
            example:
                'A `src/b.ts` containing only `export * from "./a";` reports `exportOnly`. Update consumers to import from `a.ts`, then delete `b.ts`. Do not add unrelated code to keep the forwarding file.',
            summary: 'Finds a file that is not an index and only re-exports other modules.',
            why: 'A re-export file is a second path to the same code; readers and tools follow it for nothing.',
            fix: 'Import from the module that declares the value, and delete this file.',
        },
        schema: [],
        messages: {
            exportOnly: 'This file only re-exports. Import from the modules that declare these values and delete it.',
        },
    },
    defaultOptions: [],
    create(context) {
        const file = lintedFile(context);
        if (file === undefined || isIndexFile(file)) return {};
        return {
            Program(node) {
                let reexport: TSESTree.Statement | undefined;
                let isDeclaration = false;
                for (const statement of node.body) {
                    const kind = classify(statement);
                    if (kind === 'reexport') reexport ??= statement;
                    else if (kind === 'declaration') isDeclaration = true;
                }
                if (reexport && !isDeclaration) context.report({ node: reexport, messageId: 'exportOnly' });
            },
        };
    },
});
