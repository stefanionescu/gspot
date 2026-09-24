import { staticString } from '#plugin/files.ts';
// An internal import using the wrong suffix style for its runtime boundary.
import type { TSESTree } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/rules/definition.ts';

const DEFAULT_PREFIXES = ['./', '../', '@/', '#'];

function isCompliant(source: string, style: ImportPathStyleName): boolean {
    if (source.endsWith('.json') || source.endsWith('.css') || source.endsWith('.svg')) return true;
    if (style === 'js') return /\.[cm]?js$/u.test(source);
    if (style === 'ts') return /\.[cm]?tsx?$/u.test(source);
    return !/\.[cm]?[jt]sx?$/u.test(source);
}

export const importPathStyle = createRule<ImportPathStyleOptions, 'js' | 'ts' | 'extensionless'>({
    name: 'import-path-style',
    meta: {
        type: 'problem',
        docs: {
            title: 'Import path style',
            example:
                'With `style: "js"`, `import { a } from "./a";` reports a missing JavaScript suffix. Correct it to `import { a } from "./a.js";`. Package imports such as `import { a } from "package";` do not need a suffix.',
            summary:
                'Checks that internal imports use the suffix the runtime resolves: .js for compiled ESM, .ts for Deno and Bun, none for bundled code.',
            why: 'The wrong suffix works in the editor and fails at run time, or the other way round.',
            fix: 'Change the suffix to the one the rule names; tools.eslint.import_style sets it per file class.',
        },
        schema: [
            optionsSchema(
                {
                    style: { type: 'string', enum: ['js', 'ts', 'extensionless'] },
                    internalPrefixes: { type: 'array', items: { type: 'string' } },
                },
                ['style'],
            ),
        ],
        messages: {
            js: 'Internal imports end with .js here: "{{source}}".',
            ts: 'Internal imports end with .ts here: "{{source}}".',
            extensionless: 'Internal imports carry no suffix here: "{{source}}".',
        },
    },
    defaultOptions: [{ style: 'js', internalPrefixes: DEFAULT_PREFIXES }],
    create(context, [options]) {
        const prefixes = options.internalPrefixes ?? DEFAULT_PREFIXES;
        const check = (node: TSESTree.Node | null | undefined): void => {
            const source = staticString(node);
            if (!node || source === undefined) return;
            if (prefixes.every((prefix) => !source.startsWith(prefix)) || isCompliant(source, options.style)) return;
            context.report({ node, messageId: options.style, data: { source } });
        };
        return {
            ImportDeclaration: (node) => {
                check(node.source);
            },
            ExportAllDeclaration: (node) => {
                check(node.source);
            },
            ExportNamedDeclaration: (node) => {
                check(node.source);
            },
            ImportExpression: (node) => {
                check(node.source);
            },
        };
    },
});

export type ImportPathStyleName = 'js' | 'ts' | 'extensionless';

export type ImportPathStyleOptions = [{ style: ImportPathStyleName; internalPrefixes?: string[] }];
