import { createRule } from '#plugin/rules/definition.ts';
// More than the limit of re-exports in one index.
import type { TSESTree } from '@typescript-eslint/utils';
import { isIndexFile, lintedFile } from '#plugin/files.ts';
import { optionsSchema, positiveInteger } from '#plugin/rules/options.ts';

const DEFAULT_MAX = 20;

export const maxBarrelReexports = createRule<MaxBarrelReexportsOptions, 'tooMany'>({
    name: 'max-barrel-reexports',
    meta: {
        type: 'problem',
        docs: {
            summary: 'Finds an index file with more re-exports than the limit.',
            why: 'A barrel that grows without bound becomes the import everyone reaches for, and every change to any file behind it touches every importer.',
            fix: 'Import from the modules that declare the values, or split the index by area. Raise limits.barrel_reexports with a reason if the barrel is the contract.',
        },
        schema: [optionsSchema({ max: positiveInteger })],
        messages: {
            tooMany:
                'This index has {{count}} re-exports; the limit is {{max}}. Import from the owning modules or split the index.',
        },
    },
    defaultOptions: [{ max: DEFAULT_MAX }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined || !isIndexFile(file)) return {};
        const max = options.max ?? DEFAULT_MAX;
        const nodes: TSESTree.Node[] = [];
        return {
            ExportAllDeclaration(node) {
                nodes.push(node);
            },
            ExportNamedDeclaration(node) {
                if (node.source) nodes.push(node);
            },
            'Program:exit'() {
                if (nodes.length <= max) return;
                for (const node of nodes)
                    context.report({
                        node,
                        messageId: 'tooMany',
                        data: { count: String(nodes.length), max: String(max) },
                    });
            },
        };
    },
});

export type MaxBarrelReexportsOptions = [{ max?: number }];
