import { BLANK } from '#plugin/config/plugin.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import type { LayoutOptions } from '#plugin/types/rules.ts';
import { isDirective, isImportLike } from '#plugin/imports.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { AST_NODE_TYPES, AST_TOKEN_TYPES } from '@typescript-eslint/utils';
import { WHITESPACE, ATTACHED_DISTANCE, BLANK_LINE_DISTANCE } from '#plugin/config/rules.ts';

// Adjacent prose lines form one comment so fixes preserve their attachment and order.
function commentBlocks(text: string, comments: TSESTree.Comment[]): TSESTree.Comment[] {
    const blocks: TSESTree.Comment[] = [];
    let previous: TSESTree.Comment | undefined;
    for (const comment of comments) {
        const lineStart = text.lastIndexOf('\n', comment.range[0] - 1) + 1;
        if (
            comment.type !== AST_TOKEN_TYPES.Line ||
            isDirective(comment.value) ||
            !BLANK.test(text.slice(lineStart, comment.range[0]))
        ) {
            blocks.push(comment);
            previous = undefined;
            continue;
        }
        if (previous !== undefined && /^[\t ]*\r?\n[\t ]*$/u.test(text.slice(previous.range[1], comment.range[0]))) {
            previous = {
                ...previous,
                value: `${previous.value}\n${comment.value}`,
                range: [previous.range[0], comment.range[1]],
                loc: { start: previous.loc.start, end: comment.loc.end },
            };
            blocks[blocks.length - 1] = previous;
        } else {
            blocks.push(comment);
            previous = comment;
        }
    }
    return blocks;
}

function isTrailing(text: string, comment: TSESTree.Comment, node: TSESTree.Node): boolean {
    if (comment.loc.start.line !== node.loc.end.line || comment.range[0] < node.range[1]) return false;
    return BLANK.test(text.slice(node.range[1], comment.range[0]));
}

// A decorator written above export belongs to the class, and the parser starts the export statement after it.
// The statement a reader sees starts at the decorator, so a doc comment above the decorator leads the statement.
function firstDecorator(node: TSESTree.Node): TSESTree.Decorator | undefined {
    const isExport =
        node.type === AST_NODE_TYPES.ExportNamedDeclaration || node.type === AST_NODE_TYPES.ExportDefaultDeclaration;
    const declared = isExport ? node.declaration : node;
    return declared?.type === AST_NODE_TYPES.ClassDeclaration && Array.isArray(declared.decorators)
        ? declared.decorators[0]
        : undefined;
}

function startOf(node: TSESTree.Node): { offset: number; line: number } {
    const decorator = firstDecorator(node);
    const isEarlier = decorator !== undefined && decorator.range[0] < node.range[0];
    return isEarlier
        ? { offset: decorator.range[0], line: decorator.loc.start.line }
        : { offset: node.range[0], line: node.loc.start.line };
}

function isLeading(
    text: string,
    comment: TSESTree.Comment,
    node: TSESTree.Node,
    isBlankLineAllowed: boolean,
    comments: TSESTree.Comment[],
): boolean {
    const start = startOf(node);
    if (comment.range[1] > start.offset) return false;
    let between = text.slice(comment.range[1], start.offset);
    const directives = comments.filter(
        (directive) =>
            directive.range[0] >= comment.range[1] &&
            directive.range[1] <= start.offset &&
            isDirective(directive.value),
    );
    for (const directive of directives.toReversed()) {
        const from = directive.range[0] - comment.range[1];
        const to = directive.range[1] - comment.range[1];
        between = between.slice(0, from) + between.slice(to).replace(/^[\t ]*\r?\n/u, '');
    }
    if (!BLANK.test(between)) return false;
    const distance = between.split('\n').length - 1;
    if (distance > (isBlankLineAllowed ? BLANK_LINE_DISTANCE : ATTACHED_DISTANCE)) return false;
    const lineStart = text.lastIndexOf('\n', comment.range[0] - 1) + 1;
    return BLANK.test(text.slice(lineStart, comment.range[0]));
}

export const headerFirst = createRule<LayoutOptions, 'headerFirst'>({
    name: 'header-first',
    meta: {
        type: 'layout',
        fixable: 'code',
        docs: {
            level: 'all',
            title: 'Header comments before imports',
            example:
                'A file header after an import and separated from the next declaration by two blank lines reports `headerFirst`. Move the header before the import. A comment attached to a declaration stays beside that declaration.',
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
        const comments = commentBlocks(text, source.getAllComments());
        const isRequireAllowed = options.allowRequire === true;
        return {
            Program(node) {
                const firstImport = node.body.findIndex((statement) => isImportLike(statement, isRequireAllowed));
                const first = node.body[firstImport];
                if (first === undefined) return;
                const offset = node.body
                    .slice(firstImport + 1)
                    .findIndex((statement) => !isImportLike(statement, isRequireAllowed));
                const firstOther = offset === -1 ? -1 : firstImport + 1 + offset;
                const other = node.body[firstOther];
                if (other === undefined) return;
                const run = node.body.slice(firstImport, firstOther);
                const violating = comments.find((comment) => {
                    if (
                        comment.range[0] < first.range[0] ||
                        comment.range[1] > other.range[0] ||
                        isDirective(comment.value)
                    )
                        return false;
                    if (
                        run.some(
                            (statement) =>
                                (comment.range[0] >= statement.range[0] && comment.range[1] <= statement.range[1]) ||
                                isTrailing(text, comment, statement) ||
                                isLeading(text, comment, statement, false, comments),
                        )
                    )
                        return false;
                    return !(
                        (comment.range[0] >= other.range[0] && comment.range[1] <= other.range[1]) ||
                        isTrailing(text, comment, other) ||
                        isLeading(text, comment, other, true, comments)
                    );
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
