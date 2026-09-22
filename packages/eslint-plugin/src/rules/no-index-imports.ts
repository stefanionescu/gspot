import { createRule } from '#plugin/rules/definition.ts';
import { staticString } from '#plugin/files.ts';
import type { TSESTree } from '@typescript-eslint/utils';
// An import path that names an index file or a barrel.
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { optionsSchema, stringList } from '#plugin/rules/options.ts';

const DEFAULT_PATTERNS = [
    String.raw`^[@#][\w./-]*/.+/index(?:\.[cm]?[jt]sx?)?$`,
    String.raw`^\.{1,2}(?:/[^/]+)*/index(?:\.[cm]?[jt]sx?)?$`,
    String.raw`^\.{1,2}/index(?:\.[cm]?[jt]sx?)?$`,
];

export const noIndexImports = createRule<NoIndexImportsOptions, 'index'>({
    name: 'no-index-imports',
    meta: {
        type: 'problem',
        docs: {
            summary: 'Finds an import that names an index file instead of the module that declares the value.',
            why: 'An index import pulls in everything behind the barrel and hides which module the value comes from.',
            fix: 'Import from the leaf module directly.',
        },
        schema: [optionsSchema({ allow: stringList, patterns: stringList })],
        messages: { index: 'Import the owning module instead of the index "{{source}}".' },
    },
    defaultOptions: [{ allow: [], patterns: DEFAULT_PATTERNS }],
    create(context, [options]) {
        const allow = new Set(options.allow);
        const patterns = (options.patterns ?? DEFAULT_PATTERNS).map((pattern) => new RegExp(pattern, 'u'));
        const check = (node: TSESTree.Node | null | undefined): void => {
            const source = staticString(node);
            if (
                !node ||
                source === undefined ||
                allow.has(source) ||
                patterns.every((pattern) => !pattern.test(source))
            )
                return;
            context.report({ node, messageId: 'index', data: { source } });
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
            CallExpression(node) {
                if (
                    node.callee.type !== AST_NODE_TYPES.MemberExpression ||
                    node.callee.object.type !== AST_NODE_TYPES.Identifier ||
                    node.callee.object.name !== 'vi' ||
                    node.callee.property.type !== AST_NODE_TYPES.Identifier
                )
                    return;
                if (['doMock', 'importActual', 'mock'].includes(node.callee.property.name)) check(node.arguments[0]);
            },
        };
    },
});

export type NoIndexImportsOptions = [{ allow?: string[]; patterns?: string[] }];
