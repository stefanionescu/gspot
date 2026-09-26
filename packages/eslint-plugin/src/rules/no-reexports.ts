import { isIndexFile, lintedFile } from '#plugin/files.ts';
import type { NoReexportsOptions } from '#plugin/types/rules.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';

export const noReexports = createRule<NoReexportsOptions, 'from' | 'star' | 'local'>({
    name: 'no-reexports',
    meta: {
        type: 'problem',
        docs: {
            title: 'No reexports',
            example:
                'The following declaration reports `local`:\n\n```ts\nconst a = 1;\nexport { a };\n```\n\nExport at the declaration:\n\n```ts\nexport const a = 1;\n```',
            summary: 'Finds a re-export: export from, export star, or an export list of local names.',
            why: 'A re-export exists to shorten an import path; it hides the owner and lets the same value arrive by two routes.',
            fix: 'Export values where they are declared and import them from there. Set structure.reexports to index-only if the repository is a library with barrels.',
        },
        schema: [optionsSchema({ allowIndex: { type: 'boolean' } })],
        messages: {
            from: 'Import from the owning module instead of re-exporting "{{source}}".',
            star: 'Import from the owning module instead of an export-all barrel of "{{source}}".',
            local: 'Export values at their declaration instead of listing them again.',
        },
    },
    defaultOptions: [{ allowIndex: false }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file !== undefined && options.allowIndex === true && isIndexFile(file)) return {};
        return {
            ExportAllDeclaration(node) {
                context.report({ node, messageId: 'star', data: { source: node.source.value } });
            },
            ExportNamedDeclaration(node) {
                if (node.source) context.report({ node, messageId: 'from', data: { source: node.source.value } });
                else if (!node.declaration && node.specifiers.length > 0) context.report({ node, messageId: 'local' });
            },
        };
    },
});
