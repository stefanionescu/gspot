import type { RuleContext } from '../types/rules.ts';
import { createRule } from '../schemas/rules/options.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES, AST_TOKEN_TYPES } from '@typescript-eslint/utils';

import {
    BLANK,
    TS_COMMENT,
    LEADING_STAR,
    LINE_BREAK_GAP,
    LEADING_LINE_BREAK,
    BLANK_LINE_DISTANCE,
    TOOL_COMMENT_PREFIXES,
} from '../config/comments.ts';

/**
 * Check whether a comment holds a tool directive, such as a suppression, a global declaration, or a coverage mark.
 *
 * @param value the comment text without its markers
 * @returns whether a tool reads the comment
 */
function isToolComment(value: string): boolean {
    const text = value.replace(LEADING_STAR, '').trim();
    if (TS_COMMENT.test(text)) return true;
    return TOOL_COMMENT_PREFIXES.some((prefix) => text === prefix.trim() || text.startsWith(prefix));
}

/**
 * Check whether only whitespace comes before a comment on its line.
 *
 * @param source the parsed file, with line locations
 * @param comment the range to check
 * @returns whether the comment stands on its own line
 */
function isOwnLine(source: TSESLint.SourceCode, comment: TSESTree.Comment): boolean {
    const start = source.getIndexFromLoc({ line: comment.loc.start.line, column: 0 });
    return BLANK.test(source.getText().slice(start, comment.range[0]));
}

/**
 * Check for an import declaration or a CommonJS `require` statement.
 *
 * @param node the statement
 * @param sourceType the source type of the file
 * @returns whether the statement belongs to the import block
 */
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

/**
 * Check whether an expression calls `require` with one argument.
 *
 * @param node the expression, or nothing
 * @returns whether it calls `require`
 */
function isRequireCall(node: TSESTree.Node | null | undefined): boolean {
    return (
        node?.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.Identifier &&
        node.callee.name === 'require' &&
        node.arguments.length === 1
    );
}
function groupStatementRuns(
    body: TSESTree.Statement[],
    sourceType: RuleContext['languageOptions']['sourceType'],
): [TSESTree.Statement, ...TSESTree.Statement[]][] {
    const runs: [TSESTree.Statement, ...TSESTree.Statement[]][] = [];
    let open: [TSESTree.Statement, ...TSESTree.Statement[]] | undefined;
    for (const statement of body) {
        if (!isImportLike(statement, sourceType)) {
            open = undefined;
            continue;
        }
        if (open === undefined) {
            open = [statement];
            runs.push(open);
        } else open.push(statement);
    }
    return runs;
}
// Adjacent prose lines form one comment so fixes preserve their attachment and order.
function mergeCommentLines(source: TSESLint.SourceCode): TSESTree.Comment[] {
    const text = source.getText();
    const blocks: TSESTree.Comment[] = [];
    let previous: TSESTree.Comment | undefined;
    for (const comment of source.getAllComments()) {
        if (comment.type !== AST_TOKEN_TYPES.Line || isToolComment(comment.value) || !isOwnLine(source, comment)) {
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

// The parser starts an exported decorated class at `export`, but its leading comment sits above the first decorator.
function getStatementOffset(node: TSESTree.Node): number {
    const declared =
        node.type === AST_NODE_TYPES.ExportNamedDeclaration || node.type === AST_NODE_TYPES.ExportDefaultDeclaration
            ? node.declaration
            : node;
    const decorator =
        declared?.type === AST_NODE_TYPES.ClassDeclaration && 'decorators' in declared
            ? declared.decorators[0]
            : undefined;
    return decorator !== undefined && decorator.range[0] < node.range[0] ? decorator.range[0] : node.range[0];
}

// A leading comment may sit one blank line and some tool directives above its declaration.
function isLeading(
    source: TSESLint.SourceCode,
    comment: TSESTree.Comment,
    node: TSESTree.Node,
    comments: TSESTree.Comment[],
): boolean {
    const start = getStatementOffset(node);
    if (comment.range[1] > start || !isOwnLine(source, comment)) return false;
    let between = source.getText().slice(comment.range[1], start);
    const directives = comments.filter(
        (directive) =>
            directive.range[0] >= comment.range[1] && directive.range[1] <= start && isToolComment(directive.value),
    );
    for (const directive of directives.toReversed()) {
        const from = directive.range[0] - comment.range[1];
        const to = directive.range[1] - comment.range[1];
        between = between.slice(0, from) + between.slice(to).replace(LEADING_LINE_BREAK, '');
    }
    return BLANK.test(between) && between.split('\n').length - 1 <= BLANK_LINE_DISTANCE;
}

// Remove the whole line for a comment that stands alone; otherwise remove only the comment and the spaces before it.
function computeRemovalRange(source: TSESLint.SourceCode, comment: TSESTree.Comment): [number, number] {
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

export const noCommentsInImports = createRule<[], 'noCommentsInImports'>({
    name: 'no-comments-in-imports',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        fixable: 'code',
        docs: {
            level: 'all',
            example:
                'A file header after an import reports `noCommentsInImports`. A comment between imports does too. Move the comment above the first import or beside the code it explains. A comment that leads the next declaration remains in place. A tool directive is allowed only after the last import; a directive between imports is reported without a fix. CommonJS require declarations follow the same rule when ESLint selects the commonjs source type.',
            description:
                'Reports comments within or immediately after an import block. Exempts tool directives after the last import and comments that lead the next declaration.',
            why: 'An import block lists dependencies. A file header belongs before it, and a behavior comment belongs with the code it explains.',
            fix: 'Move the comment above the first import or beside its declaration. eslint --fix moves it above the block.',
        },
        schema: [],
        messages: { noCommentsInImports: 'Put the comment above the imports or beside the code it explains.' },
    },
    create(context) {
        const source = context.sourceCode;
        const text = source.getText();
        const comments = mergeCommentLines(source);
        return {
            Program(node) {
                for (const run of groupStatementRuns(node.body, context.languageOptions.sourceType)) {
                    const [first] = run;
                    const last = run.at(-1) ?? first;
                    const other = node.body[node.body.indexOf(last) + 1];
                    const end = other === undefined ? text.length : getStatementOffset(other);
                    const violating = comments.find(
                        (comment) =>
                            comment.range[0] > first.range[0] &&
                            comment.range[1] <= end &&
                            !(isToolComment(comment.value) && comment.range[0] > last.range[1]) &&
                            !(other !== undefined && isLeading(source, comment, other, comments)),
                    );
                    if (violating === undefined) continue;
                    const followsImports = violating.loc.start.line > last.loc.end.line;
                    context.report({
                        loc: violating.loc,
                        messageId: 'noCommentsInImports',
                        fix(fixer) {
                            if (isToolComment(violating.value)) return null;
                            const removal = computeRemovalRange(source, violating);
                            if (followsImports) {
                                const rest = text.slice(removal[1]);
                                removal[1] += rest.length - rest.trimStart().length;
                            }
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
