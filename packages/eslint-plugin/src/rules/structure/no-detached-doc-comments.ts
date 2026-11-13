import { AST_NODE_TYPES, AST_TOKEN_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { BLANK, DOCUMENTED_NODES, STANDALONE_DOC_TAG } from '../../config/structure.ts';
import { createRule } from '../../rule.ts';

export const noDetachedDocComments = createRule<[], 'detached'>({
    name: 'no-detached-doc-comments',
    meta: {
        defaultOptions: [],
        type: 'layout',
        fixable: 'whitespace',
        docs: {
            level: 'all',
            example:
                'A `/** Doubles a number. */` comment, an empty line, and then `function twice` reports `detached`, and the fix removes the empty line. The fix of an unused `// eslint-disable-next-line` comment leaves such a line between a doc comment and its function. A comment with `@file` or `@typedef`, a comment above an import, and a `//` comment pass.',
            description:
                'Reports a blank line between a `/** */` comment and the declaration or member below it. Exempts a comment with a tag that documents the file or a type of its own, such as `@file`, `@module`, `@typedef`, and `@callback`.',
            why: 'A doc comment documents the declaration directly below it. After a blank line, editors and documentation tools read the declaration as undocumented.',
            fix: 'Remove the blank line. eslint --fix removes it. For a comment about the whole file, add the `@file` tag or write a `//` comment.',
        },
        schema: [],
        messages: {
            detached:
                'Remove the blank line between this doc comment and its declaration. For a comment about the file, add @file.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const text = source.getText();
        const docComments = source
            .getAllComments()
            .filter(
                (comment) =>
                    comment.type === AST_TOKEN_TYPES.Block &&
                    comment.value.startsWith('*') &&
                    !STANDALONE_DOC_TAG.test(comment.value) &&
                    BLANK.test(text.slice(comment.range[0] - comment.loc.start.column, comment.range[0])),
            );
        return {
            Program() {
                for (const comment of docComments) {
                    const range = findBlankRange(source, comment);
                    if (range === undefined) continue;
                    const gap = text.slice(...range);
                    context.report({
                        loc: comment.loc,
                        messageId: 'detached',
                        fix: (fixer) => fixer.replaceTextRange(range, `\n${gap.slice(gap.lastIndexOf('\n') + 1)}`),
                    });
                }
            },
        };
    },
});

/**
Find the range between a doc comment and the declaration that follows it after a blank line. A comment before another
comment, such as a directive, has no such range.
*/
function findBlankRange(source: TSESLint.SourceCode, comment: TSESTree.Comment): [number, number] | undefined {
    const next = source.getTokenAfter(comment, { includeComments: true });
    if (next === null || next.type === AST_TOKEN_TYPES.Block || next.type === AST_TOKEN_TYPES.Line) return undefined;
    const gap = source.getText().slice(comment.range[1], next.range[0]);
    const hasBlankLine = gap.indexOf('\n') !== gap.lastIndexOf('\n');
    return hasBlankLine && isDocumented(source, next) ? [comment.range[1], next.range[0]] : undefined;
}

function isDocumented(source: TSESLint.SourceCode, token: TSESTree.Token): boolean {
    let node = source.getNodeByRangeIndex(token.range[0]);
    if (node === null || node.type === AST_NODE_TYPES.Program) return false;
    while (
        node.parent.type !== AST_NODE_TYPES.Program &&
        (node.parent.range[0] === node.range[0] || node.type === AST_NODE_TYPES.Decorator)
    )
        node = node.parent;
    if (node.type === AST_NODE_TYPES.ExportNamedDeclaration) return node.declaration !== null;
    return DOCUMENTED_NODES.has(node.type);
}
