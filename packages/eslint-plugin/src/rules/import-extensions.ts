import { ASTUtils } from '@typescript-eslint/utils';
import { INTERNAL_PREFIXES } from '#plugin/config/rules.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { ImportSource, ImportExtensionsName, ImportExtensionsOptions } from '#plugin/types/rules.ts';

function isCompliant(source: string, style: ImportExtensionsName): boolean {
    if (source.includes('?')) return true;
    const extension = /\.(?<suffix>[^./?]+)$/u.exec(source)?.groups?.['suffix'];
    if (extension !== undefined && !/^[cm]?[jt]sx?$/u.test(extension)) return true;
    if (style === 'js') return /\.[cm]?js$/u.test(source);
    if (style === 'ts') return /\.[cm]?tsx?$/u.test(source);
    return !/\.[cm]?[jt]sx?$/u.test(source);
}

export const importExtensions = createRule<ImportExtensionsOptions, 'js' | 'ts' | 'extensionless'>({
    name: 'import-extensions',
    meta: {
        defaultOptions: [{ style: 'js', internalPrefixes: INTERNAL_PREFIXES }],
        type: 'problem',
        docs: {
            level: 'none',
            title: 'Import path style',
            example:
                'With `style: "js"`, `import { a } from "./a";` reports a missing JavaScript suffix. Correct it to `import { a } from "./a.js";`. Package imports such as `import { a } from "package";` do not need a suffix.',
            description:
                'Checks that internal imports use the suffix the runtime resolves: .js for compiled ESM, .ts for Deno and Bun, none for bundled code.',
            why: 'The wrong suffix works in the editor and fails at run time, or the other way round.',
            fix: 'Set the style rule option to js, ts, or extensionless, and use that style for internal imports. In gspot, set tools.eslint.import_extensions.',
        },
        schema: [
            optionsSchema({
                style: { type: 'string', enum: ['js', 'ts', 'extensionless'] },
                internalPrefixes: { type: 'array', items: { type: 'string' } },
            }),
        ],
        messages: {
            js: 'Internal imports end with .js here: "{{source}}".',
            ts: 'Internal imports end with .ts here: "{{source}}".',
            extensionless: 'Internal imports keep no suffix here: "{{source}}".',
        },
    },
    create(context, [configured]) {
        // RuleCreator merges the declared defaults before this listener is created.
        const options = configured as Required<ImportExtensionsOptions[0]>;
        const prefixes = options.internalPrefixes;
        const check = (node: TSESTree.Node | null | undefined, attributes: TSESTree.ImportAttribute[] = []): void => {
            if (!node) return;
            const source = ASTUtils.getStringIfConstant(node);
            if (source === null) return;
            if (
                attributes.some((attribute) => {
                    const key =
                        attribute.key.type === AST_NODE_TYPES.Identifier ? attribute.key.name : attribute.key.value;
                    return key === 'type' && attribute.value.value === 'json';
                })
            )
                return;
            if (prefixes.every((prefix) => !source.startsWith(prefix)) || isCompliant(source, options.style)) return;
            context.report({ node, messageId: options.style, data: { source } });
        };
        return {
            'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression'(node: ImportSource) {
                check(node.source, node.type === AST_NODE_TYPES.ImportExpression ? [] : node.attributes);
            },
        };
    },
});
