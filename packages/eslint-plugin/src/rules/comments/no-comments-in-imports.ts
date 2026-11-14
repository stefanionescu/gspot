import { createRule } from '../../rule.ts';
import { isCallOf } from '../../language/syntax.ts';
import type { RuleContext } from '../../types/plugin.ts';
import type { ImportBlock } from '../../types/structure.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES, AST_TOKEN_TYPES } from '@typescript-eslint/utils';

import {
    BLANK,
    LEADING_STAR,
    LINE_BREAK_GAP,
    TYPESCRIPT_DIRECTIVE,
    ESLINT_LINE_DIRECTIVE,
    ESLINT_BLOCK_DIRECTIVE,
    TOOL_DIRECTIVE_PREFIXES,
    LEADING_COMMENT_LINE_BREAKS,
} from '../../config/comments.ts';

function isToolDirective(comment: TSESTree.Comment): boolean {
    const text = comment.value.replace(LEADING_STAR, '').trim();
    return (
        TYPESCRIPT_DIRECTIVE.test(text) ||
        (comment.type === AST_TOKEN_TYPES.Line ? ESLINT_LINE_DIRECTIVE : ESLINT_BLOCK_DIRECTIVE).test(text) ||
        TOOL_DIRECTIVE_PREFIXES.some((prefix) => text === prefix.trim() || text.startsWith(prefix))
    );
}

function isImportLike(node: TSESTree.Statement, sourceType: RuleContext['languageOptions']['sourceType']): boolean {
    if (node.type === AST_NODE_TYPES.ImportDeclaration) return true;
    if (node.type === AST_NODE_TYPES.TSImportEqualsDeclaration)
        return node.moduleReference.type === AST_NODE_TYPES.TSExternalModuleReference;
    if (sourceType !== 'commonjs') return false;
    if (node.type === AST_NODE_TYPES.ExpressionStatement) return isRequireCall(node.expression);
    return (
        node.type === AST_NODE_TYPES.VariableDeclaration &&
        node.declarations.length === 1 &&
        isRequireCall(node.declarations[0].init)
    );
}

function isRequireCall(node: TSESTree.Node | null): boolean {
    return node !== null && isCallOf(node, 'require') && node.arguments.length === 1;
}

function listImportBlocks(
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

function isLineStart(text: string, comment: TSESTree.Comment): boolean {
    return BLANK.test(text.slice(comment.range[0] - comment.loc.start.column, comment.range[0]));
}

function mergeCommentLines(source: TSESLint.SourceCode, text: string): TSESTree.Comment[] {
    const blocks: TSESTree.Comment[] = [];
    let previous: TSESTree.Comment | undefined;
    for (const comment of source.getAllComments()) {
        if (comment.type !== AST_TOKEN_TYPES.Line || isToolDirective(comment) || !isLineStart(text, comment)) {
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
    text: string,
    comment: TSESTree.Comment,
    node: TSESTree.Node,
    comments: TSESTree.Comment[],
): boolean {
    const start = getStatementOffset(node);
    if (comment.range[1] > start || !isLineStart(text, comment)) return false;
    const run = comments.filter((next) => next.range[0] >= comment.range[1] && next.range[1] <= start);
    return [comment, ...run].every((previous, index) => {
        const gap = text.slice(previous.range[1], run[index]?.range[0] ?? start);
        return BLANK.test(gap) && gap.split('\n').length - 1 <= LEADING_COMMENT_LINE_BREAKS;
    });
}

function buildRemovalRange(source: TSESLint.SourceCode, text: string, comment: TSESTree.Comment): [number, number] {
    const lineStart = source.getIndexFromLoc({ line: comment.loc.start.line, column: 0 });
    const newline = text.indexOf('\n', comment.range[1]);
    const end = newline === -1 ? text.length : newline;
    if (isLineStart(text, comment) && BLANK.test(text.slice(comment.range[1], end))) return [lineStart, end + 1];
    let start = comment.range[0];
    while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) start -= 1;
    return [start, comment.range[1]];
}

function listMisplacedComments(
    { first, last }: ImportBlock,
    body: readonly TSESTree.ProgramStatement[],
    text: string,
    comments: TSESTree.Comment[],
): TSESTree.Comment[] {
    const nextStatement = body[body.indexOf(last) + 1];
    const end = nextStatement === undefined ? text.length : getStatementOffset(nextStatement);
    return comments.filter(
        (comment) =>
            comment.range[0] > first.range[0] &&
            comment.range[1] <= end &&
            !isToolDirective(comment) &&
            (nextStatement === undefined || !isLeading(text, comment, nextStatement, comments)),
    );
}

function buildCommentFix(
    source: TSESLint.SourceCode,
    comment: TSESTree.Comment,
    { first, last }: ImportBlock,
): TSESLint.ReportFixFunction | null {
    if (comment.loc.start.line > last.loc.end.line) return null;
    const text = source.getText();
    return (fixer) => [
        fixer.removeRange(buildRemovalRange(source, text, comment)),
        fixer.insertTextBefore(first, `${source.getText(comment)}\n`),
    ];
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
                'A file header after an import reports `comment`. A comment between imports does too. Move the comment above the first import or beside the code it explains. A comment that leads the next declaration remains in place, and so does a run of comments, such as a section label above a JSDoc block, separated by at most one blank line and ending directly above the declaration. Tool directives, such as `// @ts-expect-error` above the import it targets, are allowed anywhere in the block. CommonJS require declarations follow the same rule when ESLint selects the commonjs source type.',
            description:
                'Reports each comment within or immediately after an import block, including TypeScript import-equals declarations. Exempts tool directives and each run of comments that leads the next declaration with at most one blank line between its parts.',
            why: 'An import block lists dependencies. A file header belongs before it, and a behavior comment belongs with the code it explains.',
            fix: 'Move the comment above the first import or beside its declaration. eslint --fix moves a comment inside the block above it. A comment after the block gets no fix, because only you know which code it explains.',
        },
        schema: [],
        messages: { comment: 'Put the comment above the imports or beside the code it explains.' },
    },
    create(context) {
        const source = context.sourceCode;
        const text = source.getText();
        const comments = mergeCommentLines(source, text);
        return {
            Program(node) {
                for (const block of listImportBlocks(node.body, context.languageOptions.sourceType))
                    for (const comment of listMisplacedComments(block, node.body, text, comments))
                        context.report({
                            loc: comment.loc,
                            messageId: 'comment',
                            fix: buildCommentFix(source, comment, block),
                        });
            },
        };
    },
});
