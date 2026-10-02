import { runsOf } from '#plugin/layout.ts';
import { BLANK } from '#plugin/config/plugin.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { isDirective, isImportLike } from '#plugin/imports.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import type { HeaderCommentsOptions } from '#plugin/types/rules.ts';

// The comment with the whitespace that its removal leaves behind: a whole line, or the space before a trailing note.
function removalRange(text: string, comment: TSESTree.Comment): [number, number] {
    const lineStart = text.lastIndexOf('\n', comment.range[0] - 1) + 1;
    const lineEnd = text.indexOf('\n', comment.range[1]);
    const end = lineEnd === -1 ? text.length : lineEnd + 1;
    if (BLANK.test(text.slice(lineStart, comment.range[0])) && BLANK.test(text.slice(comment.range[1], end - 1)))
        return [lineStart, end];
    let start = comment.range[0];
    while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) start -= 1;
    return [start, comment.range[1]];
}

// Comments separated by whitespace alone form one block, moved by one fix.
function blocksOf(text: string, comments: TSESTree.Comment[]): [TSESTree.Comment, ...TSESTree.Comment[]][] {
    const blocks: [TSESTree.Comment, ...TSESTree.Comment[]][] = [];
    for (const comment of comments) {
        const current = blocks.at(-1);
        const previous = current?.at(-1);
        if (
            current !== undefined &&
            previous !== undefined &&
            BLANK.test(text.slice(previous.range[1], comment.range[0]))
        )
            current.push(comment);
        else blocks.push([comment]);
    }
    return blocks;
}

export const noImportComments = createRule<HeaderCommentsOptions, 'comment'>({
    name: 'no-import-comments',
    meta: {
        type: 'layout',
        fixable: 'code',
        docs: {
            level: 'all',
            title: 'No comments among imports',
            example:
                'The block below reports `comment`:\n\n```ts\nimport { a } from "./a";\n// the b helper\nimport { b } from "./b";\n```\n\nSay it where b is used, or above the block:\n\n```ts\n// the b helper\nimport { a } from "./a";\nimport { b } from "./b";\n```\n\nA suppression directive such as `// eslint-disable-next-line` stays, because it must sit on the line it covers.',
            summary:
                'Finds a comment written inside an import block, between its first and last import. Suppression directives are not comments.',
            why: 'An import block is a list, and a note inside a list is read as part of the wrong entry. The code that uses the import is where the note belongs.',
            fix: 'Move the comment above the block or next to the code it explains. gspot check --fix moves it above the block.',
        },
        schema: [optionsSchema({ allowRequire: { type: 'boolean' } })],
        messages: { comment: 'No comments among imports. Say it where the import is used, or above the block.' },
    },
    defaultOptions: [{ allowRequire: false }],
    create(context, [options]) {
        const source = context.sourceCode;
        const text = source.getText();
        const isRequireAllowed = options.allowRequire === true;
        return {
            Program(node) {
                for (const run of runsOf(node.body, (statement) => isImportLike(statement, isRequireAllowed))) {
                    const [first] = run;
                    const last = run.at(-1);
                    if (first === undefined || last === undefined) continue;
                    const lineEnd = text.indexOf('\n', last.range[1]);
                    const inside = source
                        .getAllComments()
                        .filter(
                            (comment) =>
                                comment.range[0] > first.range[0] &&
                                comment.range[1] <= (lineEnd === -1 ? text.length : lineEnd) &&
                                !isDirective(comment.value),
                        );
                    for (const block of blocksOf(text, inside))
                        context.report({
                            loc: { start: block[0].loc.start, end: block.at(-1)?.loc.end ?? block[0].loc.end },
                            messageId: 'comment',
                            fix: (fixer) => [
                                ...block.map((comment) => fixer.removeRange(removalRange(text, comment))),
                                fixer.insertTextBefore(
                                    first,
                                    `${block.map((comment) => source.getText(comment)).join('\n')}\n`,
                                ),
                            ],
                        });
                }
            },
        };
    },
});
