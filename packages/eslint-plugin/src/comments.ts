import { BLANK } from '#plugin/config/layout.ts';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { LEADING_STAR, TS_DIRECTIVE, DIRECTIVE_PREFIXES } from '#plugin/config/comments.ts';

/**
 * True for a comment that is a tool directive rather than prose: a suppression, a global declaration, a coverage mark.
 * @param value the comment text without its markers
 * @returns whether a tool reads the comment
 */
export function isDirective(value: string): boolean {
    const text = value.replace(LEADING_STAR, '').trim();
    if (TS_DIRECTIVE.test(text)) return true;
    return DIRECTIVE_PREFIXES.some((prefix) => text === prefix.trim() || text.startsWith(prefix));
}

/**
 * Whether only whitespace precedes a comment on its source line.
 * @param source the parsed source and line locations
 * @param comment the comment
 * @returns whether the comment occupies its own line
 */
export function isOwnLine(source: TSESLint.SourceCode, comment: TSESTree.Comment): boolean {
    const start = source.getIndexFromLoc({ line: comment.loc.start.line, column: 0 });
    return BLANK.test(source.getText().slice(start, comment.range[0]));
}
