// A file comment placed after the import block.
import { createRule } from '#plugin/rule.ts';
import { optionsSchema } from '#plugin/options.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { isImportLike } from '#plugin/rules/import-layout.ts';
import type { HeaderCommentsOptions } from '#plugin-types/options.ts';

const DIRECTIVE_PREFIXES = [
    'eslint',
    'global ',
    'globals ',
    'exported ',
    'jshint ',
    'jslint ',
    'istanbul ',
    'c8 ',
    'v8 ',
    '@vitest',
    '@jest',
    'biome-ignore',
    'oxlint-',
];
const TS_DIRECTIVE = /^@?ts-(?:ignore|expect-error|nocheck|check)\b/u;
const BLANK = /^\s*$/u;
const BLANK_LINE = /\n\s*\n/u;
const LEADING_STAR = /^\s*\*?/u;
const WHITESPACE = /[\t\n\r ]/u;

function isDirective(value: string): boolean {
    const text = value.replace(LEADING_STAR, '').trim();
    if (TS_DIRECTIVE.test(text)) return true;
    return DIRECTIVE_PREFIXES.some((prefix) => text === prefix.trim() || text.startsWith(prefix));
}

function isBlank(text: string): boolean {
    return BLANK.test(text);
}

function isInside(comment: TSESTree.Comment, node: TSESTree.Node): boolean {
    return comment.range[0] >= node.range[0] && comment.range[1] <= node.range[1];
}

function isTrailing(text: string, comment: TSESTree.Comment, node: TSESTree.Node): boolean {
    if (comment.loc.start.line !== node.loc.end.line || comment.range[0] < node.range[1]) return false;
    return isBlank(text.slice(node.range[1], comment.range[0]));
}

function isLeading(text: string, comment: TSESTree.Comment, node: TSESTree.Node, isBlankLineAllowed: boolean): boolean {
    if (comment.range[1] > node.range[0]) return false;
    const between = text.slice(comment.range[1], node.range[0]);
    if (!isBlank(between)) return false;
    const distance = node.loc.start.line - comment.loc.end.line;
    if (distance > (isBlankLineAllowed ? 2 : 1)) return false;
    if (!isBlankLineAllowed && BLANK_LINE.test(between)) return false;
    const lineStart = text.lastIndexOf('\n', comment.range[0] - 1) + 1;
    return isBlank(text.slice(lineStart, comment.range[0]));
}

function isAttached(
    text: string,
    comment: TSESTree.Comment,
    node: TSESTree.Node,
    isBlankLineAllowed: boolean,
): boolean {
    return (
        isInside(comment, node) || isTrailing(text, comment, node) || isLeading(text, comment, node, isBlankLineAllowed)
    );
}

function firstOtherIndex(body: TSESTree.Statement[], firstImport: number, isRequireAllowed: boolean): number {
    const offset = body.slice(firstImport + 1).findIndex((statement) => !isImportLike(statement, isRequireAllowed));
    return offset === -1 ? -1 : firstImport + 1 + offset;
}

export const headerCommentsBeforeImports = createRule<HeaderCommentsOptions, 'headerFirst'>({
    name: 'header-comments-before-imports',
    meta: {
        type: 'layout',
        fixable: 'code',
        docs: {
            summary: 'Finds a file comment written after the import block instead of before it.',
            why: 'The first thing a reader sees should say what the file is; a header buried under imports is missed.',
            fix: 'Move the comment above the first import. gspot check --fix does it.',
        },
        schema: [optionsSchema({ allowRequire: { type: 'boolean' } })],
        messages: { headerFirst: 'Put the file comment above the imports.' },
    },
    defaultOptions: [{ allowRequire: false }],
    create(context, [options]) {
        const source = context.sourceCode;
        const text = source.getText();
        const isRequireAllowed = options.allowRequire === true;
        return {
            Program(node) {
                const firstImport = node.body.findIndex((statement) => isImportLike(statement, isRequireAllowed));
                const firstOther = firstImport === -1 ? -1 : firstOtherIndex(node.body, firstImport, isRequireAllowed);
                const first = node.body[firstImport];
                const other = node.body[firstOther];
                if (first === undefined || other === undefined) return;
                const run = node.body.slice(firstImport, firstOther);
                const violating = source.getAllComments().find((comment) => {
                    if (
                        comment.range[0] < first.range[0] ||
                        comment.range[1] > other.range[0] ||
                        isDirective(comment.value)
                    )
                        return false;
                    if (run.some((statement) => isAttached(text, comment, statement, false))) return false;
                    return !isAttached(text, comment, other, true);
                });
                if (!violating) return;
                context.report({
                    node: violating,
                    messageId: 'headerFirst',
                    fix(fixer) {
                        const lineStart = text.lastIndexOf('\n', violating.range[0] - 1) + 1;
                        let end = violating.range[1];
                        while (end < text.length && WHITESPACE.test(text[end] ?? '')) end += 1;
                        const commentText = text.slice(lineStart, violating.range[1]).trimEnd();
                        return [
                            fixer.insertTextBeforeRange([first.range[0], first.range[0]], `${commentText}\n\n`),
                            fixer.removeRange([lineStart, end]),
                        ];
                    },
                });
            },
        };
    },
});
