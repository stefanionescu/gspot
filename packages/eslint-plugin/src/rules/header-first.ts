import { runsOf } from '#plugin/layout.ts';
import { BLANK } from '#plugin/config/layout.ts';
import { isImportLike } from '#plugin/imports.ts';
import { createRule } from '#plugin/definition.ts';
import { isOwnLine, isDirective } from '#plugin/comments.ts';
import type { StatementStart } from '#plugin/types/layout.ts';
import { BLANK_LINE_DISTANCE } from '#plugin/config/comments.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES, AST_TOKEN_TYPES } from '@typescript-eslint/utils';

// Adjacent prose lines form one comment so fixes preserve their attachment and order.
function commentBlocks(source: TSESLint.SourceCode): TSESTree.Comment[] {
    const text = source.getText();
    const blocks: TSESTree.Comment[] = [];
    let previous: TSESTree.Comment | undefined;
    for (const comment of source.getAllComments()) {
        if (comment.type !== AST_TOKEN_TYPES.Line || isDirective(comment.value) || !isOwnLine(source, comment)) {
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

// The parser starts an exported decorated class at export; its leading comment belongs above the first decorator.
function startOf(node: TSESTree.Node): StatementStart {
    const declared =
        node.type === AST_NODE_TYPES.ExportNamedDeclaration || node.type === AST_NODE_TYPES.ExportDefaultDeclaration
            ? node.declaration
            : node;
    const decorator = declared?.type === AST_NODE_TYPES.ClassDeclaration ? declared.decorators[0] : undefined;
    return decorator !== undefined && decorator.range[0] < node.range[0]
        ? { offset: decorator.range[0], line: decorator.loc.start.line }
        : { offset: node.range[0], line: node.loc.start.line };
}

// A declaration's comment can remain separated by one blank line and intervening tool directives.
function isLeading(
    source: TSESLint.SourceCode,
    comment: TSESTree.Comment,
    node: TSESTree.Node,
    comments: TSESTree.Comment[],
): boolean {
    const start = startOf(node);
    if (comment.range[1] > start.offset || !isOwnLine(source, comment)) return false;
    let between = source.getText().slice(comment.range[1], start.offset);
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
    return BLANK.test(between) && between.split('\n').length - 1 <= BLANK_LINE_DISTANCE;
}

// Remove a whole comment line or only the whitespace before an inline comment, preserving code on that line.
function removalRange(source: TSESLint.SourceCode, comment: TSESTree.Comment): [number, number] {
    const text = source.getText();
    const lineStart = source.getIndexFromLoc({ line: comment.loc.start.line, column: 0 });
    const newline = text.indexOf('\n', comment.range[1]);
    const end = newline === -1 ? text.length : newline;
    if (isOwnLine(source, comment) && BLANK.test(text.slice(comment.range[1], end)))
        return [lineStart, newline === -1 ? end : end + 1];
    let start = comment.range[0];
    while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) start -= 1;
    return [start, comment.range[1]];
}

export const headerFirst = createRule<[], 'headerFirst'>({
    name: 'header-first',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        fixable: 'code',
        docs: {
            level: 'all',
            title: 'Comments before imports',
            example:
                'A file header after an import reports `headerFirst`. A comment between imports does too. Move the comment above the first import or beside the code it explains. A comment that leads the next declaration and a tool directive remain in place. CommonJS require declarations follow the same rule when ESLint selects the commonjs source type.',
            description:
                'Reports comments within or immediately after an import block. Exempts tool directives and comments that lead the next declaration.',
            why: 'An import block lists dependencies. A file header belongs before it, and a behavior comment belongs with the code it explains.',
            fix: 'Move the comment above the first import or beside its declaration. eslint --fix moves it above the block.',
        },
        schema: [],
        messages: { headerFirst: 'Put the comment above the imports or beside the code it explains.' },
    },
    create(context) {
        const source = context.sourceCode;
        const text = source.getText();
        const comments = commentBlocks(source);
        return {
            Program(node) {
                for (const run of runsOf(node.body, (statement) => isImportLike(statement, context))) {
                    const [first] = run;
                    const last = run.at(-1);
                    if (first === undefined || last === undefined) continue;
                    const other = node.body[node.body.indexOf(last) + 1];
                    const end = other === undefined ? text.length : startOf(other).offset;
                    const violating = comments.find(
                        (comment) =>
                            comment.range[0] > first.range[0] &&
                            comment.range[1] <= end &&
                            !isDirective(comment.value) &&
                            !(other !== undefined && isLeading(source, comment, other, comments)),
                    );
                    if (violating === undefined) continue;
                    const followsImports = violating.loc.start.line > last.loc.end.line;
                    context.report({
                        loc: violating.loc,
                        messageId: 'headerFirst',
                        fix(fixer) {
                            const removal = removalRange(source, violating);
                            if (followsImports) removal[1] += (/^\s*/u.exec(text.slice(removal[1]))?.[0] ?? '').length;
                            return [
                                fixer.removeRange(removal),
                                fixer.insertTextBefore(
                                    first,
                                    `${source.getText(violating)}${followsImports ? '\n\n' : '\n'}`,
                                ),
                            ];
                        },
                    });
                }
            },
        };
    },
});
