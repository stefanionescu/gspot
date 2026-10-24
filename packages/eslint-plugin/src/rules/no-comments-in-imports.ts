import { createRule } from '../create-rule.ts';
import type { RuleContext } from '../types/rules.ts';
import type { ImportBlock } from '../types/syntax.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES, AST_TOKEN_TYPES } from '@typescript-eslint/utils';

import {
    BLANK,
    LEADING_STAR,
    LINE_BREAK_GAP,
    LEADING_LINE_BREAK,
    TYPESCRIPT_DIRECTIVE,
    TOOL_DIRECTIVE_PREFIXES,
    LEADING_COMMENT_LINE_BREAKS,
} from '../config/rules/no-comments-in-imports.ts';

function isToolDirective(value: string): boolean {
    const text = value.replace(LEADING_STAR, '').trim();
    return (
        TYPESCRIPT_DIRECTIVE.test(text) ||
        TOOL_DIRECTIVE_PREFIXES.some((prefix) => text === prefix.trim() || text.startsWith(prefix))
    );
}

function isImportLike(node: TSESTree.Statement, sourceType: RuleContext['languageOptions']['sourceType']): boolean {
    if (node.type === AST_NODE_TYPES.ImportDeclaration) return true;
    if (sourceType !== 'commonjs') return false;
    if (node.type === AST_NODE_TYPES.ExpressionStatement) return isRequireCall(node.expression);
    return (
        node.type === AST_NODE_TYPES.VariableDeclaration &&
        node.declarations.length === 1 &&
        isRequireCall(node.declarations[0].init)
    );
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function isRequireCall(node: TSESTree.Node | null | undefined): boolean {
    return (
        node?.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.Identifier &&
        node.callee.name === 'require' &&
        node.arguments.length === 1
    );
}
function groupImportBlocks(
    body: TSESTree.Statement[],
    sourceType: RuleContext['languageOptions']['sourceType'],
): ImportBlock[] {
    const blocks: ImportBlock[] = [];
    let block: ImportBlock | undefined;
    for (const statement of body) {
        if (!isImportLike(statement, sourceType)) {
            block = undefined;
            continue;
        }
        if (block === undefined) {
            block = { first: statement, last: statement };
            blocks.push(block);
        } else block.last = statement;
    }
    return blocks;
}
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function isFirstOnLine(text: string, comment: TSESTree.Comment): boolean {
    return BLANK.test(text.slice(comment.range[0] - comment.loc.start.column, comment.range[0]));
}

function mergeCommentLines(source: TSESLint.SourceCode): TSESTree.Comment[] {
    const text = source.getText();
    const blocks: TSESTree.Comment[] = [];
    let previous: TSESTree.Comment | undefined;
    for (const comment of source.getAllComments()) {
        if (comment.type !== AST_TOKEN_TYPES.Line || isToolDirective(comment.value) || !isFirstOnLine(text, comment)) {
            blocks.push(comment);
            previous = undefined;
            continue;
        }
        if (previous !== undefined && LINE_BREAK_GAP.test(text.slice(previous.range[1], comment.range[0]))) {
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

function getStatementOffset(node: TSESTree.Node): number {
    const declaration =
        node.type === AST_NODE_TYPES.ExportNamedDeclaration || node.type === AST_NODE_TYPES.ExportDefaultDeclaration
            ? node.declaration
            : node;
    const decorator =
        declaration?.type === AST_NODE_TYPES.ClassDeclaration && 'decorators' in declaration
            ? declaration.decorators[0]
            : undefined;
    return decorator !== undefined && decorator.range[0] < node.range[0] ? decorator.range[0] : node.range[0];
}

function isLeading(
    source: TSESLint.SourceCode,
    comment: TSESTree.Comment,
    node: TSESTree.Node,
    comments: TSESTree.Comment[],
): boolean {
    const text = source.getText();
    const start = getStatementOffset(node);
    if (comment.range[1] > start || !isFirstOnLine(text, comment)) return false;
    let between = text.slice(comment.range[1], start);
    const directives = comments.filter(
        (directive) =>
            directive.range[0] >= comment.range[1] && directive.range[1] <= start && isToolDirective(directive.value),
    );
    for (const directive of directives.toReversed()) {
        const from = directive.range[0] - comment.range[1];
        const to = directive.range[1] - comment.range[1];
        between = between.slice(0, from) + between.slice(to).replace(LEADING_LINE_BREAK, '');
    }
    return BLANK.test(between) && between.split('\n').length - 1 <= LEADING_COMMENT_LINE_BREAKS;
}

function buildRemovalRange(source: TSESLint.SourceCode, comment: TSESTree.Comment): [number, number] {
    const text = source.getText();
    const lineStart = source.getIndexFromLoc({ line: comment.loc.start.line, column: 0 });
    const newline = text.indexOf('\n', comment.range[1]);
    const end = newline === -1 ? text.length : newline;
    if (isFirstOnLine(text, comment) && BLANK.test(text.slice(comment.range[1], end)))
        return [lineStart, newline === -1 ? end : end + 1];
    let start = comment.range[0];
    while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) start -= 1;
    return [start, comment.range[1]];
}

export const noCommentsInImports = createRule<[], 'comment'>({
    name: 'no-comments-in-imports',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        fixable: 'code',
        docs: {
            level: 'all',
            example:
                'A file header after an import reports `comment`. A comment between imports does too. Move the comment above the first import or beside the code it explains. A comment that leads the next declaration remains in place. Tool directives, such as `// @ts-expect-error` above the import it targets, are allowed anywhere in the block. CommonJS require declarations follow the same rule when ESLint selects the commonjs source type.',
            description:
                'Reports comments within or immediately after an import block. Exempts tool directives and comments that lead the next declaration.',
            why: 'An import block lists dependencies. A file header belongs before it, and a behavior comment belongs with the code it explains.',
            fix: 'Move the comment above the first import or beside its declaration. eslint --fix moves it above the block.',
        },
        schema: [],
        messages: { comment: 'Put the comment above the imports or beside the code it explains.' },
    },
    create(context) {
        const source = context.sourceCode;
        const text = source.getText();
        const comments = mergeCommentLines(source);
        return {
            Program(node) {
                for (const { first, last } of groupImportBlocks(node.body, context.languageOptions.sourceType)) {
                    const other = node.body[node.body.indexOf(last) + 1];
                    const end = other === undefined ? text.length : getStatementOffset(other);
                    const violating = comments.find(
                        (comment) =>
                            comment.range[0] > first.range[0] &&
                            comment.range[1] <= end &&
                            !isToolDirective(comment.value) &&
                            (other === undefined || !isLeading(source, comment, other, comments)),
                    );
                    if (violating === undefined) continue;
                    const isAfterImports = violating.loc.start.line > last.loc.end.line;
                    context.report({
                        loc: violating.loc,
                        messageId: 'comment',
                        fix(fixer) {
                            const removal = buildRemovalRange(source, violating);
                            if (isAfterImports) {
                                const rest = text.slice(removal[1]);
                                removal[1] += rest.length - rest.trimStart().length;
                            }
                            return [
                                fixer.removeRange(removal),
                                fixer.insertTextBefore(
                                    first,
                                    `${source.getText(violating)}${isAfterImports ? '\n\n' : '\n'}`,
                                ),
                            ];
                        },
                    });
                }
            },
        };
    },
});
