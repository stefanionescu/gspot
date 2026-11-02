import { createRule } from '../../rule.ts';
import type { CommentGroup } from '../../types/structure.ts';
import { type TSESTree, type TSESLint, AST_TOKEN_TYPES } from '@typescript-eslint/utils';

import {
    COMMENT_CODE,
    COMMENT_DIRECTIVES,
    COMMENT_PARSE_ERRORS,
    COMMENT_CODE_PATTERNS,
    COMMENT_DOCUMENTATION,
    COMMENT_JSX_ATTRIBUTE,
    COMMENT_PARSER_OPTIONS,
} from '../../config/structure.ts';

function isParsedAsCode(parser: TSESLint.Parser.LooseParserModule, text: string): boolean {
    try {
        const program =
            'parseForESLint' in parser
                ? parser.parseForESLint(text, COMMENT_PARSER_OPTIONS).ast
                : parser.parse(text, COMMENT_PARSER_OPTIONS);
        return (program as TSESTree.Program).body.length > 0;
    } catch (error) {
        if (error instanceof Error && COMMENT_PARSE_ERRORS.has(error.name)) return false;
        throw error;
    }
}

function balanceBraces(text: string): string {
    const closing: string[] = [];
    const opening: string[] = [];
    for (const character of text) {
        if (character === '{') closing.push('}');
        else if (character === '}' && closing.pop() === undefined) opening.push('{');
    }
    return `${opening.join('')}${text}${closing.join('')}`;
}

function isCommentedCode(parser: TSESLint.Parser.LooseParserModule, text: string): boolean {
    if (COMMENT_DIRECTIVES.some((pattern) => pattern.test(text)) || !COMMENT_CODE.test(text) || text === '}')
        return false;
    return (
        isParsedAsCode(parser, text) ||
        isParsedAsCode(parser, balanceBraces(text)) ||
        (COMMENT_JSX_ATTRIBUTE.test(text) && isParsedAsCode(parser, `(<Comment ${text} />)`)) ||
        COMMENT_CODE_PATTERNS.some((pattern) => pattern.test(text))
    );
}

function isParser(value: unknown): value is TSESLint.Parser.LooseParserModule {
    if (typeof value !== 'object' || value === null) return false;
    return (
        ('parseForESLint' in value && typeof value.parseForESLint === 'function') ||
        ('parse' in value && typeof value.parse === 'function')
    );
}

function groupComments(comments: TSESTree.Comment[]): CommentGroup[] {
    const groups: CommentGroup[] = [];
    for (const comment of comments) {
        const group = groups.at(-1);
        const previous = group?.last;
        if (
            comment.type === AST_TOKEN_TYPES.Line &&
            previous?.type === AST_TOKEN_TYPES.Line &&
            comment.loc.start.line === previous.loc.end.line + 1 &&
            group !== undefined
        ) {
            group.comments.push(comment);
            group.last = comment;
        } else groups.push({ first: comment, last: comment, comments: [comment] });
    }
    return groups;
}

export const noCommentedCode = createRule<[], 'code'>({
    name: 'no-commented-code',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description: 'Reports executable code left in comments. Documentation and tool directives stay valid.',
            why: 'Disabled code goes stale and makes the active implementation harder to find. Git keeps its history.',
            fix: 'Delete disabled code. Explain the active behavior in prose, and put examples in documentation comments.',
            example: '`// const user = readUser();` reports disabled code. Delete it or restore it as active code.',
        },
        schema: [],
        messages: { code: 'Delete this disabled code. Git keeps its history.' },
    },
    create(context) {
        const configured = context.languageOptions.parserOptions['parser'];
        const scriptParser =
            typeof configured === 'object' && configured !== null
                ? Object.values(configured).find(isParser)
                : undefined;
        const parser = isParser(configured) ? configured : (scriptParser ?? context.languageOptions.parser);
        if (parser === undefined) return {};
        return {
            'Program:exit'() {
                for (const { first, last, comments } of groupComments(context.sourceCode.getAllComments())) {
                    const text = comments.map((comment) => comment.value.trim()).join('\n');
                    if (COMMENT_DIRECTIVES.some((pattern) => pattern.test(text)) || COMMENT_DOCUMENTATION.test(text))
                        continue;
                    const locations = isCommentedCode(parser, text)
                        ? [{ start: first.loc.start, end: last.loc.end }]
                        : comments
                              .filter((comment) => isCommentedCode(parser, comment.value.trim()))
                              .map((comment) => comment.loc);
                    for (const loc of locations) context.report({ loc, messageId: 'code' });
                }
            },
        };
    },
});
