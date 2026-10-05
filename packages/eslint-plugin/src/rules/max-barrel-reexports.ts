import type { TSESTree } from '@typescript-eslint/utils';
import { lintedPath, isIndexFile } from '#plugin/files.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { MAX_REEXPORTS } from '#plugin/config/max-barrel-reexports.ts';
import type { MaxBarrelReexportsOptions } from '#plugin/types/max-barrel-reexports.ts';

export const maxBarrelReexports = createRule<MaxBarrelReexportsOptions, 'tooMany'>({
    name: 'max-barrel-reexports',
    meta: {
        defaultOptions: [{ max: MAX_REEXPORTS }],
        type: 'suggestion',
        docs: {
            level: 'none',
            title: 'Limit barrel exports',
            example:
                'With `max: 3`, four re-export statements in `src/index.ts` report `tooMany`. Remove an unnecessary re-export and update its consumers to import from the declaring module. Three remaining re-export statements meet that limit.',
            description: 'Finds an index file with more re-exports than the limit.',
            why: 'A barrel that grows without bound becomes the import everyone reaches for, and every change to any file behind it touches every importer.',
            fix: 'Import from the declaring modules or split the index by area. Set the max rule option if the public API needs a different limit. In gspot, set limits.barrel_reexports.',
        },
        schema: [optionsSchema({ max: { type: 'integer', minimum: 1 } })],
        messages: {
            tooMany:
                'This index has {{count}} re-exports; the limit is {{max}}. Import from the owning modules or split the index.',
        },
    },
    create(context, [options]) {
        const file = lintedPath(context);
        if (file === undefined || !isIndexFile(file.absolute)) return {};
        const max = options.max;
        const nodes: TSESTree.Node[] = [];
        return {
            ExportAllDeclaration(node) {
                nodes.push(node);
            },
            ExportNamedDeclaration(node) {
                if (node.source) nodes.push(node);
            },
            'Program:exit'() {
                for (const node of nodes.slice(max, max + 1))
                    context.report({
                        node,
                        messageId: 'tooMany',
                        data: { count: String(nodes.length), max: String(max) },
                    });
            },
        };
    },
});
