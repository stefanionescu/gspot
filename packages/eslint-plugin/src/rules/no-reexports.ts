import { lintedPath, isIndexFile } from '#plugin/files.ts';
import type { ReexportsOptions } from '#plugin/types/reexports.ts';
import { createRule, optionsSchema } from '#plugin/create-rule.ts';

export const noReexports = createRule<ReexportsOptions, 'from' | 'star' | 'local'>({
    name: 'no-reexports',
    meta: {
        defaultOptions: [{ allowIndex: false }],
        type: 'suggestion',
        docs: {
            level: 'all',
            title: 'Export values at their declaration',
            example:
                'The following declaration reports `local`:\n\n```ts\nconst a = 1;\nexport { a };\n```\n\nExport at the declaration:\n\n```ts\nexport const a = 1;\n```',
            description:
                'Requires exports at their declarations and rejects forwarding exports and later export lists.',
            why: 'A re-export exists to shorten an import path; it hides the owner and lets the same value arrive by two routes.',
            fix: 'Import values from their declaring modules. Set `allowIndex: true` if a library exposes its API through index files.',
        },
        schema: [optionsSchema({ allowIndex: { type: 'boolean' } })],
        messages: {
            from: 'Import from the owning module instead of re-exporting "{{source}}".',
            star: 'Import from the owning module instead of an export-all barrel of "{{source}}".',
            local: 'Export values at their declaration instead of listing them again.',
        },
    },
    create(context, [options]) {
        const file = lintedPath(context);
        if (file !== undefined && options.allowIndex && isIndexFile(file.absolute)) return {};
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
